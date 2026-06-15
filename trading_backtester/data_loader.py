"""CSV loading and validation for historical price data."""

from pathlib import Path

import pandas as pd

REQUIRED_COLUMNS = {"date", "close"}


def load_price_data(csv_path: str | Path) -> pd.DataFrame:
    """Load historical prices from a CSV file.

    The returned data frame contains validated ``date`` and ``close`` columns,
    sorted by date in ascending order. Rows with invalid dates, missing close
    values, or non-positive close prices are skipped.

    Args:
        csv_path: Path to a CSV file containing at least ``date`` and ``close``.

    Returns:
        A validated pandas data frame with ``date`` and ``close`` columns.

    Raises:
        FileNotFoundError: If the CSV file does not exist.
        ValueError: If the file is empty, malformed, missing required columns,
            or contains no valid price rows.
    """
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {path}")
    if not path.is_file():
        raise ValueError(f"CSV path is not a file: {path}")

    try:
        raw_data = pd.read_csv(path)
    except pd.errors.EmptyDataError as exc:
        raise ValueError("CSV file is empty.") from exc
    except pd.errors.ParserError as exc:
        raise ValueError("CSV file could not be parsed.") from exc

    missing_columns = REQUIRED_COLUMNS.difference(raw_data.columns)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise ValueError(f"CSV file is missing required columns: {missing}")

    price_data = raw_data.loc[:, ["date", "close"]].copy()
    price_data["date"] = pd.to_datetime(price_data["date"], errors="coerce")
    price_data["close"] = pd.to_numeric(price_data["close"], errors="coerce")

    valid_rows = (
        price_data["date"].notna()
        & price_data["close"].notna()
        & (price_data["close"] > 0)
    )
    price_data = price_data.loc[valid_rows].copy()

    if price_data.empty:
        raise ValueError("CSV file contains no valid price rows.")

    return price_data.sort_values("date").reset_index(drop=True)
