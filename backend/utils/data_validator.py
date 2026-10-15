"""
Data validation utilities for the BCS Bagasse Ash dataset.
"""

import pandas as pd
import numpy as np
from typing import Tuple, List, Dict, Any


REQUIRED_COLUMNS = ["LL", "PL", "PI", "BA_Percentage", "MDD", "OMC", "UCS", "CBR"]

COLUMN_BOUNDS = {
    "LL":           (20.0, 120.0),
    "PL":           (10.0,  80.0),
    "PI":           ( 0.0,  80.0),
    "BA_Percentage":(0.0,   30.0),
    "MDD":          (1.0,    2.5),
    "OMC":          (5.0,   40.0),
    "UCS":          (0.01,  10.0),
    "CBR":          (0.01,  30.0),
}


def validate_dataset(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str], List[str]]:
    """
    Validate and clean the dataset.

    Returns
    -------
    cleaned_df : pd.DataFrame
    errors     : list of blocking error messages
    warnings   : list of non-blocking warning messages
    """
    errors: List[str] = []
    warnings: List[str] = []

    # 1. Required columns
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        errors.append(f"Missing required columns: {', '.join(missing_cols)}")
        return df, errors, warnings

    # Keep only the required columns
    df = df[REQUIRED_COLUMNS].copy()

    # 2. Empty dataset
    if df.empty:
        errors.append("Dataset is empty.")
        return df, errors, warnings

    # 3. Convert all to numeric, coerce non-numeric → NaN
    for col in REQUIRED_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # 4. Missing / non-numeric values
    nan_counts = df.isnull().sum()
    for col, cnt in nan_counts.items():
        if cnt > 0:
            warnings.append(f"Column '{col}' has {cnt} non-numeric or missing value(s). Those rows will be dropped.")

    df.dropna(inplace=True)

    if df.empty:
        errors.append("No valid rows remain after removing missing values.")
        return df, errors, warnings

    # 5. Negative / out-of-range values
    for col, (lo, hi) in COLUMN_BOUNDS.items():
        bad = df[(df[col] < lo) | (df[col] > hi)]
        if not bad.empty:
            warnings.append(
                f"Column '{col}': {len(bad)} row(s) outside expected range [{lo}, {hi}]. "
                "Those rows have been removed."
            )
            df = df[(df[col] >= lo) & (df[col] <= hi)]

    if df.empty:
        errors.append("No valid rows remain after range filtering.")
        return df, errors, warnings

    # 6. PL > LL check
    invalid_pl = df[df["PL"] >= df["LL"]]
    if not invalid_pl.empty:
        warnings.append(
            f"{len(invalid_pl)} row(s) where PL ≥ LL were removed."
        )
        df = df[df["PL"] < df["LL"]]

    if df.empty:
        errors.append("No valid rows remain after PL ≥ LL check.")
        return df, errors, warnings

    # 7. Recalculate PI to ensure consistency
    pi_mismatch = df[abs(df["PI"] - (df["LL"] - df["PL"])) > 0.5]
    if not pi_mismatch.empty:
        warnings.append(
            f"{len(pi_mismatch)} row(s) had inconsistent PI — recalculated as LL − PL."
        )
    df["PI"] = df["LL"] - df["PL"]

    # 8. Duplicate rows
    dup_count = df.duplicated().sum()
    if dup_count > 0:
        warnings.append(f"{dup_count} duplicate row(s) removed.")
        df.drop_duplicates(inplace=True)

    df.reset_index(drop=True, inplace=True)
    return df, errors, warnings


def get_dataset_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """Return summary statistics for the dataset page."""
    def _rng(col):
        return {"min": round(float(df[col].min()), 3),
                "max": round(float(df[col].max()), 3),
                "mean": round(float(df[col].mean()), 3)}

    return {
        "num_records": int(len(df)),
        "LL":           _rng("LL"),
        "PL":           _rng("PL"),
        "PI":           _rng("PI"),
        "BA_Percentage":_rng("BA_Percentage"),
        "MDD":          _rng("MDD"),
        "OMC":          _rng("OMC"),
        "UCS":          _rng("UCS"),
        "CBR":          _rng("CBR"),
    }
