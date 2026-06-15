"""Technical indicators and strategy signal generation.

Each strategy receives a price frame with a ``close`` column and returns a copy
with indicator columns plus a normalised ``signal`` column. The backtester uses
only that signal column, while the dashboard also reads the indicator columns
for chart overlays.
"""

import math
from typing import Any

import polars as pl

from trading_backtester.models import (
    Signal,
    StrategyType,
    normalize_strategy_type,
)

DEFAULT_MOVING_AVERAGE_WINDOW = 20
SUPPORTED_STRATEGIES = {strategy.value for strategy in StrategyType}


def calculate_moving_average(
    close_prices: pl.Series,
    window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
) -> pl.Series:
    """Calculate a simple moving average for close prices.

    Args:
        close_prices: Series of historical close prices.
        window: Number of data points used in the moving average.

    Returns:
        A polars series containing the moving average. Values before enough
        data exists for the window are returned as missing values.

    Raises:
        ValueError: If ``window`` is less than one.
    """
    if window < 1:
        raise ValueError("Moving average window must be at least 1.")

    return close_prices.rolling_mean(window_size=window, min_samples=window)


def calculate_ema(
    close_prices: pl.Series,
    window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
) -> pl.Series:
    """Calculate the exponential moving average (EMA) for close prices.

    EMA reacts faster to recent price changes than a simple moving average
    because newer values receive more weight.
    """
    if window < 1:
        raise ValueError("EMA window must be at least 1.")
    return close_prices.ewm_mean(span=window, adjust=False)


def generate_signal(close_price: float, moving_average: float) -> Signal:
    """Generate a trading signal from the current price and moving average.

    Args:
        close_price: Current close price.
        moving_average: Current simple moving average value.

    Returns:
        ``Signal.BUY`` when price is above the moving average,
        ``Signal.SELL`` when price is below it, and ``Signal.HOLD`` otherwise.
    """
    if math.isnan(moving_average):
        return Signal.HOLD
    if close_price > moving_average:
        return Signal.BUY
    if close_price < moving_average:
        return Signal.SELL
    return Signal.HOLD


def _sma_signals(window: int) -> list[pl.Expr]:
    """Build SMA indicator and signal columns."""
    moving_average = pl.col("close").rolling_mean(
        window_size=window, min_samples=window
    )
    has_average = moving_average.is_not_null()
    return [
        moving_average.alias("moving_average"),
        (
            pl.when(~has_average)
            .then(pl.lit(Signal.HOLD))
            .when(pl.col("close") > moving_average)
            .then(pl.lit(Signal.BUY))
            .when(pl.col("close") < moving_average)
            .then(pl.lit(Signal.SELL))
            .otherwise(pl.lit(Signal.HOLD))
            .alias("signal")
        ),
    ]


def _ema_signals(window: int) -> list[pl.Expr]:
    """Build EMA indicator and signal columns."""
    moving_average = pl.col("close").ewm_mean(span=window, adjust=False)
    return [
        moving_average.alias("moving_average"),
        (
            pl.when(pl.col("close") > moving_average)
            .then(pl.lit(Signal.BUY))
            .when(pl.col("close") < moving_average)
            .then(pl.lit(Signal.SELL))
            .otherwise(pl.lit(Signal.HOLD))
            .alias("signal")
        ),
    ]


def generate_strategy_signals(
    price_data: pl.DataFrame,
    strategy_type: str | StrategyType = StrategyType.SMA,
    **kwargs: Any,
) -> pl.DataFrame:
    """Generate indicators and buy/sell/hold signals for a selected strategy.

    Args:
        price_data: Data frame with a numeric ``close`` column.
        strategy_type: Strategy to apply.
        **kwargs: Strategy-specific parameters, for example ``window`` for SMA
            and EMA.

    Returns:
        Copy of ``price_data`` with indicator columns and a ``signal`` column.

    Raises:
        ValueError: If the strategy type is unknown or parameters are invalid.
    """
    strategy = normalize_strategy_type(strategy_type)
    if strategy not in SUPPORTED_STRATEGIES:
        raise ValueError(f"Unknown strategy type: {strategy_type}")

    window = kwargs.get("window", 20)

    if strategy == StrategyType.SMA.value:
        return price_data.with_columns(_sma_signals(window))

    if strategy == StrategyType.EMA.value:
        return price_data.with_columns(_ema_signals(window))

    raise ValueError(f"Unknown strategy type: {strategy_type}")
