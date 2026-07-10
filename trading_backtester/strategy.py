"""Technical indicators and strategy signal generation.

Each strategy receives a price frame with a ``close`` column and returns a copy
with indicator columns plus a normalised ``signal`` column. The backtester uses
only that signal column, while the dashboard also reads the indicator columns
for chart overlays.
"""

import math
from collections.abc import Callable
from typing import Any

import polars as pl

from trading_backtester.models import (
    Signal,
    StrategyType,
    normalize_strategy_type,
)

DEFAULT_MOVING_AVERAGE_WINDOW = 20

# Functional Registry Pattern
StrategyFunc = Callable[..., pl.DataFrame]


class StrategyRegistry:
    def __init__(self) -> None:
        self._registry: dict[str, StrategyFunc] = {}

    def register(self, name: str) -> Callable[[StrategyFunc], StrategyFunc]:
        def decorator(func: StrategyFunc) -> StrategyFunc:
            self._registry[name.lower().strip()] = func
            return func
        return decorator

    def get(self, name: str) -> StrategyFunc:
        key = name.lower().strip()
        if key not in self._registry:
            raise ValueError(f"Unknown strategy type: {name}")
        return self._registry[key]

    @property
    def supported_strategies(self) -> set[str]:
        return set(self._registry.keys())


registry = StrategyRegistry()


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


@registry.register("sma")
def _sma_signals(price_data: pl.DataFrame, **kwargs: Any) -> pl.DataFrame:
    """Build SMA indicator and signal columns."""
    window = kwargs.get("window", DEFAULT_MOVING_AVERAGE_WINDOW)
    if window < 1:
        raise ValueError("Window must be at least 1.")
    moving_average = pl.col("close").rolling_mean(
        window_size=window, min_samples=window
    )
    has_average = moving_average.is_not_null()
    return price_data.with_columns(
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
    )


@registry.register("ema")
def _ema_signals(price_data: pl.DataFrame, **kwargs: Any) -> pl.DataFrame:
    """Build EMA indicator and signal columns."""
    window = kwargs.get("window", DEFAULT_MOVING_AVERAGE_WINDOW)
    if window < 1:
        raise ValueError("Window must be at least 1.")
    moving_average = pl.col("close").ewm_mean(span=window, adjust=False)
    has_average = pl.arange(0, pl.len()).over(pl.lit(1)) >= (window - 1)
    return price_data.with_columns(
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
    )


@registry.register("rsi")
def _rsi_signals(price_data: pl.DataFrame, **kwargs: Any) -> pl.DataFrame:
    """Build RSI indicator and signal columns."""
    window = kwargs.get("window", 14)
    oversold = kwargs.get("oversold", 30.0)
    overbought = kwargs.get("overbought", 70.0)
    if window < 1:
        raise ValueError("Window must be at least 1.")

    change = pl.col("close").diff()
    gain = pl.when(change > 0).then(change).otherwise(0.0)
    loss = pl.when(change < 0).then(-change).otherwise(0.0)

    # Wilder's smoothing is equivalent to an EMA with span = 2 * window - 1
    avg_gain = gain.ewm_mean(span=2 * window - 1, adjust=False)
    avg_loss = loss.ewm_mean(span=2 * window - 1, adjust=False)

    rs = avg_gain / avg_loss
    rsi = (
        pl.when(avg_loss == 0)
        .then(100.0)
        .otherwise(100.0 - (100.0 / (1.0 + rs)))
    )
    has_enough_data = pl.arange(0, pl.len()).over(pl.lit(1)) >= window

    return price_data.with_columns(
        # Prevent chart scaling distortion
        pl.lit(None, dtype=pl.Float64).alias("moving_average"),
        rsi.alias("rsi"),
        (
            pl.when(~has_enough_data)
            .then(pl.lit(Signal.HOLD))
            .when(rsi < oversold)
            .then(pl.lit(Signal.BUY))
            .when(rsi > overbought)
            .then(pl.lit(Signal.SELL))
            .otherwise(pl.lit(Signal.HOLD))
            .alias("signal")
        ),
    )


@registry.register("macd")
def _macd_signals(price_data: pl.DataFrame, **kwargs: Any) -> pl.DataFrame:
    """Build MACD indicator and signal columns."""
    fast_window = kwargs.get("window", 12)
    slow_window = kwargs.get("slow_window", round(fast_window * 26 / 12))
    signal_window = kwargs.get("signal_window", round(fast_window * 9 / 12))

    slow_window = max(slow_window, fast_window + 1)
    signal_window = max(signal_window, 1)

    fast_ema = pl.col("close").ewm_mean(span=fast_window, adjust=False)
    slow_ema = pl.col("close").ewm_mean(span=slow_window, adjust=False)
    macd = fast_ema - slow_ema
    signal_line = macd.ewm_mean(span=signal_window, adjust=False)

    has_enough_data = pl.arange(0, pl.len()).over(pl.lit(1)) >= (
        slow_window + signal_window - 2
    )

    return price_data.with_columns(
        # Prevent chart scaling distortion
        pl.lit(None, dtype=pl.Float64).alias("moving_average"),
        macd.alias("macd_line"),
        signal_line.alias("macd_signal"),
        (
            pl.when(~has_enough_data)
            .then(pl.lit(Signal.HOLD))
            .when(macd > signal_line)
            .then(pl.lit(Signal.BUY))
            .when(macd < signal_line)
            .then(pl.lit(Signal.SELL))
            .otherwise(pl.lit(Signal.HOLD))
            .alias("signal")
        ),
    )


@registry.register("bollinger")
def _bollinger_signals(price_data: pl.DataFrame, **kwargs: Any) -> pl.DataFrame:
    """Build Bollinger Bands indicator and signal columns."""
    window = kwargs.get("window", 20)
    num_std = kwargs.get("num_std", 2.0)
    if window < 1:
        raise ValueError("Window must be at least 1.")

    mid_band = pl.col("close").rolling_mean(
        window_size=window, min_samples=window
    )
    std_dev = pl.col("close").rolling_std(
        window_size=window, min_samples=window
    )
    upper_band = mid_band + (std_dev * num_std)
    lower_band = mid_band - (std_dev * num_std)

    has_enough_data = mid_band.is_not_null() & std_dev.is_not_null()

    return price_data.with_columns(
        mid_band.alias("moving_average"),  # Price-scaled Middle Band overlay
        upper_band.alias("bollinger_upper"),
        lower_band.alias("bollinger_lower"),
        (
            pl.when(~has_enough_data)
            .then(pl.lit(Signal.HOLD))
            .when(pl.col("close") < lower_band)
            .then(pl.lit(Signal.BUY))
            .when(pl.col("close") > upper_band)
            .then(pl.lit(Signal.SELL))
            .otherwise(pl.lit(Signal.HOLD))
            .alias("signal")
        ),
    )


@registry.register("crossover")
def _crossover_signals(price_data: pl.DataFrame, **kwargs: Any) -> pl.DataFrame:
    """Build Dual Moving Average Crossover indicator and signal columns."""
    fast_window = kwargs.get("window", 20)
    slow_window = kwargs.get("slow_window", fast_window * 3)

    fast_sma = pl.col("close").rolling_mean(
        window_size=fast_window, min_samples=fast_window
    )
    slow_sma = pl.col("close").rolling_mean(
        window_size=slow_window, min_samples=slow_window
    )

    has_enough_data = slow_sma.is_not_null()

    return price_data.with_columns(
        slow_sma.alias("moving_average"),  # Slow SMA overlay
        fast_sma.alias("fast_sma"),
        (
            pl.when(~has_enough_data)
            .then(pl.lit(Signal.HOLD))
            .when(fast_sma > slow_sma)
            .then(pl.lit(Signal.BUY))
            .when(fast_sma < slow_sma)
            .then(pl.lit(Signal.SELL))
            .otherwise(pl.lit(Signal.HOLD))
            .alias("signal")
        ),
    )


SUPPORTED_STRATEGIES = registry.supported_strategies


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
    strategy_func = registry.get(strategy)
    return strategy_func(price_data, **kwargs)
