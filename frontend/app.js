"use strict";

const DEFAULT_STARTING_CAPITAL = 10000;
const DEFAULT_FEE_PERCENT = 0.1;

const SAMPLE_CSV = `date,close
2024-01-01,100.00
2024-01-02,101.00
2024-01-03,102.00
2024-01-04,103.00
2024-01-05,104.00
2024-01-08,105.00
2024-01-09,106.00
2024-01-10,107.00
2024-01-11,108.00
2024-01-12,109.00
2024-01-15,110.00
2024-01-16,111.00
2024-01-17,112.00
2024-01-18,113.00
2024-01-19,114.00
2024-01-22,115.00
2024-01-23,116.00
2024-01-24,117.00
2024-01-25,118.00
2024-01-26,119.00
2024-01-29,121.00
2024-01-30,123.00
2024-01-31,125.00
2024-02-01,127.00
2024-02-02,129.00
2024-02-05,128.00
2024-02-06,126.00
2024-02-07,124.00
2024-02-08,121.00
2024-02-09,118.00
2024-02-12,115.00
2024-02-13,112.00
2024-02-14,109.00
2024-02-15,106.00
2024-02-16,103.00`;

// Element cache
const el = {
  // Navigation & Config
  sourceApiBtn: document.getElementById("sourceApiBtn"),
  sourceCsvBtn: document.getElementById("sourceCsvBtn"),
  apiSettings: document.getElementById("apiSettings"),
  csvSettings: document.getElementById("csvSettings"),
  tickerInput: document.getElementById("tickerInput"),
  fetchDataBtn: document.getElementById("fetchDataBtn"),
  periodSelect: document.getElementById("periodSelect"),
  intervalSelect: document.getElementById("intervalSelect"),
  csvFile: document.getElementById("csvFile"),
  csvText: document.getElementById("csvText"),
  dropZone: document.getElementById("dropZone"),
  strategySelect: document.getElementById("strategySelect"),
  startingCapital: document.getElementById("startingCapital"),
  feeRate: document.getElementById("feeRate"),
  autoRun: document.getElementById("autoRun"),
  runButton: document.getElementById("runButton"),
  optimizeBtn: document.getElementById("optimizeBtn"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  statusMessage: document.getElementById("statusMessage"),
  activeStrategy: document.getElementById("activeStrategy"),
  activeTicker: document.getElementById("activeTicker"),
  activeFee: document.getElementById("activeFee"),

  // Metrics
  dataSummary: document.getElementById("dataSummary"),
  startCapital: document.getElementById("startCapital"),
  endCapital: document.getElementById("endCapital"),
  profitLoss: document.getElementById("profitLoss"),
  profitLossPercent: document.getElementById("profitLossPercent"),
  sharpeRatio: document.getElementById("sharpeRatio"),
  maxDrawdown: document.getElementById("maxDrawdown"),
  winRate: document.getElementById("winRate"),
  buyAndHoldReturn: document.getElementById("buyAndHoldReturn"),
  tradeCount: document.getElementById("tradeCount"),
  finalStatus: document.getElementById("finalStatus"),

  // Charts
  priceChart: document.getElementById("priceChart"),
  indicatorChart: document.getElementById("indicatorChart"),
  chartTooltip: document.getElementById("chartTooltip"),
  maLegend: document.getElementById("maLegend"),
  bbUpperLegend: document.getElementById("bbUpperLegend"),
  bbLowerLegend: document.getElementById("bbLowerLegend"),

  // Inspector
  selectedDate: document.getElementById("selectedDate"),
  selectedClose: document.getElementById("selectedClose"),
  selectedAverage: document.getElementById("selectedAverage"),
  selectedSignal: document.getElementById("selectedSignal"),

  // Trade Table
  tradeTableBody: document.getElementById("tradeTableBody"),

  // Trade Inspector Panel
  tradeInspectorPanel: document.getElementById("tradeInspectorPanel"),
  closeInspectorBtn: document.getElementById("closeInspectorBtn"),
  tradeHoldDays: document.getElementById("tradeHoldDays"),
  tradeNetProfit: document.getElementById("tradeNetProfit"),
  tradeRoi: document.getElementById("tradeRoi"),
  tradeFees: document.getElementById("tradeFees"),

  // Optimization Modal
  optimizationModal: document.getElementById("optimizationModal"),
  closeOptimizeModalBtn: document.getElementById("closeOptimizeModalBtn"),
  optimizerLoading: document.getElementById("optimizerLoading"),
  optimizerResults: document.getElementById("optimizerResults"),
  optimizeTableBody: document.getElementById("optimizeTableBody")
};

// Application State
let state = {
  dataSource: "api", // "api" or "csv"
  strategyData: [],  // parsed timeseries (from API)
  trades: [],        // list of executed trades
  capitalHistory: [], // daily portfolio values
  winRate: 0,
  sharpeRatio: 0,
  maxDrawdown: 0,
  buyAndHoldReturn: 0,
  optimizationRuns: [], // cached optimization configurations
  
  // Interactive Selection
  selectedPointIndex: null,
  selectedTradeIndex: null,
  chartGeom: null,
  subChartGeom: null,
  animationFrame: null,
  pendingRunTimeout: null
};

// --- SOURCE & STRATEGY TOGGLES ---

function setDataSource(source) {
  state.dataSource = source;
  if (source === "api") {
    el.sourceApiBtn.classList.add("active");
    el.sourceCsvBtn.classList.remove("active");
    el.apiSettings.classList.add("active");
    el.csvSettings.classList.remove("active");
  } else {
    el.sourceApiBtn.classList.remove("active");
    el.sourceCsvBtn.classList.add("active");
    el.apiSettings.classList.remove("active");
    el.csvSettings.classList.add("active");
  }
  scheduleAutoRun();
}

function handleStrategyChange() {
  const strategy = el.strategySelect.value;
  // Hide all parameter groups
  document.querySelectorAll(".param-group").forEach((group) => {
    group.classList.remove("active");
  });
  // Show active strategy params
  const activeParamGroup = document.getElementById(`params_${strategy}`);
  if (activeParamGroup) {
    activeParamGroup.classList.add("active");
  }

  // Adjust chart legend label
  if (strategy === "sma") {
    el.maLegend.innerHTML = '<i class="legend-line indicator-line" style="background-color: #00e6c3;"></i>SMA';
    el.maLegend.style.display = "inline-flex";
    el.bbUpperLegend.hidden = true;
    el.bbLowerLegend.hidden = true;
  } else if (strategy === "ema") {
    el.maLegend.innerHTML = '<i class="legend-line indicator-line" style="background-color: #00e6c3;"></i>EMA';
    el.maLegend.style.display = "inline-flex";
    el.bbUpperLegend.hidden = true;
    el.bbLowerLegend.hidden = true;
  } else if (strategy === "rsi") {
    el.maLegend.style.display = "none";
    el.bbUpperLegend.hidden = true;
    el.bbLowerLegend.hidden = true;
  } else if (strategy === "macd") {
    el.maLegend.style.display = "none";
    el.bbUpperLegend.hidden = true;
    el.bbLowerLegend.hidden = true;
  } else if (strategy === "bollinger") {
    el.maLegend.innerHTML = '<i class="legend-line indicator-line" style="background-color: #00bfa5;"></i>BB Middle';
    el.maLegend.style.display = "inline-flex";
    el.bbUpperLegend.hidden = false;
    el.bbLowerLegend.hidden = false;
  } else if (strategy === "combined") {
    el.maLegend.innerHTML = '<i class="legend-line indicator-line" style="background-color: #00e6c3;"></i>SMA';
    el.maLegend.style.display = "inline-flex";
    el.bbUpperLegend.hidden = true;
    el.bbLowerLegend.hidden = true;
  }
  
  scheduleAutoRun();
}

// --- CSV PARSER ---

function parseCsvText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV must include a header and at least one price row.");
  }
  
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const dateIdx = headers.indexOf("date");
  const closeIdx = headers.indexOf("close");
  
  if (dateIdx === -1 || closeIdx === -1) {
    throw new Error("CSV file must contain 'date' and 'close' columns.");
  }
  
  const pricePoints = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    if (cols.length <= Math.max(dateIdx, closeIdx)) continue;
    
    const dateStr = cols[dateIdx];
    const closeVal = parseFloat(cols[closeIdx]);
    
    if (dateStr && !isNaN(closeVal) && closeVal > 0) {
      pricePoints.push({
        date: dateStr,
        close: closeVal
      });
    }
  }
  
  if (pricePoints.length === 0) {
    throw new Error("CSV has no valid date or close values.");
  }
  
  return pricePoints;
}

// --- BACKEND API CONNECTOR ---

function getStrategyParams() {
  const strategy = el.strategySelect.value;
  if (strategy === "sma") {
    return { window: parseInt(document.getElementById("sma_window").value, 10) || 20 };
  } else if (strategy === "ema") {
    return { window: parseInt(document.getElementById("ema_window").value, 10) || 20 };
  } else if (strategy === "rsi") {
    return {
      window: parseInt(document.getElementById("rsi_window").value, 10) || 14,
      buy_threshold: parseInt(document.getElementById("rsi_buy").value, 10) || 30,
      sell_threshold: parseInt(document.getElementById("rsi_sell").value, 10) || 70
    };
  } else if (strategy === "macd") {
    return {
      fast: parseInt(document.getElementById("macd_fast").value, 10) || 12,
      slow: parseInt(document.getElementById("macd_slow").value, 10) || 26,
      signal_window: parseInt(document.getElementById("macd_signal").value, 10) || 9
    };
  } else if (strategy === "bollinger") {
    return {
      window: parseInt(document.getElementById("bb_window").value, 10) || 20,
      num_std: parseFloat(document.getElementById("bb_std").value) || 2.0
    };
  } else if (strategy === "combined") {
    return {
      sma_window: parseInt(document.getElementById("comb_sma_window").value, 10) || 20,
      rsi_window: parseInt(document.getElementById("comb_rsi_window").value, 10) || 14,
      buy_threshold: parseInt(document.getElementById("comb_rsi_buy").value, 10) || 50,
      sell_threshold: parseInt(document.getElementById("comb_rsi_sell").value, 10) || 70
    };
  }
  return {};
}

async function runBacktest() {
  setStatus("Executing backtest on backend...", "info");
  
  try {
    const startingCapital = parseFloat(el.startingCapital.value);
    const feeRate = parseFloat(el.feeRate.value);
    const strategy = el.strategySelect.value;
    const strategyParams = getStrategyParams();
    
    if (isNaN(startingCapital) || startingCapital <= 0) {
      throw new Error("Starting capital must be a positive number.");
    }
    if (isNaN(feeRate) || feeRate < 0) {
      throw new Error("Transaction fee cannot be negative.");
    }
    
    let payload = {
      starting_capital: startingCapital,
      transaction_fee_percent: feeRate,
      strategy_type: strategy,
      strategy_params: strategyParams
    };
    
    if (state.dataSource === "api") {
      const ticker = el.tickerInput.value.trim().toUpperCase();
      if (!ticker) {
        throw new Error("Please enter a valid ticker symbol.");
      }
      payload.symbol = ticker;
      payload.period = el.periodSelect.value;
      payload.interval = el.intervalSelect.value;
      
      el.activeTicker.textContent = `Ticker: ${ticker}`;
    } else {
      const prices = parseCsvText(el.csvText.value);
      payload.prices = prices;
      el.activeTicker.textContent = `Ticker: Custom CSV`;
    }
    
    el.activeStrategy.textContent = `Strategy: ${strategy.toUpperCase()}`;
    el.activeFee.textContent = `Fee: ${feeRate}%`;
    
    const response = await fetch("/api/backtest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || "Server error executing backtest.");
    }
    
    const result = await response.json();
    
    // Store results
    state.strategyData = result.series_data;
    state.trades = result.trades;
    state.capitalHistory = result.capital_history;
    state.winRate = result.win_rate;
    state.sharpeRatio = result.sharpe_ratio;
    state.maxDrawdown = result.max_drawdown;
    state.buyAndHoldReturn = result.buy_and_hold_return;
    
    state.selectedPointIndex = null;
    state.selectedTradeIndex = null;
    el.tradeInspectorPanel.hidden = true;
    
    renderResults(result);
    renderTradeLog(result.trades);
    renderSelectedPoint(null);
    animateCharts();
    setStatus("Backtest completed successfully.", "success");
    
  } catch (error) {
    console.error(error);
    setStatus(error.message, "error");
  }
}

// --- PARAMETER OPTIMIZATION SWEET ---

async function runOptimization() {
  el.optimizationModal.hidden = false;
  el.optimizerLoading.hidden = false;
  el.optimizerResults.hidden = true;
  
  try {
    const startingCapital = parseFloat(el.startingCapital.value);
    const feeRate = parseFloat(el.feeRate.value);
    const strategy = el.strategySelect.value;
    
    let payload = {
      starting_capital: startingCapital,
      transaction_fee_percent: feeRate,
      strategy_type: strategy
    };
    
    if (state.dataSource === "api") {
      const ticker = el.tickerInput.value.trim().toUpperCase();
      if (!ticker) throw new Error("Please enter a valid ticker symbol first.");
      payload.symbol = ticker;
      payload.period = el.periodSelect.value;
      payload.interval = el.intervalSelect.value;
    } else {
      payload.prices = parseCsvText(el.csvText.value);
    }
    
    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "Server optimization failed.");
    }
    
    const result = await response.json();
    state.optimizationRuns = result.runs;
    
    renderOptimizationTable(result.runs);
    el.optimizerLoading.hidden = true;
    el.optimizerResults.hidden = false;
    
  } catch (error) {
    console.error(error);
    el.optimizationModal.hidden = true;
    setStatus(`Optimization failed: ${error.message}`, "error");
  }
}

function renderOptimizationTable(runs) {
  if (!runs || runs.length === 0) {
    el.optimizeTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-table-msg">No viable parameters found in optimization.</td>
      </tr>
    `;
    return;
  }
  
  el.optimizeTableBody.innerHTML = runs.map((run, idx) => {
    // Generate param badges
    const badges = Object.entries(run.params)
      .map(([k, v]) => `<span class="optimize-param-badge">${k}: ${v}</span>`)
      .join(" ");
      
    const roiClass = run.profit_loss_percent > 0 ? "positive" : (run.profit_loss_percent < 0 ? "negative" : "");
    const roiPrefix = run.profit_loss_percent > 0 ? "+" : "";
    
    return `
      <tr>
        <td class="font-mono" style="font-weight:700;">#${idx + 1}</td>
        <td>${badges}</td>
        <td class="font-mono">${formatCurrency(run.end_capital)}</td>
        <td class="font-mono ${roiClass}" style="font-weight:700;">${roiPrefix}${run.profit_loss_percent.toFixed(2)}%</td>
        <td class="font-mono">${run.sharpe_ratio.toFixed(2)}</td>
        <td class="font-mono">${run.max_drawdown.toFixed(2)}%</td>
        <td class="font-mono">${run.total_trades}</td>
        <td>
          <button class="optimize-apply-btn" data-run-index="${idx}">Apply</button>
        </td>
      </tr>
    `;
  }).join("");
  
  // Bind Apply buttons
  el.optimizeTableBody.querySelectorAll(".optimize-apply-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const runIdx = parseInt(e.target.dataset.runIndex, 10);
      applyOptimizedParams(state.optimizationRuns[runIdx].params);
    });
  });
}

function applyOptimizedParams(params) {
  const strategy = el.strategySelect.value;
  
  if (strategy === "sma") {
    document.getElementById("sma_window").value = params.window;
  } else if (strategy === "ema") {
    document.getElementById("ema_window").value = params.window;
  } else if (strategy === "rsi") {
    document.getElementById("rsi_window").value = params.window;
    document.getElementById("rsi_buy").value = params.buy_threshold;
    document.getElementById("rsi_sell").value = params.sell_threshold;
  } else if (strategy === "macd") {
    document.getElementById("macd_fast").value = params.fast;
    document.getElementById("macd_slow").value = params.slow;
    document.getElementById("macd_signal").value = params.signal_window;
  } else if (strategy === "bollinger") {
    document.getElementById("bb_window").value = params.window;
    document.getElementById("bb_std").value = params.num_std;
  } else if (strategy === "combined") {
    document.getElementById("comb_sma_window").value = params.sma_window;
    document.getElementById("comb_rsi_window").value = params.rsi_window;
    document.getElementById("comb_rsi_buy").value = params.buy_threshold;
    document.getElementById("comb_rsi_sell").value = params.sell_threshold;
  }
  
  el.optimizationModal.hidden = true;
  runBacktest();
}

function setStatus(msg, type = "info") {
  el.statusMessage.textContent = msg;
  el.statusMessage.className = "status-msg";
  if (type === "error") {
    el.statusMessage.classList.add("error");
  } else if (type === "success") {
    el.statusMessage.classList.add("success");
  }
}

function scheduleAutoRun() {
  if (!el.autoRun.checked) return;
  if (state.pendingRunTimeout) clearTimeout(state.pendingRunTimeout);
  state.pendingRunTimeout = setTimeout(() => {
    runBacktest();
  }, 350);
}

// --- RENDER METRICS & TRADE LOG ---

function formatCurrency(val) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(val);
}

function setSignedText(element, val, formatter) {
  element.textContent = formatter(val);
  element.parentElement.classList.remove("positive", "negative");
  if (val > 0) {
    element.parentElement.classList.add("positive");
  } else if (val < 0) {
    element.parentElement.classList.add("negative");
  }
}

function renderResults(res) {
  el.startCapital.textContent = formatCurrency(res.start_capital);
  el.endCapital.textContent = formatCurrency(res.end_capital);
  
  setSignedText(el.profitLoss, res.profit_loss, formatCurrency);
  setSignedText(el.profitLossPercent, res.profit_loss_percent, (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);
  
  el.sharpeRatio.textContent = res.sharpe_ratio.toFixed(2);
  el.maxDrawdown.textContent = `${res.max_drawdown.toFixed(2)}%`;
  el.winRate.textContent = `${res.win_rate.toFixed(1)}%`;
  
  setSignedText(el.buyAndHoldReturn, res.buy_and_hold_return, (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);
  
  el.tradeCount.textContent = `${res.buy_trades + res.sell_trades} (${res.buy_trades} B / ${res.sell_trades} S)`;
  el.finalStatus.textContent = res.final_status;
  
  // Color the final status badge
  el.finalStatus.className = "status-value";
  if (res.final_status.includes("asset")) {
    el.finalStatus.style.color = "var(--color-profit)";
  } else {
    el.finalStatus.style.color = "var(--accent)";
  }
  
  el.dataSummary.textContent = `${res.series_data.length} valid periods loaded`;
}

function renderTradeLog(trades) {
  if (trades.length === 0) {
    el.tradeTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-table-msg">No buy or sell trades were triggered.</td>
      </tr>
    `;
    return;
  }
  
  el.tradeTableBody.innerHTML = trades.map((t, idx) => {
    const typeLabel = t.type === "buy" ? "Buy" : "Sell";
    const typeClass = t.type === "buy" ? "trade-buy" : "trade-sell";
    return `
      <tr class="trade-row" tabindex="0" data-trade-index="${idx}">
        <td class="font-mono">${t.date}</td>
        <td class="${typeClass}">${typeLabel}</td>
        <td class="font-mono">${formatCurrency(t.price)}</td>
        <td class="font-mono">${t.units.toFixed(6)}</td>
        <td class="font-mono">${formatCurrency(t.fee)}</td>
        <td class="font-mono">${formatCurrency(t.cashBalance)}</td>
      </tr>
    `;
  }).join("");
}

function updateTradeSelection() {
  el.tradeTableBody.querySelectorAll(".trade-row").forEach((row) => {
    const idx = parseInt(row.dataset.tradeIndex, 10);
    row.classList.toggle("is-selected", idx === state.selectedTradeIndex);
  });
}

function showTradeInspector(tradeIdx) {
  const trade = state.trades[tradeIdx];
  if (!trade) {
    el.tradeInspectorPanel.hidden = true;
    return;
  }
  
  const nextTrade = state.trades[tradeIdx + 1] || null;
  const data = state.strategyData;
  
  const entryDate = new Date(trade.date);
  let exitDate = null;
  let exitPrice = 0;
  let exitFee = 0;
  
  if (nextTrade) {
    exitDate = new Date(nextTrade.date);
    exitPrice = nextTrade.price;
    exitFee = nextTrade.fee;
  } else {
    const lastDay = data[data.length - 1];
    exitDate = new Date(lastDay.date);
    exitPrice = lastDay.close;
    exitFee = 0;
  }
  
  const diffTime = Math.abs(exitDate - entryDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  el.tradeHoldDays.textContent = `${diffDays} Day${diffDays === 1 ? '' : 's'}`;
  
  let profit = 0;
  let roi = 0;
  const totalFees = trade.fee + exitFee;
  
  if (trade.type === "buy") {
    profit = (exitPrice - trade.price) * trade.units - totalFees;
    const cost = trade.price * trade.units;
    roi = cost > 0 ? (profit / cost) * 100 : 0;
  } else {
    profit = (trade.price - exitPrice) * trade.units - totalFees;
    const cost = exitPrice * trade.units;
    roi = cost > 0 ? (profit / cost) * 100 : 0;
  }
  
  el.tradeNetProfit.textContent = formatCurrency(profit);
  el.tradeRoi.textContent = `${profit > 0 ? '+' : ''}${roi.toFixed(2)}%`;
  el.tradeFees.textContent = formatCurrency(totalFees);
  
  const profitCard = document.getElementById("tradeProfitCard");
  const roiCard = document.getElementById("tradeRoiCard");
  profitCard.className = "inspector-card";
  roiCard.className = "inspector-card";
  
  if (profit > 0) {
    profitCard.classList.add("positive");
    roiCard.classList.add("positive");
  } else if (profit < 0) {
    profitCard.classList.add("negative");
    roiCard.classList.add("negative");
  }
  
  el.tradeInspectorPanel.hidden = false;
}

function renderSelectedPoint(row) {
  if (!row) {
    el.selectedDate.textContent = "Hover over chart";
    el.selectedClose.textContent = "-";
    el.selectedAverage.textContent = "-";
    el.selectedSignal.textContent = "-";
    el.chartTooltip.hidden = true;
    return;
  }
  
  el.selectedDate.textContent = row.date;
  el.selectedClose.textContent = formatCurrency(row.close);
  
  const strategy = el.strategySelect.value;
  let valStr = "-";
  if (strategy === "sma" || strategy === "ema" || strategy === "combined") {
    valStr = row.moving_average ? formatCurrency(row.moving_average) : "-";
  } else if (strategy === "rsi") {
    valStr = row.rsi ? `${row.rsi.toFixed(2)}` : "-";
  } else if (strategy === "macd") {
    valStr = row.macd_line ? `MACD: ${row.macd_line.toFixed(2)} / Sig: ${row.signal_line.toFixed(2)}` : "-";
  } else if (strategy === "bollinger") {
    valStr = row.bb_middle ? `${formatCurrency(row.bb_middle)}` : "-";
  }
  
  el.selectedAverage.textContent = valStr;
  el.selectedSignal.textContent = row.signal ? row.signal.toUpperCase() : "HOLD";
  
  // Color code signal
  el.selectedSignal.className = "";
  if (row.signal === "buy") {
    el.selectedSignal.style.color = "var(--color-profit)";
  } else if (row.signal === "sell") {
    el.selectedSignal.style.color = "var(--color-loss)";
  } else {
    el.selectedSignal.style.color = "var(--text-main)";
  }
}

// --- DUAL CANVAS CHART DRAWING ---

function getChartHelpers(canvas, margin, dataSize, minVal, maxVal) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  
  const width = rect.width - margin.left - margin.right;
  const height = rect.height - margin.top - margin.bottom;
  const valRange = maxVal - minVal || 1;
  
  const xForIdx = (idx) => margin.left + (idx / (dataSize - 1)) * width;
  const yForVal = (val) => margin.top + ((maxVal - val) / valRange) * height;
  
  return { ctx, xForIdx, yForVal, width, height, rect };
}

function drawGrid(ctx, margin, width, height, minVal, maxVal, rows = 4, formatFn = (v) => v.toFixed(0)) {
  ctx.strokeStyle = "#242a3c";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#9ca3af";
  ctx.font = "9px system-ui";
  ctx.textAlign = "right";
  
  const range = maxVal - minVal;
  for (let i = 0; i <= rows; i++) {
    const y = margin.top + (height / rows) * i;
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(margin.left + width, y);
    ctx.stroke();
    
    const val = maxVal - (range / rows) * i;
    ctx.fillText(formatFn(val), margin.left - 8, y + 3);
  }
}

function drawLine(ctx, data, xForIdx, yForVal, strokeColor, width = 2, progress = 1) {
  if (data.length < 2) return;
  
  const limit = Math.max(1, Math.ceil(data.length * progress));
  ctx.beginPath();
  ctx.lineWidth = width;
  ctx.strokeStyle = strokeColor;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  
  let started = false;
  for (let i = 0; i < limit; i++) {
    const val = data[i].value;
    if (val === null || val === undefined) continue;
    
    const x = xForIdx(data[i].index);
    const y = yForVal(val);
    
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function drawCharts(progress = 1) {
  const data = state.strategyData;
  if (!data || data.length === 0) return;
  
  const strategy = el.strategySelect.value;
  const len = data.length;
  const margin = { top: 12, right: 16, bottom: 12, left: 54 };
  
  // --- 1. RENDER PRICE CHART ---
  const closeVals = data.map((d, i) => ({ index: i, value: d.close }));
  let mainVals = [...closeVals.map(v => v.value)];
  
  if (strategy === "sma" || strategy === "ema" || strategy === "combined") {
    data.forEach((d) => { if (d.moving_average !== null) mainVals.push(d.moving_average); });
  } else if (strategy === "bollinger") {
    data.forEach((d) => {
      if (d.bb_upper !== null) mainVals.push(d.bb_upper);
      if (d.bb_lower !== null) mainVals.push(d.bb_lower);
    });
  }
  
  const minPrice = Math.min(...mainVals);
  const maxPrice = Math.max(...mainVals);
  const pricePad = (maxPrice - minPrice) * 0.05 || 1;
  
  const priceHelpers = getChartHelpers(el.priceChart, margin, len, minPrice - pricePad, maxPrice + pricePad);
  state.chartGeom = priceHelpers;
  
  // Draw Grid & Price Line
  drawGrid(priceHelpers.ctx, margin, priceHelpers.width, priceHelpers.height, minPrice - pricePad, maxPrice + pricePad, 4, formatCurrency);
  drawLine(priceHelpers.ctx, closeVals, priceHelpers.xForIdx, priceHelpers.yForVal, "#f3f4f6", 2.2, progress);
  
  // Draw Overlaid Indicators
  if (strategy === "sma" || strategy === "ema" || strategy === "combined") {
    const maVals = data.map((d, i) => ({ index: i, value: d.moving_average }));
    drawLine(priceHelpers.ctx, maVals, priceHelpers.xForIdx, priceHelpers.yForVal, "#00e6c3", 1.8, progress);
  } else if (strategy === "bollinger") {
    const middleVals = data.map((d, i) => ({ index: i, value: d.bb_middle }));
    const upperVals = data.map((d, i) => ({ index: i, value: d.bb_upper }));
    const lowerVals = data.map((d, i) => ({ index: i, value: d.bb_lower }));
    
    drawLine(priceHelpers.ctx, middleVals, priceHelpers.xForIdx, priceHelpers.yForVal, "#00bfa5", 1.5, progress);
    drawLine(priceHelpers.ctx, upperVals, priceHelpers.xForIdx, priceHelpers.yForVal, "rgba(251, 191, 36, 0.6)", 1.2, progress);
    drawLine(priceHelpers.ctx, lowerVals, priceHelpers.xForIdx, priceHelpers.yForVal, "rgba(251, 191, 36, 0.6)", 1.2, progress);
    
    // Band channel shading
    const limit = Math.max(1, Math.ceil(len * progress));
    priceHelpers.ctx.fillStyle = "rgba(251, 191, 36, 0.03)";
    priceHelpers.ctx.beginPath();
    let started = false;
    for (let i = 0; i < limit; i++) {
      if (upperVals[i].value === null || lowerVals[i].value === null) continue;
      const x = priceHelpers.xForIdx(i);
      const y = priceHelpers.yForVal(upperVals[i].value);
      if (!started) {
        priceHelpers.ctx.moveTo(x, y);
        started = true;
      } else {
        priceHelpers.ctx.lineTo(x, y);
      }
    }
    for (let i = limit - 1; i >= 0; i--) {
      if (upperVals[i].value === null || lowerVals[i].value === null) continue;
      const x = priceHelpers.xForIdx(i);
      const y = priceHelpers.yForVal(lowerVals[i].value);
      priceHelpers.ctx.lineTo(x, y);
    }
    priceHelpers.ctx.closePath();
    priceHelpers.ctx.fill();
  }
  
  // Highlight trade explorer selection
  if (state.selectedTradeIndex !== null && state.trades[state.selectedTradeIndex]) {
    const trade = state.trades[state.selectedTradeIndex];
    const nextTrade = state.trades[state.selectedTradeIndex + 1] || null;
    
    const entryIdx = data.findIndex(d => d.date === trade.date);
    let exitIdx = nextTrade ? data.findIndex(d => d.date === nextTrade.date) : data.length - 1;
    
    if (entryIdx !== -1 && exitIdx !== -1) {
      const xStart = priceHelpers.xForIdx(entryIdx);
      const xEnd = priceHelpers.xForIdx(exitIdx);
      priceHelpers.ctx.fillStyle = "rgba(124, 58, 237, 0.07)";
      priceHelpers.ctx.fillRect(xStart, margin.top, xEnd - xStart, priceHelpers.height);
    }
  }

  // Draw Buy/Sell Dots
  state.trades.forEach((trade) => {
    const tradeIdx = data.findIndex(d => d.date === trade.date);
    if (tradeIdx === -1 || (tradeIdx / len) > progress) return;
    
    const x = priceHelpers.xForIdx(tradeIdx);
    const y = priceHelpers.yForVal(trade.price);
    const isSelected = (state.trades.indexOf(trade) === state.selectedTradeIndex);
    
    priceHelpers.ctx.beginPath();
    priceHelpers.ctx.arc(x, y, isSelected ? 7 : 5, 0, 2 * Math.PI);
    priceHelpers.ctx.fillStyle = trade.type === "buy" ? "#10b981" : "#f43f5e";
    priceHelpers.ctx.fill();
    priceHelpers.ctx.strokeStyle = "#ffffff";
    priceHelpers.ctx.lineWidth = 1.5;
    priceHelpers.ctx.stroke();
  });
  
  // Draw Vertical Hover line
  if (state.selectedPointIndex !== null) {
    const hx = priceHelpers.xForIdx(state.selectedPointIndex);
    const hy = priceHelpers.yForVal(data[state.selectedPointIndex].close);
    
    priceHelpers.ctx.strokeStyle = "rgba(0, 230, 195, 0.3)";
    priceHelpers.ctx.lineWidth = 1;
    priceHelpers.ctx.beginPath();
    priceHelpers.ctx.moveTo(hx, margin.top);
    priceHelpers.ctx.lineTo(hx, priceHelpers.rect.height - margin.bottom);
    priceHelpers.ctx.stroke();
    
    priceHelpers.ctx.beginPath();
    priceHelpers.ctx.arc(hx, hy, 5, 0, 2 * Math.PI);
    priceHelpers.ctx.fillStyle = "#00e6c3";
    priceHelpers.ctx.fill();
    priceHelpers.ctx.strokeStyle = "#ffffff";
    priceHelpers.ctx.lineWidth = 1.5;
    priceHelpers.ctx.stroke();
  }

  // --- 2. RENDER INDICATOR CHART PANEL ---
  let subMin = 0;
  let subMax = 100;
  let formatFn = (v) => v.toFixed(0);
  
  if (strategy === "rsi" || strategy === "combined") {
    subMin = 0;
    subMax = 100;
    formatFn = (v) => `${v.toFixed(0)}`;
  } else if (strategy === "macd") {
    const macdLines = [];
    data.forEach((d) => {
      if (d.macd_line !== null) macdLines.push(d.macd_line);
      if (d.signal_line !== null) macdLines.push(d.signal_line);
      if (d.macd_histogram !== null) macdLines.push(d.macd_histogram);
    });
    subMin = Math.min(...macdLines, -0.5);
    subMax = Math.max(...macdLines, 0.5);
    const pad = (subMax - subMin) * 0.05;
    subMin -= pad;
    subMax += pad;
  } else {
    // Drawdown curve for SMA / EMA / Bollinger
    let maxCap = 0;
    const dds = state.capitalHistory.map(h => {
      if (h.capital > maxCap) maxCap = h.capital;
      return maxCap === 0 ? 0 : ((h.capital - maxCap) / maxCap) * 100;
    });
    subMin = Math.min(...dds, -2);
    subMax = 0.2;
    formatFn = (v) => `${v.toFixed(1)}%`;
  }
  
  const subHelpers = getChartHelpers(el.indicatorChart, margin, len, subMin, subMax);
  state.subChartGeom = subHelpers;
  
  drawGrid(subHelpers.ctx, margin, subHelpers.width, subHelpers.height, subMin, subMax, 2, formatFn);
  
  if (strategy === "rsi" || strategy === "combined") {
    const buyThresh = strategy === "rsi"
      ? (parseInt(document.getElementById("rsi_buy").value, 10) || 30)
      : (parseInt(document.getElementById("comb_rsi_buy").value, 10) || 50);
    const sellThresh = strategy === "rsi"
      ? (parseInt(document.getElementById("rsi_sell").value, 10) || 70)
      : (parseInt(document.getElementById("comb_rsi_sell").value, 10) || 70);

    // Draw bounds dotted lines
    subHelpers.ctx.strokeStyle = "rgba(244, 63, 94, 0.25)";
    subHelpers.ctx.lineWidth = 1;
    subHelpers.ctx.setLineDash([4, 4]);
    
    subHelpers.ctx.beginPath();
    subHelpers.ctx.moveTo(margin.left, subHelpers.yForVal(sellThresh));
    subHelpers.ctx.lineTo(margin.left + subHelpers.width, subHelpers.yForVal(sellThresh));
    subHelpers.ctx.stroke();
    
    subHelpers.ctx.strokeStyle = "rgba(16, 185, 129, 0.25)";
    subHelpers.ctx.beginPath();
    subHelpers.ctx.moveTo(margin.left, subHelpers.yForVal(buyThresh));
    subHelpers.ctx.lineTo(margin.left + subHelpers.width, subHelpers.yForVal(buyThresh));
    subHelpers.ctx.stroke();
    subHelpers.ctx.setLineDash([]);
    
    const rsiVals = data.map((d, i) => ({ index: i, value: d.rsi }));
    drawLine(subHelpers.ctx, rsiVals, subHelpers.xForIdx, subHelpers.yForVal, "#9333ea", 1.6, progress);
    
  } else if (strategy === "macd") {
    const histVals = data.map((d, i) => ({ index: i, value: d.macd_histogram }));
    const limit = Math.max(1, Math.ceil(len * progress));
    const barWidth = Math.max(1, (subHelpers.width / len) * 0.7);
    const zeroY = subHelpers.yForVal(0);
    
    for (let i = 0; i < limit; i++) {
      const val = histVals[i].value;
      if (val === null || val === undefined) continue;
      const x = subHelpers.xForIdx(i) - barWidth / 2;
      const y = subHelpers.yForVal(val);
      subHelpers.ctx.fillStyle = val >= 0 ? "rgba(16, 185, 129, 0.4)" : "rgba(244, 63, 94, 0.4)";
      subHelpers.ctx.fillRect(x, zeroY, barWidth, y - zeroY);
    }
    
    const macdLineVals = data.map((d, i) => ({ index: i, value: d.macd_line }));
    const signalLineVals = data.map((d, i) => ({ index: i, value: d.signal_line }));
    drawLine(subHelpers.ctx, macdLineVals, subHelpers.xForIdx, subHelpers.yForVal, "#3b82f6", 1.3, progress);
    drawLine(subHelpers.ctx, signalLineVals, subHelpers.xForIdx, subHelpers.yForVal, "#f97316", 1.3, progress);
    
  } else {
    // Daily Drawdown curve
    let maxCap = 0;
    const ddVals = state.capitalHistory.map((h, i) => {
      if (h.capital > maxCap) maxCap = h.capital;
      return {
        index: i,
        value: maxCap === 0 ? 0 : ((h.capital - maxCap) / maxCap) * 100
      };
    });
    
    drawLine(subHelpers.ctx, ddVals, subHelpers.xForIdx, subHelpers.yForVal, "#f43f5e", 1.5, progress);
    
    const limit = Math.max(1, Math.ceil(len * progress));
    const zeroY = subHelpers.yForVal(0);
    subHelpers.ctx.fillStyle = "rgba(244, 63, 94, 0.05)";
    subHelpers.ctx.beginPath();
    subHelpers.ctx.moveTo(subHelpers.xForIdx(0), zeroY);
    for (let i = 0; i < limit; i++) {
      subHelpers.ctx.lineTo(subHelpers.xForIdx(i), subHelpers.yForVal(ddVals[i].value));
    }
    subHelpers.ctx.lineTo(subHelpers.xForIdx(limit - 1), zeroY);
    subHelpers.ctx.closePath();
    subHelpers.ctx.fill();
  }
  
  if (state.selectedPointIndex !== null) {
    const hx = subHelpers.xForIdx(state.selectedPointIndex);
    subHelpers.ctx.strokeStyle = "rgba(0, 230, 195, 0.3)";
    subHelpers.ctx.lineWidth = 1;
    subHelpers.ctx.beginPath();
    subHelpers.ctx.moveTo(hx, margin.top);
    subHelpers.ctx.lineTo(hx, subHelpers.rect.height - margin.bottom);
    subHelpers.ctx.stroke();
  }
}

function animateCharts() {
  const start = performance.now();
  const duration = 650;
  
  if (state.animationFrame) {
    cancelAnimationFrame(state.animationFrame);
  }
  
  const tick = (timestamp) => {
    const progress = Math.min(1, (timestamp - start) / duration);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    
    drawCharts(easedProgress);
    
    if (progress < 1) {
      state.animationFrame = requestAnimationFrame(tick);
    }
  };
  
  state.animationFrame = requestAnimationFrame(tick);
}

// --- INTERACTIVE EVENTS ---

function findNearestIndex(clientX, geometry) {
  if (!geometry || state.strategyData.length === 0) return null;
  
  const x = clientX - geometry.rect.left;
  const { margin, width } = geometry;
  
  if (x < margin.left || x > margin.left + width) return null;
  
  const relativeX = (x - margin.left) / width;
  return Math.max(0, Math.min(state.strategyData.length - 1, Math.round(relativeX * (state.strategyData.length - 1))));
}

function positionTooltip(idx) {
  const row = state.strategyData[idx];
  const geom = state.chartGeom;
  if (!geom || !row) {
    el.chartTooltip.hidden = true;
    return;
  }
  
  const x = geom.xForIdx(idx);
  const y = geom.yForVal(row.close);
  
  el.chartTooltip.innerHTML = `
    <strong>Date: ${row.date}</strong>
    <span>Close: ${formatCurrency(row.close)}</span>
    <span>Equity: ${formatCurrency(state.capitalHistory[idx].capital)}</span>
  `;
  el.chartTooltip.style.left = `${x}px`;
  el.chartTooltip.style.top = `${y}px`;
  el.chartTooltip.hidden = false;
}

function selectPoint(pointIdx, tradeIdx = null) {
  state.selectedPointIndex = pointIdx;
  state.selectedTradeIndex = tradeIdx;
  
  const row = state.strategyData[pointIdx] || null;
  renderSelectedPoint(row);
  updateTradeSelection();
  drawCharts(1);
  positionTooltip(pointIdx);
  
  if (tradeIdx !== null) {
    showTradeInspector(tradeIdx);
  }
}

// --- EVENT BINDINGS & STARTUP ---

function setupEventListeners() {
  // Source Selection
  el.sourceApiBtn.addEventListener("click", () => setDataSource("api"));
  el.sourceCsvBtn.addEventListener("click", () => setDataSource("csv"));
  
  // Strategy Selector
  el.strategySelect.addEventListener("change", handleStrategyChange);
  
  // Optimizer trigger
  el.optimizeBtn.addEventListener("click", runOptimization);
  el.closeOptimizeModalBtn.addEventListener("click", () => {
    el.optimizationModal.hidden = true;
  });
  
  // Trade inspector close
  el.closeInspectorBtn.addEventListener("click", () => {
    el.tradeInspectorPanel.hidden = true;
    state.selectedTradeIndex = null;
    drawCharts(1);
  });
  
  // Ticker search & quick suggestions
  el.fetchDataBtn.addEventListener("click", runBacktest);
  document.querySelectorAll(".suggestion-token").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      el.tickerInput.value = e.target.dataset.ticker;
      runBacktest();
    });
  });
  
  // Settings modification auto run triggers
  el.startingCapital.addEventListener("input", scheduleAutoRun);
  el.feeRate.addEventListener("input", scheduleAutoRun);
  el.periodSelect.addEventListener("change", scheduleAutoRun);
  el.intervalSelect.addEventListener("change", scheduleAutoRun);
  
  // Strategy Param Inputs Auto-run triggers
  document.querySelectorAll(".strategy-params-panel input").forEach((input) => {
    input.addEventListener("input", scheduleAutoRun);
  });
  
  // Local CSV inputs
  el.csvFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      el.csvText.value = reader.result;
      runBacktest();
    };
    reader.readAsText(file);
  });
  
  el.csvText.addEventListener("input", scheduleAutoRun);
  
  // Drag and drop events
  el.dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    el.dropZone.classList.add("drag-over");
  });
  el.dropZone.addEventListener("dragleave", () => {
    el.dropZone.classList.remove("drag-over");
  });
  el.dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    el.dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        el.csvText.value = reader.result;
        runBacktest();
      };
      reader.readAsText(file);
    }
  });
  
  // Standard Run & sample loaders
  el.runButton.addEventListener("click", runBacktest);
  el.loadSampleBtn.addEventListener("click", () => {
    setDataSource("csv");
    el.csvText.value = SAMPLE_CSV;
    runBacktest();
  });
  
  // Chart Hover Tracking (Main Price Chart)
  el.priceChart.addEventListener("mousemove", (e) => {
    const idx = findNearestIndex(e.clientX, state.chartGeom);
    if (idx !== null) {
      selectPoint(idx, state.selectedTradeIndex);
    }
  });
  
  el.priceChart.addEventListener("mouseleave", () => {
    el.chartTooltip.hidden = true;
  });
  
  // Chart Hover Tracking (Indicator Chart)
  el.indicatorChart.addEventListener("mousemove", (e) => {
    const idx = findNearestIndex(e.clientX, state.subChartGeom);
    if (idx !== null) {
      selectPoint(idx, state.selectedTradeIndex);
    }
  });
  
  el.indicatorChart.addEventListener("mouseleave", () => {
    el.chartTooltip.hidden = true;
  });
  
  // Click on trade log rows to select and highlight
  el.tradeTableBody.addEventListener("click", (e) => {
    const row = e.target.closest(".trade-row");
    if (!row) return;
    
    const tradeIdx = parseInt(row.dataset.tradeIndex, 10);
    const trade = state.trades[tradeIdx];
    if (trade) {
      const dataIdx = state.strategyData.findIndex(d => d.date === trade.date);
      if (dataIdx !== -1) {
        selectPoint(dataIdx, tradeIdx);
      }
    }
  });

  el.tradeTableBody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(".trade-row");
    if (!row) return;
    e.preventDefault();
    
    const tradeIdx = parseInt(row.dataset.tradeIndex, 10);
    const trade = state.trades[tradeIdx];
    if (trade) {
      const dataIdx = state.strategyData.findIndex(d => d.date === trade.date);
      if (dataIdx !== -1) {
        selectPoint(dataIdx, tradeIdx);
      }
    }
  });
  
  // Resize handler
  window.addEventListener("resize", () => {
    drawCharts(1);
    if (state.selectedPointIndex !== null) {
      positionTooltip(state.selectedPointIndex);
    }
  });
}

// Initialise Application
setupEventListeners();
el.startingCapital.value = DEFAULT_STARTING_CAPITAL.toString();
el.feeRate.value = DEFAULT_FEE_PERCENT.toString();
el.csvText.value = SAMPLE_CSV;

// Kick off first run
runBacktest();
