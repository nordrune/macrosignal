"""Shared data models for MacroSignal.

These models are intentionally small and framework-independent so they can be
used by the CLI, FastAPI routes, tests, and future interfaces without creating
API-specific dependencies.
"""

from dataclasses import dataclass
from enum import StrEnum


class Signal(StrEnum):
    """Trading actions produced by a strategy."""

    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


class StrategyType(StrEnum):
    """Supported trading strategies."""

    SMA = "sma"
    EMA = "ema"


def normalize_strategy_type(strategy_type: str | StrategyType) -> str:
    """Return the lowercase strategy key used across the backtester."""
    if isinstance(strategy_type, StrategyType):
        return strategy_type.value
    return str(strategy_type).strip().lower()


@dataclass(frozen=True)
class BacktestResult:
    """Complete result returned after a backtest run.

    The scalar fields describe the final performance. The list fields are
    serialisable records used by the dashboard for charts, trade tables, and
    point-by-point inspection.
    """

    start_capital: float
    end_capital: float
    profit_loss: float
    profit_loss_percent: float
    buy_trades: int
    sell_trades: int
    final_status: str
    sharpe_ratio: float
    max_drawdown: float
    win_rate: float
    buy_and_hold_return: float
    capital_history: list[dict[str, object]]
    series_data: list[dict[str, object]]
    trades: list[dict[str, object]]
