"""Extended tests for technical indicators and strategies."""

import pandas as pd
import pytest

from trading_backtester.models import Signal
from trading_backtester.strategy import (
    calculate_ema,
    calculate_rsi,
    calculate_macd,
    calculate_bollinger_bands,
    generate_strategy_signals,
)


def test_calculate_ema():
    close_prices = pd.Series([10.0, 11.0, 12.0, 13.0])
    ema = calculate_ema(close_prices, window=3)
    assert len(ema) == 4
    assert ema.iloc[0] == 10.0  # ewm starts with first value
    assert ema.iloc[1] > 10.0


def test_calculate_rsi():
    close_prices = pd.Series([100.0, 105.0, 110.0, 105.0, 100.0])
    rsi = calculate_rsi(close_prices, window=2)
    assert len(rsi) == 5
    # First item is 50 (neutral) due to diff being NaN
    assert rsi.iloc[0] == 50.0
    # Gain on day 1 & 2 -> RSI should go up
    assert rsi.iloc[2] > 70.0
    # Loss on day 3 & 4 -> RSI should go down
    assert rsi.iloc[4] < 30.0


def test_calculate_macd():
    close_prices = pd.Series([10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0])
    macd_line, signal_line, histogram = calculate_macd(close_prices, fast=2, slow=5, signal_window=3)
    assert len(macd_line) == 10
    assert len(signal_line) == 10
    assert len(histogram) == 10


def test_calculate_bollinger_bands():
    close_prices = pd.Series([10.0, 11.0, 12.0, 13.0, 14.0])
    middle, upper, lower = calculate_bollinger_bands(close_prices, window=3, num_std=2.0)
    assert len(middle) == 5
    # Value before window is NaN
    assert pd.isna(middle.iloc[0])
    assert pd.isna(middle.iloc[1])
    # Index 2 has mean of [10, 11, 12] = 11
    assert middle.iloc[2] == 11.0
    assert upper.iloc[2] > middle.iloc[2]
    assert lower.iloc[2] < middle.iloc[2]


def test_generate_strategy_signals_ema():
    price_data = pd.DataFrame({
        "date": ["2024-01-01", "2024-01-02", "2024-01-03"],
        "close": [10.0, 12.0, 8.0],
    })
    # Run EMA strategy
    res = generate_strategy_signals(price_data, strategy_type="ema", window=2)
    assert "moving_average" in res.columns
    assert "signal" in res.columns
    # Close > EMA on index 1
    assert res.iloc[1]["signal"] == "buy"
    # Close < EMA on index 2
    assert res.iloc[2]["signal"] == "sell"


def test_generate_strategy_signals_rsi():
    price_data = pd.DataFrame({
        "date": ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"],
        "close": [100.0, 110.0, 90.0, 80.0],
    })
    res = generate_strategy_signals(price_data, strategy_type="rsi", window=2, buy_threshold=40, sell_threshold=60)
    assert "rsi" in res.columns
    assert "signal" in res.columns
