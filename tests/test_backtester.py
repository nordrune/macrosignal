"""Tests for virtual trading simulation."""

import pandas as pd
import pytest
from trading_backtester.backtester import run_backtest


def test_run_backtest_calculates_final_capital_after_trade_sequence():
    """A simple buy and sell sequence applies transaction fees correctly."""
    price_data = pd.DataFrame(
        {
            "date": pd.to_datetime(
                [
                    "2024-01-01",
                    "2024-01-02",
                    "2024-01-03",
                    "2024-01-04",
                    "2024-01-05",
                ]
            ),
            "close": [10.0, 10.0, 12.0, 20.0, 15.0],
        }
    )

    result = run_backtest(price_data, moving_average_window=2)

    assert result.buy_trades == 1
    assert result.sell_trades == 1
    assert result.final_status == "holding cash"
    assert result.end_capital == pytest.approx(12475.0125)
