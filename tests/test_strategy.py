"""Tests for moving average strategy logic."""

import polars as pl
import pytest
from trading_backtester.models import Signal
from trading_backtester.strategy import (
    calculate_ema,
    calculate_moving_average,
    generate_signal,
)


def test_calculate_moving_average_uses_complete_windows():
    """Moving average values are only available after a complete window."""
    close_prices = pl.Series([10.0, 20.0, 30.0, 40.0])

    moving_average = calculate_moving_average(close_prices, window=3)

    assert moving_average[0] is None
    assert moving_average[1] is None
    assert moving_average[2] == 20.0
    assert moving_average[3] == 30.0


def test_calculate_moving_average_matches_pandas_golden_values():
    """SMA null alignment matches the pre-migration pandas behaviour."""
    close_prices = pl.Series([10.0, 20.0, 30.0, 40.0])
    moving_average = calculate_moving_average(close_prices, window=3)
    assert moving_average.to_list() == [None, None, 20.0, 30.0]


def test_calculate_ema_matches_pandas_golden_values():
    """EMA values match the pre-migration pandas ewm(adjust=False) output."""
    close_prices = pl.Series([10.0, 11.0, 12.0, 13.0])
    ema = calculate_ema(close_prices, window=3)
    assert ema.to_list() == pytest.approx([10.0, 10.5, 11.25, 12.125])


def test_generate_signal_from_price_and_moving_average():
    """Signals follow the simple price versus moving average rule."""
    assert generate_signal(105.0, 100.0) == Signal.BUY
    assert generate_signal(95.0, 100.0) == Signal.SELL
    assert generate_signal(100.0, 100.0) == Signal.HOLD
    assert generate_signal(100.0, float("nan")) == Signal.HOLD
