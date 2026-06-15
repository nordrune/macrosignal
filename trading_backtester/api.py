"""Litestar routes for the MacroSignal dashboard.

The API accepts either Yahoo Finance ticker settings or custom CSV-derived
prices from the browser. Route handlers keep validation and loading separate
from the core backtester so the simulation can also be used from the CLI.
"""

import logging
from typing import Any

import pandas as pd
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


class TickerNotFoundError(ValueError):
    """Raised when Yahoo Finance returns no rows for a symbol."""


class TickerDataInvalidError(ValueError):
    """Raised when fetched ticker data has no usable close prices."""


def _normalise_price_frame(data: pd.DataFrame) -> pd.DataFrame:
    """Validate and sort price data before passing it into the backtester."""
    if data.empty:
        raise ValueError("Price data must contain at least one row.")

    frame = data.loc[:, ["date", "close"]].copy()
    frame["date"] = pd.to_datetime(frame["date"])
    frame["close"] = pd.to_numeric(frame["close"])
    frame = frame.dropna()
    frame = frame[frame["close"] > 0]

    if frame.empty:
        raise ValueError("Price data contains no valid positive close prices.")

    return frame.sort_values("date").reset_index(drop=True)


def _frame_from_price_points(prices: list[PricePoint]) -> pd.DataFrame:
    """Convert uploaded or pasted price points to a validated pandas frame."""
    rows = [{"date": point.date, "close": point.close} for point in prices]
    return _normalise_price_frame(pd.DataFrame(rows))


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
    df = ticker.history(period=period, interval=interval)
    if df.empty:
        raise TickerNotFoundError(
            f"No market data returned for symbol '{symbol}'. "
            "Verify the symbol name."
        )

    df = df.reset_index()

    date_col = None
    for col in ["Date", "Datetime", "date", "datetime"]:
        if col in df.columns:
            date_col = col
            break
    if date_col is None:
        date_col = df.columns[0]

    df = df.rename(columns={date_col: "date", "Close": "close"})
    df = df[["date", "close"]].copy()

    df["date"] = pd.to_datetime(df["date"])
    if df["date"].dt.tz is not None:
        df["date"] = df["date"].dt.tz_localize(None)

    df = df.dropna()
    df = df[df["close"] > 0]

    if df.empty:
        raise TickerDataInvalidError(
            f"Data retrieved for '{symbol}' contains no valid prices."
        )

    date_format = "%Y-%m-%d %H:%M:%S" if interval.endswith("h") else "%Y-%m-%d"
    records = []
    for _, row in df.iterrows():
        records.append(
            {
                "date": row["date"].strftime(date_format),
                "close": float(row["close"]),
            }
        )
    return {"symbol": symbol.upper(), "prices": records}


def _load_price_frame(source: PriceSourceRequest) -> pd.DataFrame:
    """Load prices from custom points or Yahoo Finance, then validate them."""
    if source.prices:
        return _frame_from_price_points(source.prices)
    if source.symbol:
        ticker_data = _fetch_yahoo_prices(
            symbol=source.symbol,
            period=source.period,
            interval=source.interval,
        )
        return _normalise_price_frame(pd.DataFrame(ticker_data["prices"]))
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
    except HTTPException:
        raise
    except ValueError as exc:
        logger.info("Validation error in backtest: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Error running backtest")
        raise HTTPException(
            status_code=500, detail=f"Backtester error: {exc}"
        ) from exc


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
    except HTTPException:
        raise
    except ValueError as exc:
        logger.info("Validation error in optimization: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Error running optimization")
        raise HTTPException(
            status_code=500, detail=f"Optimizer error: {exc}"
        ) from exc


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
