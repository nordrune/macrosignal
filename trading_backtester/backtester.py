"""Virtual trade simulation for the moving average strategy."""

import pandas as pd

from trading_backtester.models import BacktestResult, Signal
from trading_backtester.strategy import (
    DEFAULT_MOVING_AVERAGE_WINDOW,
    add_strategy_signals,
)


STARTING_CAPITAL = 10_000.0
TRANSACTION_FEE_RATE = 0.001


def run_backtest(
    price_data: pd.DataFrame,
    starting_capital: float = STARTING_CAPITAL,
    transaction_fee_rate: float = TRANSACTION_FEE_RATE,
    moving_average_window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
) -> BacktestResult:
    """Run a simple moving average backtest on historical price data.

    The simulation starts fully in cash. On a buy signal it invests all
    available cash into the asset, and on a sell signal it liquidates the full
    asset position back into cash.

    Args:
        price_data: Data frame containing at least a ``close`` column.
        starting_capital: Initial virtual cash balance.
        transaction_fee_rate: Fee rate applied to each buy or sell transaction.
        moving_average_window: Window used by the moving average strategy.

    Returns:
        A ``BacktestResult`` with final performance values.

    Raises:
        ValueError: If input values are invalid.
    """
    if price_data.empty:
        raise ValueError("Price data must contain at least one row.")
    if starting_capital <= 0:
        raise ValueError("Starting capital must be greater than zero.")
    if transaction_fee_rate < 0:
        raise ValueError("Transaction fee rate cannot be negative.")

    cash_balance = starting_capital
    asset_units = 0.0
    buy_trades = 0
    sell_trades = 0

    strategy_data = add_strategy_signals(price_data, moving_average_window)

    for row in strategy_data.itertuples(index=False):
        close_price = float(row.close)

        if row.signal == Signal.BUY and asset_units == 0:
            fee = cash_balance * transaction_fee_rate
            investable_cash = cash_balance - fee
            asset_units = investable_cash / close_price
            cash_balance = 0.0
            buy_trades += 1
        elif row.signal == Signal.SELL and asset_units > 0:
            gross_sale_value = asset_units * close_price
            fee = gross_sale_value * transaction_fee_rate
            cash_balance = gross_sale_value - fee
            asset_units = 0.0
            sell_trades += 1

    last_close_price = float(price_data.iloc[-1]["close"])
    if asset_units > 0:
        end_capital = asset_units * last_close_price
        final_status = "holding asset"
    else:
        end_capital = cash_balance
        final_status = "holding cash"

    profit_loss = end_capital - starting_capital
    profit_loss_percent = (profit_loss / starting_capital) * 100

    return BacktestResult(
        start_capital=starting_capital,
        end_capital=end_capital,
        profit_loss=profit_loss,
        profit_loss_percent=profit_loss_percent,
        buy_trades=buy_trades,
        sell_trades=sell_trades,
        final_status=final_status,
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
        ]
    )
