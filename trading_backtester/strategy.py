"""Technical indicators and strategy signal generation.

Each strategy receives a price frame with a ``close`` column and returns a copy
with indicator columns plus a normalised ``signal`` column. The backtester uses
only that signal column, while the dashboard also reads the indicator columns
for chart overlays.
"""

import pandas as pd

from trading_backtester.models import Signal, StrategyType


DEFAULT_MOVING_AVERAGE_WINDOW = 20
SUPPORTED_STRATEGIES = {strategy.value for strategy in StrategyType}


def _normalise_strategy_type(strategy_type: str | StrategyType) -> str:
    """Return the lowercase strategy value used internally."""
    if isinstance(strategy_type, StrategyType):
        return strategy_type.value
    return str(strategy_type).strip().lower()


def _assign_signals(
    data: pd.DataFrame,
    buy_condition: pd.Series,
    sell_condition: pd.Series,
) -> None:
    """Write buy and sell signals into a strategy data frame in place."""
    data.loc[buy_condition, "signal"] = Signal.BUY
    data.loc[sell_condition, "signal"] = Signal.SELL


def calculate_moving_average(
    close_prices: pd.Series,
    window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
) -> pd.Series:
    """Calculate a simple moving average for close prices.

    Args:
        close_prices: Series of historical close prices.
        window: Number of data points used in the moving average.

    Returns:
        A pandas series containing the moving average. Values before enough
        data exists for the window are returned as missing values.

    Raises:
        ValueError: If ``window`` is less than one.
    """
    if window < 1:
        raise ValueError("Moving average window must be at least 1.")

    return close_prices.rolling(window=window, min_periods=window).mean()


def calculate_ema(
    close_prices: pd.Series,
    window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
) -> pd.Series:
    """Calculate the exponential moving average (EMA) for close prices.

    EMA reacts faster to recent price changes than a simple moving average
    because newer values receive more weight.
    """
    if window < 1:
        raise ValueError("EMA window must be at least 1.")
    return close_prices.ewm(span=window, adjust=False).mean()


def generate_signal(close_price: float, moving_average: float) -> Signal:
    """Generate a trading signal from the current price and moving average.

    Args:
        close_price: Current close price.
        moving_average: Current simple moving average value.

    Returns:
        ``Signal.BUY`` when price is above the moving average,
        ``Signal.SELL`` when price is below it, and ``Signal.HOLD`` otherwise.
    """
    if pd.isna(moving_average):
        return Signal.HOLD
    if close_price > moving_average:
        return Signal.BUY
    if close_price < moving_average:
        return Signal.SELL
    return Signal.HOLD


def generate_strategy_signals(
    price_data: pd.DataFrame,
    strategy_type: str | StrategyType = StrategyType.SMA,
    **kwargs,
) -> pd.DataFrame:
    """Generate indicators and buy/sell/hold signals for a selected strategy.

    Args:
        price_data: Data frame with a numeric ``close`` column.
        strategy_type: Strategy to apply.
        **kwargs: Strategy-specific parameters, for example ``window`` for SMA
            and EMA.

    Returns:
        Copy of ``price_data`` with indicator columns and a string ``signal`` column.

    Raises:
        ValueError: If the strategy type is unknown or indicator parameters are invalid.
    """
    strategy = _normalise_strategy_type(strategy_type)
    if strategy not in SUPPORTED_STRATEGIES:
        raise ValueError(f"Unknown strategy type: {strategy_type}")

    data = price_data.copy()
    close = data["close"]
    data["signal"] = Signal.HOLD

    if strategy == StrategyType.SMA.value:
        window = kwargs.get("window", 20)
        data["moving_average"] = calculate_moving_average(close, window)
        has_average = data["moving_average"].notna()
        _assign_signals(
            data,
            buy_condition=has_average & (close > data["moving_average"]),
            sell_condition=has_average & (close < data["moving_average"]),
        )

    elif strategy == StrategyType.EMA.value:
        window = kwargs.get("window", 20)
        data["moving_average"] = calculate_ema(close, window)
        _assign_signals(
            data,
            buy_condition=close > data["moving_average"],
            sell_condition=close < data["moving_average"],
        )

    data["signal"] = data["signal"].apply(lambda s: s.value if hasattr(s, "value") else s)
    return data


def add_strategy_signals(
    price_data: pd.DataFrame,
    window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
) -> pd.DataFrame:
    """Add SMA values and signals; kept for older tests and CLI examples."""
    return generate_strategy_signals(price_data, strategy_type="sma", window=window)
