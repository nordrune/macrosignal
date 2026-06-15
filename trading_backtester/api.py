"""FastAPI routes for the MacroSignal dashboard.

The API accepts either Yahoo Finance ticker settings or custom CSV-derived
prices from the browser. Route handlers keep validation and loading separate
from the core backtester so the simulation can also be used from the CLI.
"""

import logging
from dataclasses import asdict
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import pandas as pd
import yfinance as yf

from trading_backtester.backtester import optimize_strategy_parameters, run_backtest


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

STRATEGY_DESCRIPTION = "'sma' or 'ema'"

app = FastAPI(
    title="MacroSignal API",
    description="Backend for historical market data and strategy backtesting.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PricePoint(BaseModel):
    """Single close-price observation sent by the frontend."""

    date: str
    close: float


class BacktestRequest(BaseModel):
    """Request body for one dashboard backtest run."""

    prices: list[PricePoint] | None = Field(
        default=None, description="Optional custom price timeseries (for CSV upload)."
    )
    symbol: str | None = Field(
        default=None, description="Yahoo Finance ticker symbol (e.g., 'AAPL', 'BTC-USD')."
    )
    period: str = Field(
        default="1y", description="History period to fetch (e.g., '1mo', '3mo', '6mo', '1y', 'max')."
    )
    interval: str = Field(
        default="1d", description="Bar interval (e.g., '1h', '1d', '1wk')."
    )
    starting_capital: float = Field(
        default=10000.0, gt=0, description="Virtual starting capital."
    )
    transaction_fee_percent: float = Field(
        default=0.1, ge=0, description="Transaction fee percentage (0.1 means 0.1%)."
    )
    strategy_type: str = Field(
        default="sma",
        description=f"Trading strategy type ({STRATEGY_DESCRIPTION}).",
    )
    strategy_params: dict[str, Any] = Field(
        default_factory=dict, description="Key-value parameters for strategy configuration."
    )


def _point_to_dict(point: PricePoint) -> dict[str, Any]:
    """Return a dict for both Pydantic v1 and v2 model instances."""
    if hasattr(point, "model_dump"):
        return point.model_dump()
    return point.dict()


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
    return _normalise_price_frame(pd.DataFrame([_point_to_dict(point) for point in prices]))


def _load_price_frame(
    prices: list[PricePoint] | None,
    symbol: str | None,
    period: str,
    interval: str,
) -> pd.DataFrame:
    """Load prices from custom points or Yahoo Finance, then validate them."""
    if prices:
        return _frame_from_price_points(prices)
    if symbol:
        ticker_data = get_ticker_data(symbol=symbol, period=period, interval=interval)
        return _normalise_price_frame(pd.DataFrame(ticker_data["prices"]))
    raise HTTPException(
        status_code=400,
        detail="Either 'prices' or 'symbol' must be provided.",
    )


@app.get("/api/ticker")
def get_ticker_data(symbol: str, period: str = "1y", interval: str = "1d"):
    """Fetch historical close prices for a symbol from Yahoo Finance."""
    logger.info(f"Fetching history for: {symbol} (period={period}, interval={interval})")
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        if df.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No market data returned for symbol '{symbol}'. Verify the symbol name.",
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
            raise HTTPException(
                status_code=400,
                detail=f"Data retrieved for '{symbol}' contains no valid prices.",
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

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error fetching ticker %s", symbol)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch market data from Yahoo Finance: {exc}",
        ) from exc


@app.post("/api/backtest")
def execute_backtest(request: BacktestRequest):
    """Run a multi-strategy backtest on fetched or uploaded price data."""
    try:
        price_frame = _load_price_frame(
            prices=request.prices,
            symbol=request.symbol,
            period=request.period,
            interval=request.interval,
        )
        fee_rate = request.transaction_fee_percent / 100.0
        result = run_backtest(
            price_data=price_frame,
            starting_capital=request.starting_capital,
            transaction_fee_rate=fee_rate,
            strategy_type=request.strategy_type,
            **request.strategy_params,
        )

        return asdict(result)

    except HTTPException:
        raise
    except ValueError as exc:
        logger.info("Validation error in backtest: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Error running backtest")
        raise HTTPException(status_code=500, detail=f"Backtester error: {exc}") from exc


class OptimizeRequest(BaseModel):
    """Request body for the parameter search endpoint."""

    prices: list[PricePoint] | None = Field(default=None)
    symbol: str | None = Field(default=None)
    period: str = "1y"
    interval: str = "1d"
    starting_capital: float = 10000.0
    transaction_fee_percent: float = 0.1
    strategy_type: str = "sma"


@app.post("/api/optimize")
def optimize_strategy(request: OptimizeRequest):
    """Run a parameter sweep grid search and return the top 5 parameter configurations."""
    try:
        price_frame = _load_price_frame(
            prices=request.prices,
            symbol=request.symbol,
            period=request.period,
            interval=request.interval,
        )
        fee_rate = request.transaction_fee_percent / 100.0
        best_runs = optimize_strategy_parameters(
            price_data=price_frame,
            starting_capital=request.starting_capital,
            transaction_fee_rate=fee_rate,
            strategy_type=request.strategy_type,
        )

        return {"strategy_type": request.strategy_type, "runs": best_runs}

    except HTTPException:
        raise
    except ValueError as exc:
        logger.info("Validation error in optimization: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Error running optimization")
        raise HTTPException(status_code=500, detail=f"Optimizer error: {exc}") from exc


try:
    app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
except Exception as exc:
    logger.warning(
        "Could not mount static files directory: %s. API endpoints remain active.",
        exc,
    )
