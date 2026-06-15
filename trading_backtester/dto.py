"""HTTP request and response shapes for the MacroSignal API.

Litestar serialises these msgspec structs directly. Domain logic keeps using
``BacktestResult`` in models.py so the CLI stays framework-independent.
"""

from dataclasses import asdict
from typing import Any

import msgspec

from trading_backtester.models import BacktestResult


class PricePoint(msgspec.Struct):
    """Single close-price observation sent by the dashboard."""

    date: str
    close: float


class PriceSourceRequest(msgspec.Struct):
    """Shared price-source fields for dashboard endpoints."""

    prices: list[PricePoint] | None = None
    symbol: str | None = None
    period: str = "1y"
    interval: str = "1d"


class BacktestRequest(PriceSourceRequest):
    """Request body for one dashboard backtest run."""

    starting_capital: float = 10000.0
    transaction_fee_percent: float = 0.1
    strategy_type: str = "sma"
    strategy_params: dict[str, Any] = msgspec.field(default_factory=dict)


class OptimizeRequest(PriceSourceRequest):
    """Request body for the parameter search endpoint."""

    starting_capital: float = 10000.0
    transaction_fee_percent: float = 0.1
    strategy_type: str = "sma"


class BacktestResponse(msgspec.Struct):
    """Serialised backtest result returned to the dashboard."""

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

    @classmethod
    def from_result(cls, result: BacktestResult) -> "BacktestResponse":
        """Build an API response from a backtest result dataclass."""
        # ponytail: reuse dataclass asdict instead of a second mapping layer
        return msgspec.convert(asdict(result), cls)


class OptimizeResponse(msgspec.Struct):
    """Top parameter configurations from the optimizer."""

    strategy_type: str
    runs: list[dict[str, Any]]
