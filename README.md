# MacroSignal Backtester

MacroSignal is a small command-line backtesting simulator for a university
software engineering MVP. It reads historical close prices from a CSV file,
applies one simple moving average strategy, simulates virtual trades, and
prints a final performance summary.

## What This Project Does

- Loads historical price data from a CSV file.
- Validates that the CSV contains `date` and `close` columns.
- Sorts price data by date.
- Calculates a 20-period simple moving average.
- Buys when the close price is above the moving average.
- Sells when the close price is below the moving average.
- Simulates trades using a fixed starting capital of `$10,000`.
- Applies a `0.1%` transaction fee to each buy or sell.
- Prints final capital, profit or loss, trade counts, and final holding status.

## What This Project Does Not Do

This is not a real trading bot. It does not connect to exchanges, use API keys,
place live orders, stream live market data, manage real money, use cloud
services, or implement advanced risk management.

## Installation

Create a virtual environment if desired, then install the lightweight
dependencies:

```bash
pip install -r requirements.txt
```

## Running the Backtest

From the project root, run:

```bash
python main.py data/sample_prices.csv
```

The output includes:

- Start capital
- End capital
- Profit or loss in dollars
- Profit or loss in percent
- Number of buy trades
- Number of sell trades
- Final status

## Using the Frontend

Open `frontend/index.html` in a browser. The page runs fully in the browser and
does not require a web server. You can paste CSV data, upload a CSV file, or load
the included sample data, then run the moving average backtest visually. The
frontend also supports adjustable starting capital, moving average window, and
transaction fee values for interactive scenario testing.

## Running Tests

```bash
pytest
```

## Expected CSV Format

The input CSV must contain at least these columns:

```csv
date,close
2024-01-01,100.00
2024-01-02,101.50
2024-01-03,99.75
```

Rows with invalid dates, missing close prices, or non-positive close prices are
skipped. If no valid rows remain, the program exits with a clear error message.
