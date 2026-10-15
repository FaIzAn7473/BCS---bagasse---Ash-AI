"""
Training pipeline for the BCS Bagasse Ash AI models.

Models trained:
  - ucs_model.pkl  : predicts UCS  given [LL, PL, BA_Percentage]
  - cbr_model.pkl  : predicts CBR  given [LL, PL, BA_Percentage]

Run this script once before starting the backend server:
    python backend/train_model.py
"""

import os
import sys
import json
import warnings
import numpy as np
import pandas as pd
import joblib

from pathlib import Path
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import (
    RandomForestRegressor,
    GradientBoostingRegressor,
    ExtraTreesRegressor,
)
from sklearn.model_selection import cross_val_score, KFold
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent          # backend/
DATA_FILE  = BASE_DIR / "data" / "dataset.csv"
MODELS_DIR = BASE_DIR / "models"
METRICS_FILE = MODELS_DIR / "metrics.json"

MODELS_DIR.mkdir(parents=True, exist_ok=True)

MIN_ROWS = 10   # hard minimum for any ML to make sense

FEATURES = ["LL", "PL", "BA_Percentage"]

# ── Candidate algorithms ────────────────────────────────────────────────────────
def _make_candidates():
    return {
        "RandomForest": RandomForestRegressor(
            n_estimators=500, random_state=42, min_samples_leaf=1, n_jobs=-1
        ),
        "ExtraTrees": ExtraTreesRegressor(
            n_estimators=500, random_state=42, min_samples_leaf=1, n_jobs=-1
        ),
        "GradientBoosting": GradientBoostingRegressor(
            n_estimators=300, learning_rate=0.05, max_depth=4, random_state=42
        ),
    }


# ── Helpers ─────────────────────────────────────────────────────────────────────
def _rmse(y_true, y_pred):
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def _select_best(X, y, cv):
    """Cross-validate all candidates and return (best_name, best_estimator, cv_r2)."""
    best_name, best_score, best_est = None, -np.inf, None
    candidates = _make_candidates()
    for name, est in candidates.items():
        pipe = Pipeline([("scaler", StandardScaler()), ("model", est)])
        scores = cross_val_score(pipe, X, y, cv=cv, scoring="r2", n_jobs=-1)
        mean_r2 = float(np.mean(scores))
        print(f"  {name:25s}  CV R² = {mean_r2:.4f}  (±{np.std(scores):.4f})")
        if mean_r2 > best_score:
            best_score = mean_r2
            best_name  = name
            best_est   = pipe
    return best_name, best_est, best_score


def _evaluate(model, X, y):
    """Return train-set metrics (model already fitted)."""
    y_pred = model.predict(X)
    return {
        "r2":   round(float(r2_score(y_true=y, y_pred=y_pred)), 4),
        "mae":  round(float(mean_absolute_error(y_true=y, y_pred=y_pred)), 4),
        "rmse": round(float(_rmse(y_true=y, y_pred=y_pred)), 4),
    }


# ── Main ────────────────────────────────────────────────────────────────────────
def train():
    print("=" * 60)
    print("BCS Bagasse Ash AI — Model Training Pipeline")
    print("=" * 60)

    # 1. Load
    if not DATA_FILE.exists():
        print(f"ERROR: Dataset not found at {DATA_FILE}")
        sys.exit(1)

    df = pd.read_csv(DATA_FILE)
    print(f"\nLoaded {len(df)} rows from {DATA_FILE.name}")

    # 2. Basic column check
    required = ["LL", "PL", "BA_Percentage", "UCS", "CBR"]
    missing  = [c for c in required if c not in df.columns]
    if missing:
        print(f"ERROR: Missing columns: {missing}")
        sys.exit(1)

    # 3. Recalculate PI
    df["PI"] = df["LL"] - df["PL"]

    # 4. Numeric conversion & drop bad rows
    for col in ["LL", "PL", "PI", "BA_Percentage", "MDD", "OMC", "UCS", "CBR"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df.dropna(subset=["LL", "PL", "BA_Percentage", "UCS", "CBR"], inplace=True)
    df = df[df["PL"] < df["LL"]]
    df = df[df["BA_Percentage"] >= 0]
    df = df[df["UCS"] > 0]
    df = df[df["CBR"] > 0]
    df.drop_duplicates(inplace=True)
    df.reset_index(drop=True, inplace=True)
    after = len(df)

    if before != after:
        print(f"  Removed {before - after} invalid/duplicate rows. {after} rows remain.")

    # 5. Minimum size check
    if after < MIN_ROWS:
        msg = (
            f"WARNING: Only {after} valid rows found. "
            f"At least {MIN_ROWS} rows are required for reliable model training. "
            "Add more validated experimental or research data."
        )
        print(msg)
        # Save the warning so the API can serve it
        metrics = {"insufficient_data": True, "warning": msg, "num_rows": after}
        with open(METRICS_FILE, "w") as f:
            json.dump(metrics, f, indent=2)
        sys.exit(1)

    # 6. Prepare features
    X    = df[FEATURES].values
    y_ucs = df["UCS"].values
    y_cbr = df["CBR"].values

    # Store training-data ranges for extrapolation detection
    training_ranges = {
        "LL":  [float(df["LL"].min()),  float(df["LL"].max())],
        "PL":  [float(df["PL"].min()),  float(df["PL"].max())],
        "PI":  [float(df["PI"].min()),  float(df["PI"].max())],
    }

    # 7. Cross-validation setup
    n_splits = min(5, max(2, after // 4))
    cv = KFold(n_splits=n_splits, shuffle=True, random_state=42)
    print(f"\n  Using {n_splits}-fold cross-validation on {after} samples.\n")

    # 8. Select best model for UCS
    print("UCS model selection:")
    ucs_name, ucs_pipe, ucs_cv_r2 = _select_best(df[FEATURES], y_ucs, cv)
    print(f"  → Best: {ucs_name}  (CV R² = {ucs_cv_r2:.4f})\n")

    # 9. Select best model for CBR
    print("CBR model selection:")
    cbr_name, cbr_pipe, cbr_cv_r2 = _select_best(df[FEATURES], y_cbr, cv)
    print(f"  → Best: {cbr_name}  (CV R² = {cbr_cv_r2:.4f})\n")

    # 10. Final fit on full dataset
    ucs_pipe.fit(df[FEATURES], y_ucs)
    cbr_pipe.fit(df[FEATURES], y_cbr)

    # 11. Train-set metrics (informational only — cross-val is the reliable figure)
    ucs_train_metrics = _evaluate(ucs_pipe, df[FEATURES], y_ucs)
    cbr_train_metrics = _evaluate(cbr_pipe, df[FEATURES], y_cbr)

    # 12. Cross-val metrics per fold (for display)
    ucs_cv_scores = cross_val_score(ucs_pipe, df[FEATURES], y_ucs, cv=cv, scoring="r2")
    cbr_cv_scores = cross_val_score(cbr_pipe, df[FEATURES], y_cbr, cv=cv, scoring="r2")

    # Actual vs predicted (leave-one-out style via CV predict)
    from sklearn.model_selection import cross_val_predict
    ucs_cv_pred = cross_val_predict(ucs_pipe, df[FEATURES], y_ucs, cv=cv).tolist()
    cbr_cv_pred = cross_val_predict(cbr_pipe, df[FEATURES], y_cbr, cv=cv).tolist()

    # 13. Save models
    joblib.dump(ucs_pipe, MODELS_DIR / "ucs_model.pkl")
    joblib.dump(cbr_pipe, MODELS_DIR / "cbr_model.pkl")
    print("Models saved.")

    # 14. Build and save metrics JSON
    metrics = {
        "insufficient_data": False,
        "num_rows": after,
        "training_ranges": training_ranges,
        "ucs": {
            "algorithm":   ucs_name,
            "cv_r2_mean":  round(float(np.mean(ucs_cv_scores)), 4),
            "cv_r2_std":   round(float(np.std(ucs_cv_scores)),  4),
            "train_r2":    ucs_train_metrics["r2"],
            "train_mae":   ucs_train_metrics["mae"],
            "train_rmse":  ucs_train_metrics["rmse"],
            "actual":      y_ucs.tolist(),
            "cv_predicted": ucs_cv_pred,
        },
        "cbr": {
            "algorithm":   cbr_name,
            "cv_r2_mean":  round(float(np.mean(cbr_cv_scores)), 4),
            "cv_r2_std":   round(float(np.std(cbr_cv_scores)),  4),
            "train_r2":    cbr_train_metrics["r2"],
            "train_mae":   cbr_train_metrics["mae"],
            "train_rmse":  cbr_train_metrics["rmse"],
            "actual":      y_cbr.tolist(),
            "cv_predicted": cbr_cv_pred,
        },
    }

    with open(METRICS_FILE, "w") as f:
        json.dump(metrics, f, indent=2)

    print("\n" + "=" * 60)
    print("Training complete.")
    print(f"  UCS  — CV R²: {metrics['ucs']['cv_r2_mean']:.4f}  "
          f"Train MAE: {metrics['ucs']['train_mae']:.4f}  "
          f"Train RMSE: {metrics['ucs']['train_rmse']:.4f}")
    print(f"  CBR  — CV R²: {metrics['cbr']['cv_r2_mean']:.4f}  "
          f"Train MAE: {metrics['cbr']['train_mae']:.4f}  "
          f"Train RMSE: {metrics['cbr']['train_rmse']:.4f}")
    print("=" * 60)


if __name__ == "__main__":
    train()
