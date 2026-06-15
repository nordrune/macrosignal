# tests

## Purpose

pytest suite + JSON fixtures for API contract and backtester correctness.

## Ownership

| File | Covers |
|------|--------|
| `test_api_contract.py` | `/health`, `/api/backtest` schema, `/api/optimize` 400, `/api/ticker` (mocked yfinance) |
| `test_phase2_features.py` | Optimizer unit + `/api/optimize` |
| `test_backtester*.py` | Simulation accounting |
| `test_strategy*.py` | Indicators and signals |
| `test_data_loader.py` | CSV validation |
| `fixtures/smoke_backtest_request.json` | devenv `qa:smoke` API payload |

## Local contracts

- Use `litestar.testing.TestClient` for HTTP route tests
- API tests assert JSON keys, not implementation details

## Verification

`qa:smoke` curls `POST /api/backtest` and `GET /` on the web dev server (expects repo URL in footer).

```bash
devenv tasks run qa:pytest qa:smoke
```

## Child DOX Index

(none)