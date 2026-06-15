"""Extended tests for technical indicators and strategies."""

import pandas as pd
import pytest

from trading_backtester.strategy import (
    calculate_ema,
    generate_strategy_signals,
)


def test_calculate_ema():
    close_prices = pd.Series([10.0, 11.0, 12.0, 13.0])
    ema = calculate_ema(close_prices, window=3)
    assert len(ema) == 4
    assert ema.iloc[0] == 10.0  # ewm starts with first value
    assert ema.iloc[1] > 10.0


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


def test_generate_strategy_signals_rejects_removed_strategy():
    price_data = pd.DataFrame({
        "date": ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"],
        "close": [100.0, 110.0, 90.0, 80.0],
    })
    with pytest.raises(ValueError, match="Unknown strategy type"):
        generate_strategy_signals(price_data, strategy_type="unsupported", window=2)
