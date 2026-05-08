"""Moving average strategy logic."""

import pandas as pd

from trading_backtester.models import Signal


DEFAULT_MOVING_AVERAGE_WINDOW = 20


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


def add_strategy_signals(
    price_data: pd.DataFrame,
    window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
) -> pd.DataFrame:
    """Add moving average values and strategy signals to price data.

    Args:
        price_data: Data frame with a numeric ``close`` column.
        window: Moving average window size.

    Returns:
        A copy of ``price_data`` with ``moving_average`` and ``signal`` columns.
    """
    data_with_signals = price_data.copy()
    data_with_signals["moving_average"] = calculate_moving_average(
        data_with_signals["close"],
        window,
    )
    data_with_signals["signal"] = [
        generate_signal(close_price, moving_average)
        for close_price, moving_average in zip(
            data_with_signals["close"],
            data_with_signals["moving_average"],
        )
    ]
    return data_with_signals
