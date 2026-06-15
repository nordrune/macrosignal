"""CSV loading and validation for historical price data."""

from pathlib import Path

import polars as pl

REQUIRED_COLUMNS = {"date", "close"}


def load_price_data(csv_path: str | Path) -> pl.DataFrame:
    """Load historical prices from a CSV file.

    The returned data frame contains validated ``date`` and ``close`` columns,
    sorted by date in ascending order. Rows with invalid dates, missing close
    values, or non-positive close prices are skipped.

    Args:
        csv_path: Path to a CSV file containing at least ``date`` and ``close``.

    Returns:
        A validated polars data frame with ``date`` and ``close`` columns.

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
        raw_data = pl.read_csv(path, infer_schema_length=10_000)
    except pl.exceptions.NoDataError as exc:
        raise ValueError("CSV file is empty.") from exc
    except Exception as exc:
        raise ValueError("CSV file could not be parsed.") from exc

    if raw_data.height == 0 and not raw_data.columns:
        raise ValueError("CSV file is empty.")

    missing_columns = REQUIRED_COLUMNS.difference(raw_data.columns)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise ValueError(f"CSV file is missing required columns: {missing}")

    price_data = (
        raw_data.select("date", "close")
        .with_columns(
            pl.col("date").str.to_datetime(strict=False),
            pl.col("close").cast(pl.Float64, strict=False),
        )
        .filter(
            pl.col("date").is_not_null()
            & pl.col("close").is_not_null()
            & (pl.col("close") > 0)
        )
        .sort("date")
    )

    if price_data.is_empty():
        raise ValueError("CSV file contains no valid price rows.")

    return price_data
