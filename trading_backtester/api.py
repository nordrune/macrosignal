"""Litestar routes for the MacroSignal dashboard.

The API accepts either Yahoo Finance ticker settings or custom CSV-derived
prices from the browser. Route handlers keep validation and loading separate
from the core backtester so the simulation can also be used from the CLI.
"""

import logging
from datetime import datetime
from typing import Any, NoReturn

import polars as pl
import yfinance as yf
from litestar import Litestar, get, post
from litestar.exceptions import HTTPException
from litestar.status_codes import HTTP_200_OK

from trading_backtester.backtester import (
    optimize_strategy_parameters,
    run_backtest,
)
from trading_backtester.dto import (
    BacktestRequest,
    BacktestResponse,
    OptimizeRequest,
    OptimizeResponse,
    PricePoint,
    PriceSourceRequest,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MAX_PRICE_POINTS = 10_000


class TickerNotFoundError(ValueError):
    """Raised when Yahoo Finance returns no rows for a symbol."""


class TickerDataInvalidError(ValueError):
    """Raised when fetched ticker data has no usable close prices."""


def _normalise_price_frame(data: pl.DataFrame) -> pl.DataFrame:
    """Validate and sort price data before passing it into the backtester."""
    if data.is_empty():
        raise ValueError("Price data must contain at least one row.")

    date_expr = (
        pl.col("date").str.to_datetime(strict=False)
        if data.schema["date"] == pl.Utf8
        else pl.col("date").cast(pl.Datetime, strict=False)
    )
    frame = (
        data.select("date", "close")
        .with_columns(
            date_expr,
            pl.col("close").cast(pl.Float64, strict=False),
        )
        .drop_nulls()
        .filter(pl.col("close") > 0)
        .sort("date")
    )

    if frame.is_empty():
        raise ValueError("Price data contains no valid positive close prices.")

    return frame


def _frame_from_price_points(prices: list[PricePoint]) -> pl.DataFrame:
    """Convert uploaded or pasted price points to a validated polars frame."""
    if len(prices) > MAX_PRICE_POINTS:
        raise ValueError(
            f"At most {MAX_PRICE_POINTS} price points allowed per request."
        )
    rows = [{"date": point.date, "close": point.close} for point in prices]
    return _normalise_price_frame(pl.DataFrame(rows))


def _handle_route_error(
    exc: Exception,
    *,
    validation_log: str,
    server_log: str,
    server_prefix: str,
) -> NoReturn:
    """Map domain errors to Litestar HTTP responses."""
    if isinstance(exc, HTTPException):
        raise exc
    if isinstance(exc, ValueError):
        logger.info(validation_log, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    logger.exception(server_log)
    raise HTTPException(
        status_code=500, detail=f"{server_prefix}{exc}"
    ) from exc


def _naive_datetime(value: object) -> datetime:
    """Strip timezone info from yfinance timestamps without importing pandas."""
    converter = getattr(value, "to_pydatetime", None)
    if callable(converter):
        value = converter()
    if isinstance(value, datetime) and value.tzinfo is not None:
        return value.replace(tzinfo=None)
    if not isinstance(value, datetime):
        raise TypeError(f"Expected datetime-like value, got {type(value)!r}")
    return value


def _fetch_yahoo_prices(
    symbol: str,
    period: str = "1y",
    interval: str = "1d",
) -> dict[str, Any]:
    """Fetch historical close prices for a symbol from Yahoo Finance.

    Raises:
        TickerNotFoundError: When Yahoo Finance returns no rows.
        TickerDataInvalidError: When fetched data has no usable prices.
    """
    logger.info(
        "Fetching history for: %s (period=%s, interval=%s)",
        symbol,
        period,
        interval,
    )
    ticker = yf.Ticker(symbol)
    # ponytail: yfinance returns pandas; extract rows, no pandas import
    hist = ticker.history(period=period, interval=interval)
    if hist.empty:
        raise TickerNotFoundError(
            f"No market data returned for symbol '{symbol}'. "
            "Verify the symbol name."
        )

    raw = hist.reset_index()
    date_col = None
    for col in ["Date", "Datetime", "date", "datetime"]:
        if col in raw.columns:
            date_col = col
            break
    if date_col is None:
        date_col = raw.columns[0]

    if "Close" not in raw.columns:
        raise TickerDataInvalidError(
            f"Data retrieved for '{symbol}' contains no valid prices."
        )

    date_format = "%Y-%m-%d %H:%M:%S" if interval.endswith("h") else "%Y-%m-%d"
    records: list[dict[str, object]] = []
    for _, row in raw.iterrows():
        close = row["Close"]
        if close != close:
            continue
        close_value = float(close)
        if close_value <= 0:
            continue
        date_value = _naive_datetime(row[date_col])
        records.append(
            {
                "date": date_value.strftime(date_format),
                "close": close_value,
            }
        )

    if not records:
        raise TickerDataInvalidError(
            f"Data retrieved for '{symbol}' contains no valid prices."
        )

    if len(records) > MAX_PRICE_POINTS:
        records = records[-MAX_PRICE_POINTS:]
    return {"symbol": symbol.upper(), "prices": records}


def _load_price_frame(source: PriceSourceRequest) -> pl.DataFrame:
    """Load prices from custom points or Yahoo Finance, then validate them."""
    if source.prices:
        return _frame_from_price_points(source.prices)
    if source.symbol:
        ticker_data = _fetch_yahoo_prices(
            symbol=source.symbol,
            period=source.period,
            interval=source.interval,
        )
        return _normalise_price_frame(pl.DataFrame(ticker_data["prices"]))
    raise HTTPException(
        status_code=400,
        detail="Either 'prices' or 'symbol' must be provided.",
    )


@get("/health")
async def health() -> dict[str, str]:
    """Liveness probe for devenv and deploy health checks."""
    return {"status": "ok"}


@get("/api/ticker")
async def get_ticker_data(
    symbol: str,
    period: str = "1y",
    interval: str = "1d",
) -> dict[str, Any]:
    """Fetch historical close prices for a symbol from Yahoo Finance."""
    try:
        return _fetch_yahoo_prices(
            symbol=symbol, period=period, interval=interval
        )
    except TickerNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TickerDataInvalidError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Error fetching ticker %s", symbol)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch market data from Yahoo Finance: {exc}",
        ) from exc


@post("/api/backtest", status_code=HTTP_200_OK)
async def execute_backtest(data: BacktestRequest) -> BacktestResponse:
    """Run a multi-strategy backtest on fetched or uploaded price data."""
    try:
        price_frame = _load_price_frame(data)
        fee_rate = data.transaction_fee_percent / 100.0
        result = run_backtest(
            price_data=price_frame,
            starting_capital=data.starting_capital,
            transaction_fee_rate=fee_rate,
            strategy_type=data.strategy_type,
            **data.strategy_params,
        )
        return BacktestResponse.from_result(result)
    except Exception as exc:
        _handle_route_error(
            exc,
            validation_log="Validation error in backtest: %s",
            server_log="Error running backtest",
            server_prefix="Backtester error: ",
        )


@post("/api/optimize", status_code=HTTP_200_OK)
async def optimize_strategy(data: OptimizeRequest) -> OptimizeResponse:
    """Run a parameter sweep and return the top five configurations."""
    try:
        price_frame = _load_price_frame(data)
        fee_rate = data.transaction_fee_percent / 100.0
        best_runs = optimize_strategy_parameters(
            price_data=price_frame,
            starting_capital=data.starting_capital,
            transaction_fee_rate=fee_rate,
            strategy_type=data.strategy_type,
        )
        return OptimizeResponse(
            strategy_type=data.strategy_type,
            runs=best_runs,
        )
    except Exception as exc:
        _handle_route_error(
            exc,
            validation_log="Validation error in optimization: %s",
            server_log="Error running optimization",
            server_prefix="Optimizer error: ",
        )


# ponytail: API-only app; SvelteKit/Bun serves the dashboard in web/
app = Litestar(
    route_handlers=[
        health,
        get_ticker_data,
        execute_backtest,
        optimize_strategy,
    ],
    openapi_config=None,
)
