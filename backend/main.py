"""
FastAPI backend for BCS Bagasse Ash AI Optimizer.

Endpoints:
  GET  /health
  POST /predict
  GET  /model-performance
  GET  /dataset-summary
  POST /upload-dataset
"""

import io
import json
import os
import numpy as np
import pandas as pd
import joblib

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator, model_validator

from utils.data_validator import validate_dataset, get_dataset_summary

# ── Paths ───────────────────────────────────────────────────────────────────────
BASE_DIR     = Path(__file__).resolve().parent
MODELS_DIR   = BASE_DIR / "models"
DATA_DIR     = BASE_DIR / "data"
DATA_FILE    = DATA_DIR / "dataset.csv"
METRICS_FILE = MODELS_DIR / "metrics.json"

# ── App ─────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="BCS Bagasse Ash AI",
    description="AI-Based Optimization of Bagasse Ash for Black Cotton Soil Stabilization",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model state ─────────────────────────────────────────────────────────────────
ucs_model = None
cbr_model = None
training_ranges: dict = {}

EXPERIMENTAL_BA_MIN = 5.0
EXPERIMENTAL_BA_MAX = 17.0
OPTIMIZATION_STEP   = 0.1
OPTIMIZATION_MAX    = 20.0


def load_models():
    global ucs_model, cbr_model, training_ranges
    ucs_path = MODELS_DIR / "ucs_model.pkl"
    cbr_path = MODELS_DIR / "cbr_model.pkl"

    if ucs_path.exists() and cbr_path.exists():
        ucs_model = joblib.load(ucs_path)
        cbr_model = joblib.load(cbr_path)

    if METRICS_FILE.exists():
        with open(METRICS_FILE) as f:
            data = json.load(f)
        training_ranges = data.get("training_ranges", {})


load_models()


# ── Schemas ─────────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    ll: float
    pl: float

    @field_validator("ll")
    @classmethod
    def ll_range(cls, v):
        if v <= 0 or v > 200:
            raise ValueError("Liquid Limit (LL) must be between 0 and 200.")
        return v

    @field_validator("pl")
    @classmethod
    def pl_range(cls, v):
        if v <= 0 or v > 200:
            raise ValueError("Plastic Limit (PL) must be between 0 and 200.")
        return v

    @model_validator(mode="after")
    def pl_less_than_ll(self):
        if self.pl >= self.ll:
            raise ValueError("Plastic Limit (PL) must be less than Liquid Limit (LL).")
        return self


# ── Helpers ─────────────────────────────────────────────────────────────────────
def _check_training_range(ll: float, pl: float) -> Optional[str]:
    """Return a warning if inputs are outside training range."""
    if not training_ranges:
        return None
    ll_range = training_ranges.get("LL", [0, 9999])
    pl_range = training_ranges.get("PL", [0, 9999])
    margin   = 0.15  # 15 % tolerance beyond the training range

    ll_tol = (ll_range[1] - ll_range[0]) * margin
    pl_tol = (pl_range[1] - pl_range[0]) * margin

    if (ll < ll_range[0] - ll_tol or ll > ll_range[1] + ll_tol or
            pl < pl_range[0] - pl_tol or pl > pl_range[1] + pl_tol):
        return (
            "Input soil properties are outside the model training range. "
            "Prediction reliability may be low."
        )
    return None


def _optimize_ba(ll: float, pl: float):
    """
    Sweep BA% from 0 to OPTIMIZATION_MAX in steps of OPTIMIZATION_STEP.
    For each candidate, predict UCS and CBR.
    Compute combined normalised score = 0.5 × norm_UCS + 0.5 × norm_CBR.
    Return the candidate with the highest score.
    """
    candidates = np.arange(0.0, OPTIMIZATION_MAX + OPTIMIZATION_STEP, OPTIMIZATION_STEP)
    n = len(candidates)

    X = pd.DataFrame({
        "LL":           np.full(n, ll),
        "PL":           np.full(n, pl),
        "BA_Percentage": candidates,
    })

    pred_ucs = ucs_model.predict(X[["LL", "PL", "BA_Percentage"]])
    pred_cbr = cbr_model.predict(X[["LL", "PL", "BA_Percentage"]])

    # Normalise
    ucs_range = pred_ucs.max() - pred_ucs.min()
    cbr_range = pred_cbr.max() - pred_cbr.min()
    ucs_norm = (pred_ucs - pred_ucs.min()) / ucs_range if ucs_range > 0 else np.ones(n) * 0.5
    cbr_norm = (pred_cbr - pred_cbr.min()) / cbr_range if cbr_range > 0 else np.ones(n) * 0.5

    score = 0.5 * ucs_norm + 0.5 * cbr_norm
    best_i = int(np.argmax(score))

    return {
        "candidates":  [round(float(c), 1) for c in candidates],
        "pred_ucs":    [round(float(v), 4) for v in pred_ucs],
        "pred_cbr":    [round(float(v), 4) for v in pred_cbr],
        "score":       [round(float(v), 4) for v in score],
        "optimum_ba":  round(float(candidates[best_i]), 2),
        "optimum_ucs": round(float(pred_ucs[best_i]),   4),
        "optimum_cbr": round(float(pred_cbr[best_i]),   4),
    }


# ── Routes ───────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": ucs_model is not None and cbr_model is not None,
    }


@app.post("/predict")
def predict(req: PredictRequest):
    if ucs_model is None or cbr_model is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Models are not trained yet. "
                "Run 'python backend/train_model.py' first."
            ),
        )

    ll = req.ll
    pl = req.pl
    pi = round(ll - pl, 4)

    # Extrapolation warning
    range_warning = _check_training_range(ll, pl)

    # Optimize
    result = _optimize_ba(ll, pl)

    optimum_ba  = result["optimum_ba"]
    within_exp  = EXPERIMENTAL_BA_MIN <= optimum_ba <= EXPERIMENTAL_BA_MAX

    warnings = []
    if range_warning:
        warnings.append(range_warning)
    if not within_exp:
        warnings.append(
            "Prediction is outside the current experimental range (5–17%). "
            "Laboratory validation is required."
        )

    return {
        "pi":                       pi,
        "optimum_ba":               optimum_ba,
        "predicted_ucs":            result["optimum_ucs"],
        "predicted_cbr":            result["optimum_cbr"],
        "within_experimental_range": within_exp,
        "warnings":                 warnings,
        # Full sweep data for charts
        "chart_data": {
            "ba_values":  result["candidates"],
            "ucs_values": result["pred_ucs"],
            "cbr_values": result["pred_cbr"],
            "score_values": result["score"],
        },
    }


@app.get("/model-performance")
def model_performance():
    if not METRICS_FILE.exists():
        raise HTTPException(
            status_code=404,
            detail="Model metrics not found. Run 'python backend/train_model.py' first.",
        )

    with open(METRICS_FILE) as f:
        metrics = json.load(f)

    if metrics.get("insufficient_data"):
        raise HTTPException(
            status_code=422,
            detail=metrics.get("warning", "Insufficient data for reliable model training."),
        )

    return metrics


@app.get("/dataset-summary")
def dataset_summary():
    if not DATA_FILE.exists():
        raise HTTPException(status_code=404, detail="Dataset file not found.")

    df = pd.read_csv(DATA_FILE)
    df["PI"] = df["LL"] - df["PL"]
    df_clean, errors, warnings_list = validate_dataset(df)

    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))

    summary = get_dataset_summary(df_clean)
    summary["warnings"] = warnings_list

    # Include table data (capped at 500 rows for safety)
    records = df_clean.head(500).round(4).to_dict(orient="records")
    summary["records"] = records

    return summary


@app.post("/upload-dataset")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    content = await file.read()

    try:
        df_raw = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {str(e)}")

    # Recalculate PI before validation
    if "LL" in df_raw.columns and "PL" in df_raw.columns:
        df_raw["PI"] = df_raw["LL"] - df_raw["PL"]

    df_clean, errors, warnings_list = validate_dataset(df_raw)

    if errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))

    # Save the cleaned dataset
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df_clean.to_csv(DATA_FILE, index=False)

    summary = get_dataset_summary(df_clean)
    summary["warnings"] = warnings_list
    summary["message"] = (
        f"Dataset uploaded and validated successfully. "
        f"{summary['num_records']} valid rows saved. "
        "Run 'python backend/train_model.py' to retrain the models."
    )

    return summary


@app.get("/download-dataset")
def download_dataset():
    if not DATA_FILE.exists():
        raise HTTPException(status_code=404, detail="Dataset file not found.")

    df = pd.read_csv(DATA_FILE)
    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bcs_bagasse_ash_dataset.csv"},
    )
