# tests

## Purpose

pytest suite + JSON fixtures for API contract and backtester correctness.

## Ownership

| File | Covers |
|------|--------|
| `test_api_contract.py` | Litestar `/api/backtest` shape and 400 cases |
| `test_phase2_features.py` | Optimizer unit + `/api/optimize` |
| `test_backtester*.py` | Simulation accounting |
| `test_strategy*.py` | Indicators and signals |
| `test_data_loader.py` | CSV validation |
| `fixtures/smoke_backtest_request.json` | devenv `qa:smoke` payload |

## Local contracts

- Use `litestar.testing.TestClient`, not FastAPI client
- API tests assert JSON keys, not implementation details

## Verification

```bash
devenv tasks run qa:pytest qa:smoke
```

## Child DOX Index

(none)