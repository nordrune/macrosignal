# MacroSignal

MacroSignal is a small trading backtester for a software engineering project.
It loads historical close prices, creates strategy signals, simulates virtual
buy and sell trades, and shows the result in a browser dashboard.

The project is meant for learning and comparison of simple trading rules. It
does not connect to a broker and it does not place real trades.

## Features

- Load historical prices from Yahoo Finance or from a CSV file.
- Run backtests with a configurable starting balance and transaction fee.
- Compare several rule-based strategies:
  - Simple Moving Average (SMA)
  - Exponential Moving Average (EMA)
  - Relative Strength Index (RSI)
  - MACD
  - Bollinger Bands
  - Combined SMA + RSI filter
- Show performance metrics:
  - final capital
  - profit or loss
  - strategy return
  - Sharpe ratio
  - maximum drawdown
  - win rate
  - buy-and-hold return
- Display price, indicator, drawdown, and trade information in the web UI.
- Run a simple grid search to find better parameters for a selected strategy.
- Switch the dashboard between German and English.
- Explain trading terms in the UI with small tooltips.

## Project Structure

```text
.
├── data/
│   └── sample_prices.csv          Example CSV input
├── frontend/
│   ├── app.js                     Dashboard state, API calls, charts
│   ├── csv.js                     CSV parsing and sample CSV data
│   ├── formatters.js              Shared value formatting helpers
│   ├── i18n.js                    German/English translations
│   ├── index.html                 Dashboard markup
│   ├── strategy-config.js         Strategy form and legend mapping
│   └── styles.css                 Dashboard styling
├── tests/                         Unit and API tests
├── trading_backtester/
│   ├── api.py                     FastAPI routes
│   ├── backtester.py              Trade simulation and optimizer
│   ├── data_loader.py             CSV loading and validation
│   ├── main.py                    CLI and server entry point
│   ├── models.py                  Shared dataclasses and enums
│   └── strategy.py                Indicators and signal generation
├── main.py                        Thin root entry point
├── requirements.txt
└── pytest.ini
```

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Run the Dashboard

```bash
python -m trading_backtester.main --server
```

Then open:

```text
http://127.0.0.1:8000/
```

## Run a CLI Backtest

```bash
python -m trading_backtester.main data/sample_prices.csv
```

The CSV file must contain at least these columns:

```csv
date,close
2024-01-01,100.00
2024-01-02,101.00
```

## Tests

```bash
pytest
```

The tests cover CSV validation, indicator calculations, signal generation,
backtest accounting, optimizer output, and the API endpoints.

## Documentation Style

The codebase uses one documentation style across backend and frontend:

- Python modules start with a module docstring that explains the file purpose.
- Public Python functions and dataclasses use concise docstrings with inputs,
  outputs, and important error cases.
- Frontend helper modules use JSDoc for exported functions.
- `frontend/app.js` uses section comments for the main UI areas and short
  function comments for API calls, rendering, charting, and event handling.
- Comments should explain intent, data flow, or a non-obvious decision. They
  should not repeat what a single line of code already says.

## Current Scope

Included:

- historical price backtesting
- virtual all-in/all-out trades
- transaction fees
- strategy metrics and trade logs
- local dashboard

Not included:

- real broker integration
- live trading
- order book or intraday execution simulation
- portfolio allocation across several assets
- news, macro, or geopolitical event analysis
