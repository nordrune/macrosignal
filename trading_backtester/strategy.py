"""Technical indicators and strategy signal generation.

Each strategy receives a price frame with a ``close`` column and returns a copy
with indicator columns plus a normalised ``signal`` column. The backtester uses
only that signal column, while the dashboard also reads the indicator columns
for chart overlays.
"""

import pandas as pd

from trading_backtester.models import Signal, StrategyType


DEFAULT_MOVING_AVERAGE_WINDOW = 20
DEFAULT_RSI_WINDOW = 14
SUPPORTED_STRATEGIES = {strategy.value for strategy in StrategyType}


def _normalise_strategy_type(strategy_type: str | StrategyType) -> str:
    """Return the lowercase strategy value used internally."""
    if isinstance(strategy_type, StrategyType):
        return strategy_type.value
    return str(strategy_type).strip().lower()


def _minimum_history_mask(index: pd.Index, min_periods: int) -> pd.Series:
    """Mark rows that have enough previous points for an indicator."""
    positions = pd.Series(range(len(index)), index=index)
    return positions >= (min_periods - 1)


def _assign_signals(
    data: pd.DataFrame,
    buy_condition: pd.Series,
    sell_condition: pd.Series,
) -> None:
    """Write buy and sell signals into a strategy data frame in place."""
    data.loc[buy_condition, "signal"] = Signal.BUY
    data.loc[sell_condition, "signal"] = Signal.SELL


def calculate_moving_average(
    close_prices: pd.Series,
    window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
) -> pd.Series:
    """Calculate a simple moving average for close prices.

    Args:
        close_prices: Series of historical close prices.
        window: Number of data points used in the moving average.

    Returns:
        A pandas series containing the moving average. Values before enough
        data exists for the window are returned as missing values.

    Raises:
        ValueError: If ``window`` is less than one.
    """
    if window < 1:
        raise ValueError("Moving average window must be at least 1.")

    return close_prices.rolling(window=window, min_periods=window).mean()


def calculate_ema(
    close_prices: pd.Series,
    window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
) -> pd.Series:
    """Calculate the exponential moving average (EMA) for close prices.

    EMA reacts faster to recent price changes than a simple moving average
    because newer values receive more weight.
    """
    if window < 1:
        raise ValueError("EMA window must be at least 1.")
    return close_prices.ewm(span=window, adjust=False).mean()


def calculate_rsi(
    close_prices: pd.Series,
    window: int = DEFAULT_RSI_WINDOW,
) -> pd.Series:
    """Calculate the Relative Strength Index (RSI) using Wilder's smoothing.

    The result is scaled from 0 to 100. The neutral fill value of 50 prevents
    early missing values from accidentally creating buy or sell signals.
    """
    if window < 1:
        raise ValueError("RSI window must be at least 1.")
    delta = close_prices.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.ewm(alpha=1 / window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / window, adjust=False).mean()

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)


def calculate_macd(
    close_prices: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal_window: int = 9,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Calculate the MACD line, signal line, and histogram."""
    if fast < 1 or slow < 1 or signal_window < 1:
        raise ValueError("MACD windows must be at least 1.")
    macd_line = calculate_ema(close_prices, fast) - calculate_ema(close_prices, slow)
    signal_line = macd_line.ewm(span=signal_window, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def calculate_bollinger_bands(
    close_prices: pd.Series,
    window: int = 20,
    num_std: float = 2.0,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Calculate Bollinger Bands as middle, upper, and lower series."""
    if window < 1:
        raise ValueError("Bollinger Bands window must be at least 1.")
    middle_band = calculate_moving_average(close_prices, window)
    std_dev = close_prices.rolling(window=window, min_periods=window).std()
    upper_band = middle_band + num_std * std_dev
    lower_band = middle_band - num_std * std_dev
    return middle_band, upper_band, lower_band


def generate_signal(close_price: float, moving_average: float) -> Signal:
    """Generate a trading signal from the current price and moving average.

    Args:
        close_price: Current close price.
        moving_average: Current simple moving average value.

    Returns:
        ``Signal.BUY`` when price is above the moving average,
        ``Signal.SELL`` when price is below it, and ``Signal.HOLD`` otherwise.
    """
    if pd.isna(moving_average):
        return Signal.HOLD
    if close_price > moving_average:
        return Signal.BUY
    if close_price < moving_average:
        return Signal.SELL
    return Signal.HOLD


def generate_strategy_signals(
    price_data: pd.DataFrame,
    strategy_type: str | StrategyType = StrategyType.SMA,
    **kwargs,
) -> pd.DataFrame:
    """Generate indicators and buy/sell/hold signals for a selected strategy.

    Args:
        price_data: Data frame with a numeric ``close`` column.
        strategy_type: Strategy to apply.
        **kwargs: Strategy-specific parameters, for example ``window`` for SMA
            and EMA or ``buy_threshold``/``sell_threshold`` for RSI.

    Returns:
        Copy of ``price_data`` with indicator columns and a string ``signal`` column.

    Raises:
        ValueError: If the strategy type is unknown or indicator parameters are invalid.
    """
    strategy = _normalise_strategy_type(strategy_type)
    if strategy not in SUPPORTED_STRATEGIES:
        raise ValueError(f"Unknown strategy type: {strategy_type}")

    data = price_data.copy()
    close = data["close"]
    data["signal"] = Signal.HOLD

    if strategy == StrategyType.SMA.value:
        window = kwargs.get("window", 20)
        data["moving_average"] = calculate_moving_average(close, window)
        has_average = data["moving_average"].notna()
        _assign_signals(
            data,
            buy_condition=has_average & (close > data["moving_average"]),
            sell_condition=has_average & (close < data["moving_average"]),
        )

    elif strategy == StrategyType.EMA.value:
        window = kwargs.get("window", 20)
        data["moving_average"] = calculate_ema(close, window)
        _assign_signals(
            data,
            buy_condition=close > data["moving_average"],
            sell_condition=close < data["moving_average"],
        )

    elif strategy == StrategyType.RSI.value:
        window = kwargs.get("window", DEFAULT_RSI_WINDOW)
        buy_threshold = kwargs.get("buy_threshold", 30)
        sell_threshold = kwargs.get("sell_threshold", 70)
        data["rsi"] = calculate_rsi(close, window)
        has_history = _minimum_history_mask(close.index, window)
        _assign_signals(
            data,
            buy_condition=has_history & (data["rsi"] < buy_threshold),
            sell_condition=has_history & (data["rsi"] > sell_threshold),
        )

    elif strategy == StrategyType.MACD.value:
        fast = kwargs.get("fast", 12)
        slow = kwargs.get("slow", 26)
        signal_window = kwargs.get("signal_window", 9)
        macd_line, signal_line, hist = calculate_macd(close, fast, slow, signal_window)
        data["macd_line"] = macd_line
        data["signal_line"] = signal_line
        data["macd_histogram"] = hist
        has_history = _minimum_history_mask(close.index, max(fast, slow))
        _assign_signals(
            data,
            buy_condition=has_history & (macd_line > signal_line),
            sell_condition=has_history & (macd_line < signal_line),
        )

    elif strategy == StrategyType.BOLLINGER.value:
        window = kwargs.get("window", 20)
        num_std = kwargs.get("num_std", 2.0)
        middle, upper, lower = calculate_bollinger_bands(close, window, num_std)
        data["bb_middle"] = middle
        data["bb_upper"] = upper
        data["bb_lower"] = lower
        has_bands = middle.notna()
        _assign_signals(
            data,
            buy_condition=has_bands & (close < lower),
            sell_condition=has_bands & (close > upper),
        )

    elif strategy == StrategyType.COMBINED.value:
        sma_window = kwargs.get("sma_window", 20)
        rsi_window = kwargs.get("rsi_window", DEFAULT_RSI_WINDOW)
        buy_threshold = kwargs.get("buy_threshold", 50)
        sell_threshold = kwargs.get("sell_threshold", 70)

        data["moving_average"] = calculate_moving_average(close, sma_window)
        data["rsi"] = calculate_rsi(close, rsi_window)

        has_history = _minimum_history_mask(close.index, max(sma_window, rsi_window))
        buy_condition = (
            has_history
            & (close > data["moving_average"])
            & (data["rsi"] < buy_threshold)
        )
        sell_condition = (
            has_history
            & (
                (close < data["moving_average"])
                | (data["rsi"] > sell_threshold)
            )
        )
        _assign_signals(data, buy_condition, sell_condition)

    data["signal"] = data["signal"].apply(lambda s: s.value if hasattr(s, "value") else s)
    return data


def add_strategy_signals(
    price_data: pd.DataFrame,
    window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
) -> pd.DataFrame:
    """Add SMA values and signals; kept for older tests and CLI examples."""
    return generate_strategy_signals(price_data, strategy_type="sma", window=window)
