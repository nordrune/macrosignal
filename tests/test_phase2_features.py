"""Unit tests for Phase 2 macro trading bot features."""

import pandas as pd
from fastapi.testclient import TestClient
from trading_backtester.api import app
from trading_backtester.backtester import optimize_strategy_parameters


def test_optimize_strategy_parameters():
    price_data = pd.DataFrame(
        {
            "date": [f"2024-01-{i:02d}" for i in range(1, 21)],
            "close": [
                10.0 + (i % 3) * 2.0 - (i % 2) * 1.0 for i in range(1, 21)
            ],
        }
    )

    runs = optimize_strategy_parameters(
        price_data=price_data,
        starting_capital=10000.0,
        transaction_fee_rate=0.001,
        strategy_type="sma",
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

    prices = [
        {"date": f"2024-01-{i:02d}", "close": 100.0 + i * 2.0}
        for i in range(1, 15)
    ]

    payload = {
        "prices": prices,
        "starting_capital": 10000.0,
        "transaction_fee_percent": 0.1,
        "strategy_type": "ema",
    }

    response = client.post("/api/optimize", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["strategy_type"] == "ema"
    assert "runs" in data
    assert len(data["runs"]) <= 5
