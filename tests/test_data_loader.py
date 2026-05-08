"""Tests for CSV loading and validation."""

import pandas as pd
import pytest

from trading_backtester.data_loader import load_price_data


def test_load_price_data_with_valid_csv(tmp_path):
    """Valid CSV data is loaded, converted, and sorted by date."""
    csv_file = tmp_path / "prices.csv"
    csv_file.write_text(
        "date,close\n"
        "2024-01-03,102.50\n"
        "2024-01-01,100.00\n"
        "2024-01-02,101.25\n",
        encoding="utf-8",
    )

    price_data = load_price_data(csv_file)

    assert list(price_data["close"]) == [100.00, 101.25, 102.50]
    assert pd.api.types.is_datetime64_any_dtype(price_data["date"])


def test_load_price_data_rejects_missing_required_columns(tmp_path):
    """CSV files without date and close columns are rejected."""
    csv_file = tmp_path / "prices.csv"
    csv_file.write_text(
        "date,open\n2024-01-01,100.00\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="missing required columns"):
        load_price_data(csv_file)
