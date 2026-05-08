"""Tests for moving average strategy logic."""

import pandas as pd

from trading_backtester.models import Signal
from trading_backtester.strategy import calculate_moving_average, generate_signal


def test_calculate_moving_average_uses_complete_windows():
    """Moving average values are only available after a complete window."""
    close_prices = pd.Series([10.0, 20.0, 30.0, 40.0])

    moving_average = calculate_moving_average(close_prices, window=3)

    assert pd.isna(moving_average.iloc[0])
    assert pd.isna(moving_average.iloc[1])
    assert moving_average.iloc[2] == 20.0
    assert moving_average.iloc[3] == 30.0


def test_generate_signal_from_price_and_moving_average():
    """Signals follow the simple price versus moving average rule."""
    assert generate_signal(105.0, 100.0) == Signal.BUY
    assert generate_signal(95.0, 100.0) == Signal.SELL
    assert generate_signal(100.0, 100.0) == Signal.HOLD
    assert generate_signal(100.0, float("nan")) == Signal.HOLD
