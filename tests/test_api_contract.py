"""API contract tests for Litestar routes."""

import json
from pathlib import Path
from unittest.mock import patch

import pandas as pd
from litestar.testing import TestClient
from trading_backtester.api import MAX_PRICE_POINTS, app

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


def test_api_backtest_too_many_prices_returns_400():
    prices = [
        {"date": f"2024-01-{(i % 28) + 1:02d}", "close": 100.0}
        for i in range(MAX_PRICE_POINTS + 1)
    ]
    with TestClient(app=app) as client:
        response = client.post(
            "/api/backtest",
            json={"prices": prices, "strategy_type": "sma"},
        )

    assert response.status_code == 400


def test_api_ticker_not_found_returns_404():
    with patch("trading_backtester.api.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = pd.DataFrame()
        with TestClient(app=app) as client:
            response = client.get("/api/ticker", params={"symbol": "INVALID"})

    assert response.status_code == 404


def test_health_returns_ok():
    with TestClient(app=app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_backtest_response_full_schema():
    payload = json.loads(FIXTURE.read_text())
    with TestClient(app=app) as client:
        response = client.post("/api/backtest", json=payload)

    assert response.status_code == 200
    data = response.json()
    for key in (
        "start_capital",
        "end_capital",
        "profit_loss",
        "profit_loss_percent",
        "buy_trades",
        "sell_trades",
        "final_status",
        "sharpe_ratio",
        "max_drawdown",
        "win_rate",
        "buy_and_hold_return",
        "capital_history",
        "series_data",
        "trades",
    ):
        assert key in data

    trade = data["trades"][0]
    for key in ("date", "type", "price", "units", "fee", "cashBalance"):
        assert key in trade

    series_point = data["series_data"][0]
    for key in ("date", "close", "signal", "moving_average"):
        assert key in series_point

    capital_point = data["capital_history"][0]
    for key in ("date", "capital"):
        assert key in capital_point


def test_api_optimize_missing_source_returns_400():
    with TestClient(app=app) as client:
        response = client.post("/api/optimize", json={"strategy_type": "sma"})

    assert response.status_code == 400


def test_api_ticker_success():
    index = pd.DatetimeIndex(pd.to_datetime(["2024-01-01", "2024-01-02"]))
    index.name = "Date"
    frame = pd.DataFrame({"Close": [42000.0, 42100.0]}, index=index)
    with patch("trading_backtester.api.yf.Ticker") as mock_ticker:
        mock_ticker.return_value.history.return_value = frame
        with TestClient(app=app) as client:
            response = client.get("/api/ticker", params={"symbol": "BTC-USD"})

    assert response.status_code == 200
    data = response.json()
    assert data["symbol"] == "BTC-USD"
    assert len(data["prices"]) == 2
