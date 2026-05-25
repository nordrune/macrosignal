"""Virtual trade simulation for multiple trading strategies."""

import pandas as pd

from trading_backtester.models import BacktestResult, Signal
from trading_backtester.strategy import (
    DEFAULT_MOVING_AVERAGE_WINDOW,
    generate_strategy_signals,
)


STARTING_CAPITAL = 10_000.0
TRANSACTION_FEE_RATE = 0.001


def run_backtest(
    price_data: pd.DataFrame,
    starting_capital: float = STARTING_CAPITAL,
    transaction_fee_rate: float = TRANSACTION_FEE_RATE,
    moving_average_window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
    strategy_type: str = "sma",
    **strategy_kwargs,
) -> BacktestResult:
    """Run a backtest on historical price data with the chosen strategy.

    The simulation starts fully in cash. On a buy signal it invests all
    available cash into the asset, and on a sell signal it liquidates the full
    asset position back into cash.

    Args:
        price_data: Data frame containing at least a ``close`` and ``date`` column.
        starting_capital: Initial virtual cash balance.
        transaction_fee_rate: Fee rate applied to each buy or sell transaction.
        moving_average_window: Window used by the moving average strategy (fallback).
        strategy_type: The strategy to run ("sma", "ema", "rsi", "macd", "bollinger").
        **strategy_kwargs: Arguments passed to the strategy signals generator.

    Returns:
        A ``BacktestResult`` with final performance and historical timeseries values.
    """
    if price_data.empty:
        raise ValueError("Price data must contain at least one row.")
    if starting_capital <= 0:
        raise ValueError("Starting capital must be greater than zero.")
    if transaction_fee_rate < 0:
        raise ValueError("Transaction fee rate cannot be negative.")

    # Backward compatibility for moving_average_window parameter
    if strategy_type == "sma" and "window" not in strategy_kwargs:
        strategy_kwargs["window"] = moving_average_window

    strategy_data = generate_strategy_signals(
        price_data,
        strategy_type=strategy_type,
        **strategy_kwargs,
    )

    cash_balance = starting_capital
    asset_units = 0.0
    buy_trades = 0
    sell_trades = 0

    trades_log = []
    daily_portfolio_values = []
    trade_profits = []
    cash_before_buy = starting_capital

    for row in strategy_data.itertuples(index=False):
        close_price = float(row.close)

        # Safe date conversion
        if isinstance(row.date, pd.Timestamp):
            date_str = row.date.strftime("%Y-%m-%d")
        else:
            date_str = str(row.date)

        # Check signals
        if row.signal == "buy" and asset_units == 0:
            cash_before_buy = cash_balance
            fee = cash_balance * transaction_fee_rate
            investable_cash = cash_balance - fee
            asset_units = investable_cash / close_price
            cash_balance = 0.0
            buy_trades += 1

            trades_log.append({
                "date": date_str,
                "type": "buy",
                "price": close_price,
                "units": asset_units,
                "fee": fee,
                "cashBalance": cash_balance,
            })
        elif row.signal == "sell" and asset_units > 0:
            gross_sale_value = asset_units * close_price
            fee = gross_sale_value * transaction_fee_rate
            sold_units = asset_units
            cash_balance = gross_sale_value - fee
            asset_units = 0.0
            sell_trades += 1

            profit = cash_balance - cash_before_buy
            trade_profits.append(profit)

            trades_log.append({
                "date": date_str,
                "type": "sell",
                "price": close_price,
                "units": sold_units,
                "fee": fee,
                "cashBalance": cash_balance,
            })

        # Calculate daily portfolio value
        current_portfolio_value = cash_balance + (asset_units * close_price)
        daily_portfolio_values.append({
            "date": date_str,
            "capital": current_portfolio_value,
        })

    last_close_price = float(price_data.iloc[-1]["close"])
    if asset_units > 0:
        end_capital = asset_units * last_close_price
        final_status = "holding asset"
        # Track open trade profit
        profit = end_capital - cash_before_buy
        trade_profits.append(profit)
    else:
        end_capital = cash_balance
        final_status = "holding cash"

    profit_loss = end_capital - starting_capital
    profit_loss_percent = (profit_loss / starting_capital) * 100

    # Calculate financial risk metrics
    cap_series = pd.Series([item["capital"] for item in daily_portfolio_values])
    daily_returns = cap_series.pct_change().dropna()
    if len(daily_returns) > 1 and daily_returns.std() > 0:
        sharpe_ratio = float((daily_returns.mean() / daily_returns.std()) * (252 ** 0.5))
    else:
        sharpe_ratio = 0.0

    peaks = cap_series.cummax()
    drawdowns = (cap_series - peaks) / peaks
    max_drawdown = float(abs(drawdowns.min()) * 100) if not drawdowns.empty else 0.0

    profitable_trades = sum(1 for p in trade_profits if p > 0)
    total_trades_count = len(trade_profits)
    win_rate = (profitable_trades / total_trades_count) * 100 if total_trades_count > 0 else 0.0

    first_close_price = float(price_data.iloc[0]["close"])
    buy_and_hold_return = ((last_close_price - first_close_price) / first_close_price) * 100

    # Convert strategy_data columns into serializable timeseries dict list
    series_data = []
    for idx, row in strategy_data.iterrows():
        row_dict = row.to_dict()
        if isinstance(row_dict.get("date"), (pd.Timestamp, pd.DatetimeTZDtype)):
            row_dict["date"] = row_dict["date"].strftime("%Y-%m-%d")
        else:
            row_dict["date"] = str(row_dict["date"])

        # Convert NaNs to None for clean JSON serialization
        for key, val in row_dict.items():
            if pd.isna(val):
                row_dict[key] = None
        series_data.append(row_dict)

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
        series_data=series_data,
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
    strategy_type: str = "sma",
) -> list[dict]:
    """Perform a grid search sweep over strategy parameters to identify the top performing configurations."""
    import itertools

    runs = []

    if strategy_type == "sma":
        grid = [{"window": w} for w in range(5, 101, 5)]
    elif strategy_type == "ema":
        grid = [{"window": w} for w in range(5, 101, 5)]
    elif strategy_type == "rsi":
        windows = [10, 14, 20]
        buys = [25, 30, 35]
        sells = [65, 70, 75]
        grid = [
            {"window": w, "buy_threshold": b, "sell_threshold": s}
            for w, b, s in itertools.product(windows, buys, sells)
        ]
    elif strategy_type == "macd":
        fasts = [8, 12, 16]
        slows = [20, 26, 32]
        signals = [7, 9, 11]
        grid = [
            {"fast": f, "slow": s, "signal_window": sig}
            for f, s, sig in itertools.product(fasts, slows, signals)
            if f < s
        ]
    elif strategy_type == "bollinger":
        windows = [10, 20, 30, 40]
        stds = [1.5, 2.0, 2.5]
        grid = [
            {"window": w, "num_std": std}
            for w, std in itertools.product(windows, stds)
        ]
    elif strategy_type == "combined":
        sma_wins = [10, 20, 30]
        rsi_wins = [10, 14]
        buys = [40, 50]
        sells = [65, 70, 75]
        grid = [
            {"sma_window": sw, "rsi_window": rw, "buy_threshold": b, "sell_threshold": s}
            for sw, rw, b, s in itertools.product(sma_wins, rsi_wins, buys, sells)
        ]
    else:
        raise ValueError(f"Cannot optimize unknown strategy: {strategy_type}")

    for params in grid:
        try:
            res = run_backtest(
                price_data=price_data,
                starting_capital=starting_capital,
                transaction_fee_rate=transaction_fee_rate,
                strategy_type=strategy_type,
                **params,
            )
            runs.append({
                "params": params,
                "end_capital": float(res.end_capital),
                "profit_loss": float(res.profit_loss),
                "profit_loss_percent": float(res.profit_loss_percent),
                "sharpe_ratio": float(res.sharpe_ratio),
                "max_drawdown": float(res.max_drawdown),
                "win_rate": float(res.win_rate),
                "total_trades": int(res.buy_trades + res.sell_trades),
            })
        except Exception:
            continue

    # Sort descending by strategy return, break ties with Sharpe Ratio
    runs.sort(key=lambda r: (r["profit_loss_percent"], r["sharpe_ratio"]), reverse=True)
    return runs[:5]

