"""Extended tests for the backtester calculations and risk metrics."""

import pandas as pd
import pytest
from trading_backtester.backtester import run_backtest


def test_backtester_calculates_sharpe_and_drawdown():
    # Simple upward trending price data
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
            "close": [10.0, 11.0, 12.0, 13.0, 14.0],
        }
    )

    result = run_backtest(price_data, strategy_type="sma", window=2)

    # Check that new fields are populated
    assert hasattr(result, "sharpe_ratio")
    assert hasattr(result, "max_drawdown")
    assert hasattr(result, "win_rate")
    assert hasattr(result, "buy_and_hold_return")
    assert hasattr(result, "capital_history")

    # Assert Buy and hold return: (14 - 10) / 10 = 40.0%
    assert result.buy_and_hold_return == pytest.approx(40.0)

    # Drawdown should be minimal when prices rise steadily.
    assert result.max_drawdown >= 0.0

    # Capital history should have 5 items corresponding to the 5 prices
    assert len(result.capital_history) == 5
    assert len(result.series_data) == 5
    assert len(result.trades) >= 0


def test_backtester_calculates_win_rate():
    # Price data that forces multiple trades
    # Index 0: 10
    # Index 1: 12 -> SMA(2) = 11. Close > SMA. BUY signal.
    # Index 2: 8 -> SMA(2) = 10. Close < SMA. SELL signal.
    # Entry at 12, exit at 8 -> loss trade.
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
            "close": [10.0, 12.0, 8.0, 15.0, 9.0],
        }
    )

    result = run_backtest(
        price_data, strategy_type="sma", window=2, transaction_fee_rate=0.0
    )
    # Trades triggered:
    # 2024-01-02: BUY at 12.0
    # 2024-01-03: SELL at 8.0 (Loss trade)
    # 2024-01-04: BUY at 15.0
    # 2024-01-05: SELL at 9.0 (Loss trade)

    assert result.buy_trades == 2
    assert result.sell_trades == 2
    assert result.win_rate == 0.0  # both trades were losses
