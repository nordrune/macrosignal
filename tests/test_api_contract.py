"""API contract tests for Litestar routes."""

import json
from pathlib import Path

from litestar.testing import TestClient
from trading_backtester.api import app

FIXTURE = Path(__file__).parent / "fixtures" / "smoke_backtest_request.json"


def test_api_backtest_contract():
    payload = json.loads(FIXTURE.read_text())
    with TestClient(app=app) as client:
        response = client.post("/api/backtest", json=payload)

    assert response.status_code == 200
    data = response.json()
    for key in (
        "end_capital",
        "start_capital",
        "profit_loss",
        "profit_loss_percent",
        "capital_history",
        "series_data",
        "trades",
    ):
        assert key in data


def test_api_backtest_missing_source_returns_400():
    with TestClient(app=app) as client:
        response = client.post("/api/backtest", json={"strategy_type": "sma"})

    assert response.status_code == 400
