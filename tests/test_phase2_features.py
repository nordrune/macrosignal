"""Unit tests for Phase 2 macro trading bot features."""

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from trading_backtester.api import app
from trading_backtester.backtester import optimize_strategy_parameters
from trading_backtester.strategy import generate_strategy_signals


def test_generate_strategy_signals_combined():
    # 5 data points
    price_data = pd.DataFrame({
        "date": ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"],
        "close": [10.0, 15.0, 20.0, 12.0, 18.0],
    })
    
    # Run Combined strategy
    res = generate_strategy_signals(
        price_data,
        strategy_type="combined",
        sma_window=2,
        rsi_window=2,
        buy_threshold=60,
        sell_threshold=70
    )
    
    assert "moving_average" in res.columns
    assert "rsi" in res.columns
    assert "signal" in res.columns


def test_optimize_strategy_parameters():
    # Provide a simple series of dates and prices
    price_data = pd.DataFrame({
        "date": [f"2024-01-{i:02d}" for i in range(1, 21)],
        "close": [10.0 + (i % 3) * 2.0 - (i % 2) * 1.0 for i in range(1, 21)],
    })
    
    # Sweep SMA parameters
    runs = optimize_strategy_parameters(
        price_data=price_data,
        starting_capital=10000.0,
        transaction_fee_rate=0.001,
        strategy_type="sma"
    )
    
    assert isinstance(runs, list)
    assert len(runs) <= 5
    for run in runs:
        assert "params" in run
        assert "end_capital" in run
        assert "profit_loss_percent" in run
        assert "sharpe_ratio" in run


def test_api_optimize():
    client = TestClient(app)
    
    # Payload using custom price points
    prices = [
        {"date": f"2024-01-{i:02d}", "close": 100.0 + i * 2.0}
        for i in range(1, 15)
    ]
    
    payload = {
        "prices": prices,
        "starting_capital": 10000.0,
        "transaction_fee_percent": 0.1,
        "strategy_type": "rsi"
    }
    
    response = client.post("/api/optimize", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["strategy_type"] == "rsi"
    assert "runs" in data
    assert len(data["runs"]) <= 5
