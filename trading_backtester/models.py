"""Shared data models for the trading backtester."""

from dataclasses import dataclass
from enum import Enum


class Signal(str, Enum):
    """Possible trading signals produced by the moving average strategy."""

    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


@dataclass(frozen=True)
class BacktestResult:
    """Final performance summary produced by a completed backtest."""

    start_capital: float
    end_capital: float
    profit_loss: float
    profit_loss_percent: float
    buy_trades: int
    sell_trades: int
    final_status: str
