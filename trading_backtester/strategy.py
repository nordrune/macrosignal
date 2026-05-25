"""Trading strategies and technical indicators."""

import pandas as pd

from trading_backtester.models import Signal


DEFAULT_MOVING_AVERAGE_WINDOW = 20


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


def calculate_ema(close_prices: pd.Series, window: int = 20) -> pd.Series:
    """Calculate the exponential moving average (EMA) for close prices."""
    if window < 1:
        raise ValueError("EMA window must be at least 1.")
    return close_prices.ewm(span=window, adjust=False).mean()


def calculate_rsi(close_prices: pd.Series, window: int = 14) -> pd.Series:
    """Calculate the Relative Strength Index (RSI) using Wilder's smoothing."""
    if window < 1:
        raise ValueError("RSI window must be at least 1.")
    delta = close_prices.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    
    avg_gain = gain.ewm(alpha=1 / window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / window, adjust=False).mean()
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    # Replace NaN with 50 (neutral) when there is no price change
    return rsi.fillna(50)


def calculate_macd(
    close_prices: pd.Series,
    fast: int = 12,
    slow: int = 26,
    signal_window: int = 9,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Calculate the MACD line, Signal line, and MACD histogram."""
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
    """Calculate Bollinger Bands (Middle, Upper, Lower)."""
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
    strategy_type: str = "sma",
    **kwargs,
) -> pd.DataFrame:
    """Generate indicators and signals for a selected strategy.

    Args:
        price_data: Data frame with a numeric ``close`` column.
        strategy_type: Strategy to apply ("sma", "ema", "rsi", "macd", "bollinger").
        **kwargs: Strategic parameters.

    Returns:
        Copy of price_data with indicators and ``signal`` columns.
    """
    data = price_data.copy()
    close = data["close"]
    data["signal"] = Signal.HOLD

    if strategy_type == "sma":
        window = kwargs.get("window", 20)
        data["moving_average"] = calculate_moving_average(close, window)
        
        # Signals
        buy_cond = close > data["moving_average"]
        sell_cond = close < data["moving_average"]
        data.loc[buy_cond & data["moving_average"].notna(), "signal"] = Signal.BUY
        data.loc[sell_cond & data["moving_average"].notna(), "signal"] = Signal.SELL

    elif strategy_type == "ema":
        window = kwargs.get("window", 20)
        data["moving_average"] = calculate_ema(close, window)
        
        # Signals
        buy_cond = close > data["moving_average"]
        sell_cond = close < data["moving_average"]
        data.loc[buy_cond, "signal"] = Signal.BUY
        data.loc[sell_cond, "signal"] = Signal.SELL

    elif strategy_type == "rsi":
        window = kwargs.get("window", 14)
        buy_threshold = kwargs.get("buy_threshold", 30)
        sell_threshold = kwargs.get("sell_threshold", 70)
        data["rsi"] = calculate_rsi(close, window)
        
        # Signals
        valid_idx = close.index >= (window - 1)
        data.loc[valid_idx & (data["rsi"] < buy_threshold), "signal"] = Signal.BUY
        data.loc[valid_idx & (data["rsi"] > sell_threshold), "signal"] = Signal.SELL

    elif strategy_type == "macd":
        fast = kwargs.get("fast", 12)
        slow = kwargs.get("slow", 26)
        signal_window = kwargs.get("signal_window", 9)
        macd_line, signal_line, hist = calculate_macd(close, fast, slow, signal_window)
        data["macd_line"] = macd_line
        data["signal_line"] = signal_line
        data["macd_histogram"] = hist
        
        # Signals
        valid_idx = close.index >= (max(fast, slow) - 1)
        data.loc[valid_idx & (macd_line > signal_line), "signal"] = Signal.BUY
        data.loc[valid_idx & (macd_line < signal_line), "signal"] = Signal.SELL

    elif strategy_type == "bollinger":
        window = kwargs.get("window", 20)
        num_std = kwargs.get("num_std", 2.0)
        middle, upper, lower = calculate_bollinger_bands(close, window, num_std)
        data["bb_middle"] = middle
        data["bb_upper"] = upper
        data["bb_lower"] = lower
        
        # Signals
        valid_idx = middle.notna()
        data.loc[valid_idx & (close < lower), "signal"] = Signal.BUY
        data.loc[valid_idx & (close > upper), "signal"] = Signal.SELL

    elif strategy_type == "combined":
        sma_window = kwargs.get("sma_window", 20)
        rsi_window = kwargs.get("rsi_window", 14)
        buy_threshold = kwargs.get("buy_threshold", 50)
        sell_threshold = kwargs.get("sell_threshold", 70)
        
        data["moving_average"] = calculate_moving_average(close, sma_window)
        data["rsi"] = calculate_rsi(close, rsi_window)
        
        # Signals
        valid_idx = close.index >= (max(sma_window, rsi_window) - 1)
        buy_cond = valid_idx & (close > data["moving_average"]) & (data["rsi"] < buy_threshold)
        sell_cond = valid_idx & ((close < data["moving_average"]) | (data["rsi"] > sell_threshold))
        
        data.loc[buy_cond, "signal"] = Signal.BUY
        data.loc[sell_cond, "signal"] = Signal.SELL


    else:
        raise ValueError(f"Unknown strategy type: {strategy_type}")

    # Map signals to raw string values
    data["signal"] = data["signal"].apply(lambda s: s.value if hasattr(s, "value") else s)
    return data


def add_strategy_signals(
    price_data: pd.DataFrame,
    window: int = DEFAULT_MOVING_AVERAGE_WINDOW,
) -> pd.DataFrame:
    """Add moving average values and strategy signals to price data (Backward compatibility)."""
    return generate_strategy_signals(price_data, strategy_type="sma", window=window)
