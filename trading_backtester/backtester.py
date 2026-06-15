"""Backtesting logic for rule-based trading strategies.

The module keeps the simulation deliberately simple: one asset, one position,
all-in buys, all-out sells, and a fixed transaction fee. That makes the result
easy to explain in the dashboard and predictable for unit tests.
"""

from datetime import time
from typing import Any

import pandas as pd

from trading_backtester.models import (
    BacktestResult,
    StrategyType,
    normalize_strategy_type,
)
from trading_backtester.strategy import (
    DEFAULT_MOVING_AVERAGE_WINDOW,
    generate_strategy_signals,
)

STARTING_CAPITAL = 10_000.0
TRANSACTION_FEE_RATE = 0.001


def _format_date(value: object) -> str:
    """Use compact dates for daily data and timestamps for intraday data."""
    if isinstance(value, pd.Timestamp):
        if value.time() == time(0, 0):
            return value.strftime("%Y-%m-%d")
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return str(value)


def _serialise_strategy_data(
    strategy_data: pd.DataFrame,
) -> list[dict[str, object]]:
    """Convert pandas rows to JSON-friendly records for the API and frontend."""
    records: list[dict[str, object]] = []
    for _, row in strategy_data.iterrows():
        record: dict[str, object] = {}
        for key, value in row.items():
            column = str(key)
            if column == "date":
                record[column] = _format_date(value)
            elif pd.isna(value):
                record[column] = None
            elif hasattr(value, "item"):
                record[column] = value.item()
            else:
                record[column] = value
        records.append(record)
    return records


def _parameter_grid(strategy_type: str) -> list[dict[str, int]]:
    """Return the parameter grid used by the optimizer for one strategy."""
    if strategy_type in {StrategyType.SMA.value, StrategyType.EMA.value}:
        return [{"window": window} for window in range(5, 101, 5)]

    raise ValueError(f"Cannot optimize unknown strategy: {strategy_type}")


def run_backtest(
    price_data: pd.DataFrame,
    starting_capital: float = STARTING_CAPITAL,
    transaction_fee_rate: float = TRANSACTION_FEE_RATE,
    moving_average_window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
    strategy_type: str | StrategyType = StrategyType.SMA,
    **strategy_kwargs: Any,
) -> BacktestResult:
    """Run a backtest on historical price data with the chosen strategy.

    The simulation starts fully in cash. On a buy signal it invests all
    available cash into the asset, and on a sell signal it liquidates the full
    asset position back into cash.

    Args:
        price_data: Data frame with at least ``close`` and ``date`` columns.
        starting_capital: Initial virtual cash balance.
        transaction_fee_rate: Fee rate applied to each buy or sell transaction.
        moving_average_window: SMA window fallback when none is provided.
        strategy_type: Strategy to run.
        **strategy_kwargs: Arguments passed to the strategy signals generator.

    Returns:
        A ``BacktestResult`` with final performance and timeseries values.
    """
    if price_data.empty:
        raise ValueError("Price data must contain at least one row.")
    if starting_capital <= 0:
        raise ValueError("Starting capital must be greater than zero.")
    if transaction_fee_rate < 0:
        raise ValueError("Transaction fee rate cannot be negative.")

    strategy_key = normalize_strategy_type(strategy_type)
    if (
        strategy_key == StrategyType.SMA.value
        and "window" not in strategy_kwargs
    ):
        strategy_kwargs["window"] = moving_average_window

    strategy_data = generate_strategy_signals(
        price_data,
        strategy_type=strategy_key,
        **strategy_kwargs,
    )

    cash_balance = starting_capital
    asset_units = 0.0
    buy_trades = 0
    sell_trades = 0

    trades_log: list[dict[str, object]] = []
    daily_portfolio_values: list[dict[str, object]] = []
    trade_profits = []
    cash_before_buy = starting_capital

    for _, row in strategy_data.iterrows():
        close_price = float(row["close"])
        date_str = _format_date(row["date"])

        if row["signal"] == "buy" and asset_units == 0:
            cash_before_buy = cash_balance
            fee = cash_balance * transaction_fee_rate
            investable_cash = cash_balance - fee
            asset_units = investable_cash / close_price
            cash_balance = 0.0
            buy_trades += 1

            trades_log.append(
                {
                    "date": date_str,
                    "type": "buy",
                    "price": close_price,
                    "units": asset_units,
                    "fee": fee,
                    "cashBalance": cash_balance,
                }
            )
        elif row["signal"] == "sell" and asset_units > 0:
            gross_sale_value = asset_units * close_price
            fee = gross_sale_value * transaction_fee_rate
            sold_units = asset_units
            cash_balance = gross_sale_value - fee
            asset_units = 0.0
            sell_trades += 1

            profit = cash_balance - cash_before_buy
            trade_profits.append(profit)

            trades_log.append(
                {
                    "date": date_str,
                    "type": "sell",
                    "price": close_price,
                    "units": sold_units,
                    "fee": fee,
                    "cashBalance": cash_balance,
                }
            )

        current_portfolio_value = cash_balance + (asset_units * close_price)
        daily_portfolio_values.append(
            {
                "date": date_str,
                "capital": current_portfolio_value,
            }
        )

    last_close_price = float(price_data.iloc[-1]["close"])
    if asset_units > 0:
        end_capital = asset_units * last_close_price
        final_status = "holding asset"
        profit = end_capital - cash_before_buy
        trade_profits.append(profit)
    else:
        end_capital = cash_balance
        final_status = "holding cash"

    profit_loss = end_capital - starting_capital
    profit_loss_percent = (profit_loss / starting_capital) * 100

    cap_series = pd.Series([item["capital"] for item in daily_portfolio_values])
    daily_returns = cap_series.pct_change().dropna()
    if len(daily_returns) > 1 and daily_returns.std() > 0:
        sharpe_ratio = float(
            (daily_returns.mean() / daily_returns.std()) * (252**0.5)
        )
    else:
        sharpe_ratio = 0.0

    peaks = cap_series.cummax()
    drawdowns = (cap_series - peaks) / peaks
    max_drawdown = (
        float(abs(drawdowns.min()) * 100) if not drawdowns.empty else 0.0
    )

    profitable_trades = sum(1 for p in trade_profits if p > 0)
    total_trades_count = len(trade_profits)
    win_rate = (
        (profitable_trades / total_trades_count) * 100
        if total_trades_count > 0
        else 0.0
    )

    first_close_price = float(price_data.iloc[0]["close"])
    buy_and_hold_return = (
        (last_close_price - first_close_price) / first_close_price
    ) * 100

    return BacktestResult(
        start_capital=starting_capital,
        end_capital=end_capital,
        profit_loss=profit_loss,
        profit_loss_percent=profit_loss_percent,
        buy_trades=buy_trades,
        sell_trades=sell_trades,
        final_status=final_status,
        sharpe_ratio=sharpe_ratio,
        max_drawdown=max_drawdown,
        win_rate=win_rate,
        buy_and_hold_return=buy_and_hold_return,
        capital_history=daily_portfolio_values,
        series_data=_serialise_strategy_data(strategy_data),
        trades=trades_log,
    )


def format_results(result: BacktestResult) -> str:
    """Format a backtest result for command-line output."""
    return "\n".join(
        [
            f"Start capital: ${result.start_capital:,.2f}",
            f"End capital: ${result.end_capital:,.2f}",
            f"Profit/Loss: ${result.profit_loss:,.2f}",
            f"Profit/Loss (%): {result.profit_loss_percent:.2f}%",
            f"Buy trades: {result.buy_trades}",
            f"Sell trades: {result.sell_trades}",
            f"Final status: {result.final_status}",
            f"Sharpe Ratio: {result.sharpe_ratio:.2f}",
            f"Max Drawdown: {result.max_drawdown:.2f}%",
            f"Win Rate: {result.win_rate:.2f}%",
            f"Buy & Hold Return: {result.buy_and_hold_return:.2f}%",
        ]
    )


def optimize_strategy_parameters(
    price_data: pd.DataFrame,
    starting_capital: float = STARTING_CAPITAL,
    transaction_fee_rate: float = TRANSACTION_FEE_RATE,
    strategy_type: str | StrategyType = StrategyType.SMA,
) -> list[dict[str, Any]]:
    """Return the top five parameter combinations for the selected strategy.

    The optimizer is a deterministic grid search. It is intentionally limited
    to small grids so that students can understand the search space and the
    dashboard can respond quickly on typical local machines.
    """
    strategy_key = normalize_strategy_type(strategy_type)
    runs = []

    for params in _parameter_grid(strategy_key):
        res = run_backtest(
            price_data=price_data,
            starting_capital=starting_capital,
            transaction_fee_rate=transaction_fee_rate,
            strategy_type=strategy_key,
            **params,
        )
        runs.append(
            {
                "params": params,
                "end_capital": float(res.end_capital),
                "profit_loss": float(res.profit_loss),
                "profit_loss_percent": float(res.profit_loss_percent),
                "sharpe_ratio": float(res.sharpe_ratio),
                "max_drawdown": float(res.max_drawdown),
                "win_rate": float(res.win_rate),
                "total_trades": int(res.buy_trades + res.sell_trades),
            }
        )

    runs.sort(
        key=lambda r: (r["profit_loss_percent"], r["sharpe_ratio"]),
        reverse=True,
    )
    return runs[:5]
