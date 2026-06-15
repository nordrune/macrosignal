# MacroSignal

MacroSignal is a trading backtester for a software engineering project. It loads
historical close prices, generates strategy signals, simulates virtual buy/sell
trades, and shows results in a browser dashboard.

Educational tool only — no broker integration or live trading.

## Features

- Load prices from Yahoo Finance or a CSV file
- Backtest with configurable starting balance and transaction fee
- Compare SMA and EMA strategies
- Performance metrics: final capital, P/L, Sharpe, max drawdown, win rate, buy-and-hold
- Canvas charts for price, indicator, drawdown, and trades
- Grid-search optimizer for strategy parameters
- German/English UI with tooltips for trading terms
- CSV export of run parameters and trades

## Project Structure

```text
.
├── data/
│   └── sample_prices.csv          Example CSV input
├── web/                           SvelteKit 2 dashboard (Bun, Tailwind v4)
├── tests/
│   ├── fixtures/                  Smoke payloads for devenv test
│   └── …                          Unit and API contract tests
├── trading_backtester/
│   ├── api.py                     Litestar routes
│   ├── dto.py                     msgspec request/response DTOs
│   ├── backtester.py              Trade simulation and optimizer
│   ├── data_loader.py             CSV loading and validation
│   ├── main.py                    CLI and server entry point
│   ├── models.py                  Shared dataclasses and enums
│   └── strategy.py                Indicators and signal generation
├── main.py                        Thin root entry point
├── AGENTS.md                      DOX index (read before editing)
├── devenv.nix                     Dev environment (Nix + UV + Bun)
├── pyproject.toml                 Python dependencies (UV)
└── pytest.ini
```

## Setup

Requires [devenv](https://devenv.sh/getting-started/) and [Nix](https://nixos.org/download/).
Python and web tooling run through devenv — do not use bare `uv`, `pip`, or host Node.

```bash
devenv allow          # once, trust this project
direnv allow          # once, auto-load env when you cd into the repo
devenv shell          # syncs Python (UV) and web (Bun) deps on first entry
```

Process settings (`HOST`, `API_PORT`, `WEB_PORT`, `API_ORIGIN`) live in `devenv.nix`.

## Run the App

Development — API and SvelteKit dev servers:

```bash
devenv up
```

Open the dashboard at `http://127.0.0.1:5173`. The web dev server proxies
`/api` and `/health` to the Litestar API on `:41793`.

Production-style API (no Python reload):

```bash
ENV=prod devenv --no-tui up api
```

Build the web app for production (Bun adapter):

```bash
cd web && bun run build
cd web && bun run build/index.js   # serves on $PORT (default from adapter)
```

Set `API_ORIGIN` so the Bun server can proxy API requests to Litestar.

## CLI Backtest

From the devenv environment:

```bash
python -m trading_backtester.main data/sample_prices.csv
```

CSV must include `date` and `close` columns:

```csv
date,close
2024-01-01,100.00
2024-01-02,101.00
```

## Development

A pre-push hook runs full QA via `devenv test` (format, lint, typecheck, pytest, smoke).

```bash
devenv test
```

Do not run `devenv up` and `devenv test` at the same time — both bind API port 41793.

Individual tasks:

```bash
devenv tasks run qa:format          # Python ruff format
devenv tasks run qa:lint            # Python ruff check
devenv tasks run qa:typecheck       # Python ty
devenv tasks run qa:web             # Oxc + svelte-check (web/)
devenv tasks run qa:pytest
devenv tasks run qa:smoke           # API POST + web HTML check
devenv tasks run build:web          # production SvelteKit build
```

Process shortcuts:

```bash
devenv up              # api + web
devenv up api          # Litestar only
devenv up web          # SvelteKit only (API must be reachable)
```

Web-only QA:

```bash
cd web && bun run qa                # oxfmt, oxlint, svelte-check
```

## Documentation

- Root and package `AGENTS.md` files describe architecture, contracts, and verification.
- Python modules use module docstrings; public APIs use concise docstrings.
- Web helpers use brief file-level comments where intent is non-obvious.

## Scope

Included: historical backtesting, all-in/all-out virtual trades, fees, metrics, local dashboard.

Not included: broker integration, live trading, intraday execution, multi-asset portfolios, news/macro analysis.