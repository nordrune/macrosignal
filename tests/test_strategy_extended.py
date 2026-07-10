"""Extended tests for technical indicators and strategies."""

import polars as pl
import pytest
from trading_backtester.strategy import calculate_ema, generate_strategy_signals


def test_calculate_ema():
    close_prices = pl.Series([10.0, 11.0, 12.0, 13.0])
    ema = calculate_ema(close_prices, window=3)
    assert len(ema) == 4
    assert ema[0] == 10.0
    assert ema[1] > 10.0


def test_generate_strategy_signals_ema():
    price_data = pl.DataFrame(
        {
            "date": ["2024-01-01", "2024-01-02", "2024-01-03"],
            "close": [10.0, 12.0, 8.0],
        }
    )
    res = generate_strategy_signals(price_data, strategy_type="ema", window=2)
    assert "moving_average" in res.columns
    assert "signal" in res.columns
    assert res.row(1, named=True)["signal"] == "buy"
    assert res.row(2, named=True)["signal"] == "sell"


def test_generate_strategy_signals_rejects_removed_strategy():
    price_data = pl.DataFrame(
        {
            "date": ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"],
            "close": [100.0, 110.0, 90.0, 80.0],
        }
    )
    with pytest.raises(ValueError, match="Unknown strategy type"):
        generate_strategy_signals(
            price_data, strategy_type="unsupported", window=2
        )


def test_generate_strategy_signals_rsi():
    price_data = pl.DataFrame(
        {
            "date": ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"],
            "close": [10.0, 15.0, 5.0, 4.0],
        }
    )
    res = generate_strategy_signals(price_data, strategy_type="rsi", window=2)
    assert "rsi" in res.columns
    assert "signal" in res.columns
    assert res.row(0, named=True)["moving_average"] is None
    signals = res["signal"].to_list()
    assert all(sig in ["buy", "sell", "hold"] for sig in signals)


def test_generate_strategy_signals_macd():
    price_data = pl.DataFrame(
        {
            "date": [f"2024-01-{i:02d}" for i in range(1, 15)],
            "close": [10.0 + i for i in range(14)],
        }
    )
    res = generate_strategy_signals(price_data, strategy_type="macd", window=3)
    assert "macd_line" in res.columns
    assert "macd_signal" in res.columns
    assert "signal" in res.columns
    assert res.row(0, named=True)["moving_average"] is None


def test_generate_strategy_signals_bollinger():
    price_data = pl.DataFrame(
        {
            "date": [f"2024-01-{i:02d}" for i in range(1, 10)],
            "close": [10.0, 11.0, 9.0, 12.0, 8.0, 15.0, 7.0, 20.0, 5.0],
        }
    )
    res = generate_strategy_signals(
        price_data, strategy_type="bollinger", window=3
    )
    assert "moving_average" in res.columns
    assert "bollinger_upper" in res.columns
    assert "bollinger_lower" in res.columns
    assert "signal" in res.columns


def test_generate_strategy_signals_crossover():
    price_data = pl.DataFrame(
        {
            "date": [f"2024-01-{i:02d}" for i in range(1, 10)],
            "close": [10.0 + i for i in range(9)],
        }
    )
    res = generate_strategy_signals(
        price_data, strategy_type="crossover", window=2
    )
    assert "moving_average" in res.columns
    assert "fast_sma" in res.columns
    assert "signal" in res.columns
