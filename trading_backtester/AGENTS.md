# trading_backtester

## Purpose

Python package: price loading, strategy signals, backtest simulation, Litestar HTTP API, CLI.

## Ownership

| Module | Role |
|--------|------|
| `api.py` | Litestar routes only; no static file serving |
| `dto.py` | msgspec request/response structs (API contract) |
| `models.py` | Domain dataclasses (`BacktestResult`, enums) |
| `backtester.py` | Simulation + optimizer grid search |
| `strategy.py` | SMA/EMA indicators and signals |
| `data_loader.py` | CSV loading for CLI |
| `main.py` | CLI; `--server` delegates to `litestar run` |

## Local contracts

- Route handler body params must not be named `request` (Litestar injects HTTP Request)
- POST routes return HTTP 200 (not Litestar default 201)
- Price source: either `prices[]` or `symbol` + Yahoo fetch
- Price frames: `polars.DataFrame` with `date` + `close`; yfinance boundary extracts rows without importing pandas
- Parameter optimizer: archived (`OPTIMIZER_ENABLED = False` in `api.py`); grid search code kept in `backtester.py`
- CLI CSV path must remain unchanged for `python -m trading_backtester.main`

## Work guidance

- Keep business logic pure; API layer only loads data and maps DTOs
- Add deps only with ponytail justification in a comment

## Verification

```bash
devenv tasks run qa:pytest
python -m trading_backtester.main data/sample_prices.csv
```

## Child DOX Index

(none, flat package)