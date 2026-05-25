# MacroSignal Pro — Advanced Trading Dashboard & Backtester

MacroSignal Pro is an interactive, professional-grade quantitative backtesting simulator and dashboard. It supports live market data retrieval, advanced indicator generation, parameter sweep optimization, and interactive visualizations.

---

## 🚀 Key Features

### 1. Advanced Strategy Suite
- **Simple Moving Average (SMA)** & **Exponential Moving Average (EMA)** crossovers.
- **Relative Strength Index (RSI)** momentum oscillator.
- **MACD (Moving Average Convergence Divergence)** signal line crossovers.
- **Bollinger Bands** mean reversion bounds.
- **Combined SMA + RSI Master Strategy**: Uses moving average trends filtered by RSI thresholds to reduce false signal breakouts.

### 2. Dual Data Sources
- **Live Market Data**: Integrates directly with the Yahoo Finance API (`yfinance`) to fetch historical data for custom tickers (e.g., `AAPL`, `BTC-USD`, `TSLA`).
- **Custom CSV Uploads**: Supports local CSV imports with date and close column mapping.

### 3. Quantitative Optimizer & Analytics
- **Parameter Sweep Optimizer**: Serverseitiger Grid-Search-Algorithmus zur automatischen Ermittlung der profitabelsten Parameter-Einstellungen.
- **Advanced Financial Metrics**: Sharpe Ratio, Maximum Drawdown (DD%), Win Rate, and Buy & Hold comparison returns.
- **Trade Detail Inspector**: Interactive analysis of individual trades (holding duration, trade net profit, individual trade ROI, and commission fee tracking).

### 4. High-Fidelity UI Dashboard
- Responsive neon-dark theme with real-time synchronized canvas charting.
- Adjustable parameters, auto-run toggles, and live interactive chart hover tooltips.

---

## 🛠️ Installation & Setup

1. **Clone & Navigate**:
   ```bash
   cd macrosignal
   ```

2. **Setup Environment & Dependencies**:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```

---

## ⚙️ Running the Application

### 1. Web Dashboard Server (Recommended)
To launch the FastAPI backend server and serve the interactive web interface, run:
```bash
python -m trading_backtester.main --server
```
Once started, open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in your browser.

### 2. Command Line Interface (CLI)
You can still run simple backtests on custom CSV files directly in the terminal:
```bash
python -m trading_backtester.main data/sample_prices.csv
```

---

## 🧪 Testing

Execute the automated test suite using `pytest`:
```bash
pytest
```
All unit tests verify strategy signal logic, optimizer calculations, metric performance correctness, and API endpoint routing.
