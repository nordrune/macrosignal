"""FastAPI web server for the trading backtester."""

import logging
from dataclasses import asdict
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import pandas as pd
import yfinance as yf

from trading_backtester.backtester import run_backtest, optimize_strategy_parameters


# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MacroSignal Pro API",
    description="Backend API for real-time market data retrieval and multi-strategy backtesting.",
    version="1.0.0",
)

# Enable CORS for local testing/development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PricePoint(BaseModel):
    date: str
    close: float


class BacktestRequest(BaseModel):
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
        default="sma", description="Trading strategy type ('sma', 'ema', 'rsi', 'macd', 'bollinger')."
    )
    strategy_params: dict[str, Any] = Field(
        default_factory=dict, description="Key-value parameters for strategy configuration."
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

        # Find date column dynamically
        date_col = None
        for col in ["Date", "Datetime", "date", "datetime"]:
            if col in df.columns:
                date_col = col
                break
        if date_col is None:
            date_col = df.columns[0]

        df = df.rename(columns={date_col: "date", "Close": "close"})
        df = df[["date", "close"]].copy()

        # Format dates
        df["date"] = pd.to_datetime(df["date"])
        # Remove timezone info for clean rendering
        if df["date"].dt.tz is not None:
            df["date"] = df["date"].dt.tz_localize(None)

        df = df.dropna()
        df = df[df["close"] > 0]

        if df.empty:
            raise HTTPException(
                status_code=400,
                detail=f"Data retrieved for '{symbol}' contains no valid prices.",
            )

        # Convert to response format
        records = []
        for _, row in df.iterrows():
            records.append({
                "date": row["date"].strftime("%Y-%m-%d %H:%M:%S" if interval == "1h" else "%Y-%m-%d"),
                "close": float(row["close"]),
            })
        return {"symbol": symbol.upper(), "prices": records}

    except Exception as e:
        logger.error(f"Error fetching ticker {symbol}: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch market data from Yahoo Finance: {str(e)}",
        )


@app.post("/api/backtest")
def execute_backtest(request: BacktestRequest):
    """Run a multi-strategy backtest on fetched or uploaded price data."""
    try:
        if request.prices:
            # Parse custom prices list
            df = pd.DataFrame([p.model_dump() for p in request.prices])
            df["date"] = pd.to_datetime(df["date"])
            df["close"] = pd.to_numeric(df["close"])
        elif request.symbol:
            # Fetch from Yahoo Finance
            ticker_data = get_ticker_data(
                symbol=request.symbol, period=request.period, interval=request.interval
            )
            df = pd.DataFrame(ticker_data["prices"])
            df["date"] = pd.to_datetime(df["date"])
            df["close"] = pd.to_numeric(df["close"])
        else:
            raise HTTPException(
                status_code=400,
                detail="Either 'prices' or 'symbol' must be provided in request.",
            )

        fee_rate = request.transaction_fee_percent / 100.0
        result = run_backtest(
            price_data=df,
            starting_capital=request.starting_capital,
            transaction_fee_rate=fee_rate,
            strategy_type=request.strategy_type,
            **request.strategy_params,
        )

        return asdict(result)

    except ValueError as e:
        logger.error(f"Validation error in backtest: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error running backtest: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Backtester error: {str(e)}")


class OptimizeRequest(BaseModel):
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
        if request.prices:
            df = pd.DataFrame([p.model_dump() for p in request.prices])
            df["date"] = pd.to_datetime(df["date"])
            df["close"] = pd.to_numeric(df["close"])
        elif request.symbol:
            ticker_data = get_ticker_data(
                symbol=request.symbol, period=request.period, interval=request.interval
            )
            df = pd.DataFrame(ticker_data["prices"])
            df["date"] = pd.to_datetime(df["date"])
            df["close"] = pd.to_numeric(df["close"])
        else:
            raise HTTPException(
                status_code=400,
                detail="Either 'prices' or 'symbol' must be provided.",
            )

        fee_rate = request.transaction_fee_percent / 100.0
        best_runs = optimize_strategy_parameters(
            price_data=df,
            starting_capital=request.starting_capital,
            transaction_fee_rate=fee_rate,
            strategy_type=request.strategy_type,
        )

        return {"strategy_type": request.strategy_type, "runs": best_runs}

    except ValueError as e:
        logger.error(f"Validation error in optimization: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error running optimization: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Optimizer error: {str(e)}")


# Serve static web frontend
try:
    app.mount("/", StaticFiles(directory="frontend", html=True), name="static")
except Exception as e:
    logger.warning(f"Could not mount static files directory: {e}. API endpoints remain active.")
