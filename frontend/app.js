/**
 * Dashboard controller.
 *
 * This file owns browser state, API calls, chart drawing, and event bindings.
 * Smaller modules handle CSV parsing, formatting, translations, and strategy
 * parameter mapping so this file can stay focused on user interaction.
 */

import { SAMPLE_CSV, parseCsvText } from "./csv.js";
import { formatCurrency, hasNumber, setSignedText } from "./formatters.js";
import { initI18n, t } from "./i18n.js";
import {
  applyStrategyParams,
  getStrategyParams,
  updateStrategyControls
} from "./strategy-config.js";

const DEFAULT_STARTING_CAPITAL = 10000;
const DEFAULT_FEE_PERCENT = 0.1;

// DOM references used across the dashboard
const el = {
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

  priceChart: document.getElementById("priceChart"),
  indicatorChart: document.getElementById("indicatorChart"),
  chartTooltip: document.getElementById("chartTooltip"),
  maLegend: document.getElementById("maLegend"),
  bbUpperLegend: document.getElementById("bbUpperLegend"),
  bbLowerLegend: document.getElementById("bbLowerLegend"),

  selectedDate: document.getElementById("selectedDate"),
  selectedClose: document.getElementById("selectedClose"),
  selectedAverage: document.getElementById("selectedAverage"),
  selectedSignal: document.getElementById("selectedSignal"),

  tradeTableBody: document.getElementById("tradeTableBody"),

  tradeInspectorPanel: document.getElementById("tradeInspectorPanel"),
  closeInspectorBtn: document.getElementById("closeInspectorBtn"),
  tradeHoldDays: document.getElementById("tradeHoldDays"),
  tradeNetProfit: document.getElementById("tradeNetProfit"),
  tradeRoi: document.getElementById("tradeRoi"),
  tradeFees: document.getElementById("tradeFees"),

  optimizationModal: document.getElementById("optimizationModal"),
  closeOptimizeModalBtn: document.getElementById("closeOptimizeModalBtn"),
  optimizerLoading: document.getElementById("optimizerLoading"),
  optimizerResults: document.getElementById("optimizerResults"),
  optimizeTableBody: document.getElementById("optimizeTableBody")
};

const state = {
  dataSource: "api", // "api" or "csv"
  strategyData: [],
  trades: [],
  capitalHistory: [], // daily portfolio values
  winRate: 0,
  sharpeRatio: 0,
  maxDrawdown: 0,
  buyAndHoldReturn: 0,
  optimizationRuns: [],
  lastResult: null,
  statusKey: null,
  statusType: "info",
  statusValues: {},
  activeStrategy: "sma",
  activeTicker: "BTC-USD",
  activeUsesCsv: false,
  activeFee: DEFAULT_FEE_PERCENT,

  selectedPointIndex: null,
  selectedTradeIndex: null,
  chartGeom: null,
  subChartGeom: null,
  animationFrame: null,
  pendingRunTimeout: null
};

// --- SOURCE & STRATEGY TOGGLES ---

/**
 * Switch between Yahoo Finance data and manually supplied CSV data.
 *
 * @param {"api"|"csv"} source Data source key.
 */
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
  renderStrategyControls(strategy);
  scheduleAutoRun();
}

function renderStrategyControls(strategy = el.strategySelect.value) {
  updateStrategyControls(strategy, {
    maLegend: el.maLegend,
    bbUpperLegend: el.bbUpperLegend,
    bbLowerLegend: el.bbLowerLegend
  }, t);
}

function renderActiveConfig() {
  el.activeStrategy.textContent = `${t("active.strategy")}: ${state.activeStrategy.toUpperCase()}`;
  el.activeTicker.textContent = `${t("active.ticker")}: ${state.activeUsesCsv ? t("active.customCsv") : state.activeTicker}`;
  el.activeFee.textContent = `${t("active.fee")}: ${state.activeFee}%`;
}

function refreshLanguageSensitiveUi() {
  renderStrategyControls();
  renderActiveConfig();
  if (state.statusKey) {
    setStatusKey(state.statusKey, state.statusType, state.statusValues);
  }
  if (state.lastResult) {
    renderResults(state.lastResult);
    renderTradeLog(state.trades);
    renderOptimizationTable(state.optimizationRuns);
    renderSelectedPoint(
      state.selectedPointIndex !== null ? state.strategyData[state.selectedPointIndex] : null
    );
    drawCharts(1);
  } else {
    renderSelectedPoint(null);
  }
}

/**
 * Build a backtest request from the form, call the API, and render the result.
 */
async function runBacktest() {
  setStatusKey("status.running", "info");
  
  try {
    const startingCapital = parseFloat(el.startingCapital.value);
    const feeRate = parseFloat(el.feeRate.value);
    const strategy = el.strategySelect.value;
    const strategyParams = getStrategyParams(strategy);
    
    if (isNaN(startingCapital) || startingCapital <= 0) {
      throw new Error(t("error.capital"));
    }
    if (isNaN(feeRate) || feeRate < 0) {
      throw new Error(t("error.fee"));
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
        throw new Error(t("error.ticker"));
      }
      payload.symbol = ticker;
      payload.period = el.periodSelect.value;
      payload.interval = el.intervalSelect.value;

      state.activeTicker = ticker;
      state.activeUsesCsv = false;
    } else {
      const prices = parseCsvText(el.csvText.value);
      payload.prices = prices;
      state.activeUsesCsv = true;
    }
    
    state.activeStrategy = strategy;
    state.activeFee = feeRate;
    renderActiveConfig();
    
    const response = await fetch("/api/backtest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.detail || t("error.backtest"));
    }
    
    const result = await response.json();
    
    // Keep raw API data in state so language changes and chart redraws do not
    // need another server request.
    state.strategyData = result.series_data;
    state.trades = result.trades;
    state.capitalHistory = result.capital_history;
    state.winRate = result.win_rate;
    state.sharpeRatio = result.sharpe_ratio;
    state.maxDrawdown = result.max_drawdown;
    state.buyAndHoldReturn = result.buy_and_hold_return;
    state.lastResult = result;
    
    state.selectedPointIndex = null;
    state.selectedTradeIndex = null;
    el.tradeInspectorPanel.hidden = true;
    
    renderResults(result);
    renderTradeLog(result.trades);
    renderSelectedPoint(null);
    animateCharts();
    setStatusKey("status.done", "success");
    
  } catch (error) {
    console.error(error);
    setStatusText(error.message, "error");
  }
}

// --- PARAMETER OPTIMIZATION ---

/**
 * Run the backend parameter grid search for the currently selected strategy.
 */
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
      if (!ticker) throw new Error(t("error.tickerFirst"));
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
      throw new Error(err.detail || t("error.optimize"));
    }
    
    const result = await response.json();
    state.optimizationRuns = result.runs;
    
    renderOptimizationTable(result.runs);
    el.optimizerLoading.hidden = true;
    el.optimizerResults.hidden = false;
    
  } catch (error) {
    console.error(error);
    el.optimizationModal.hidden = true;
    setStatusKey("status.optimizeFailed", "error", { message: error.message });
  }
}

/**
 * Render optimizer results and bind each "apply" button to the matching run.
 *
 * @param {Array<{params: Record<string, number>, end_capital: number, profit_loss_percent: number, sharpe_ratio: number, max_drawdown: number, total_trades: number}>} runs Optimizer output.
 */
function renderOptimizationTable(runs) {
  if (!runs || runs.length === 0) {
    el.optimizeTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-table-msg">${t("optimizer.noRuns")}</td>
      </tr>
    `;
    return;
  }
  
  el.optimizeTableBody.innerHTML = runs.map((run, idx) => {
    // Generate param badges
    const badges = Object.entries(run.params)
      .map(([key, value]) => {
        const label = t(`param.${key}`) || key;
        return `<span class="optimize-param-badge">${label}: ${value}</span>`;
      })
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
          <button class="optimize-apply-btn" data-run-index="${idx}">${t("optimizer.apply")}</button>
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

/**
 * Write optimizer parameters into the form and rerun the simulation.
 *
 * @param {Record<string, number>} params Parameter values returned by the API.
 */
function applyOptimizedParams(params) {
  const strategy = el.strategySelect.value;
  applyStrategyParams(strategy, params);
  el.optimizationModal.hidden = true;
  runBacktest();
}

function applyStatusMessage(msg, type = "info") {
  el.statusMessage.textContent = msg;
  el.statusMessage.className = "status-msg";
  if (type === "error") {
    el.statusMessage.classList.add("error");
  } else if (type === "success") {
    el.statusMessage.classList.add("success");
  }
}

function setStatusText(msg, type = "info") {
  state.statusKey = null;
  state.statusType = type;
  state.statusValues = {};
  applyStatusMessage(msg, type);
}

function setStatusKey(key, type = "info", values = {}) {
  state.statusKey = key;
  state.statusType = type;
  state.statusValues = values;
  applyStatusMessage(t(key, values), type);
}

function scheduleAutoRun() {
  if (!el.autoRun.checked) return;
  if (state.pendingRunTimeout) clearTimeout(state.pendingRunTimeout);
  state.pendingRunTimeout = setTimeout(() => {
    runBacktest();
  }, 350);
}

// --- RENDER METRICS & TRADE LOG ---

/**
 * Render the scalar performance metrics from a backtest response.
 *
 * @param {object} res Backtest result returned by `/api/backtest`.
 */
function renderResults(res) {
  el.startCapital.textContent = formatCurrency(res.start_capital);
  el.endCapital.textContent = formatCurrency(res.end_capital);
  
  setSignedText(el.profitLoss, res.profit_loss, formatCurrency);
  setSignedText(el.profitLossPercent, res.profit_loss_percent, (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);
  
  el.sharpeRatio.textContent = res.sharpe_ratio.toFixed(2);
  el.maxDrawdown.textContent = `${res.max_drawdown.toFixed(2)}%`;
  el.winRate.textContent = `${res.win_rate.toFixed(1)}%`;
  
  setSignedText(el.buyAndHoldReturn, res.buy_and_hold_return, (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);
  
  el.tradeCount.textContent = t("trade.count", {
    total: res.buy_trades + res.sell_trades,
    buy: res.buy_trades,
    sell: res.sell_trades
  });
  el.finalStatus.textContent = res.final_status.includes("asset")
    ? t("position.asset")
    : t("position.cash");
  
  el.finalStatus.className = "status-value";
  if (res.final_status.includes("asset")) {
    el.finalStatus.style.color = "var(--color-profit)";
  } else {
    el.finalStatus.style.color = "var(--accent)";
  }
  
  el.dataSummary.textContent = t("summary.loaded", { count: res.series_data.length });
}

/**
 * Render simulated buy and sell actions in the trade table.
 *
 * @param {Array<object>} trades Trade records returned by the API.
 */
function renderTradeLog(trades) {
  if (trades.length === 0) {
    el.tradeTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-table-msg">${t("trade.none")}</td>
      </tr>
    `;
    return;
  }
  
  el.tradeTableBody.innerHTML = trades.map((trade, idx) => {
    const typeLabel = trade.type === "buy" ? t("trade.buy") : t("trade.sell");
    const typeClass = trade.type === "buy" ? "trade-buy" : "trade-sell";
    return `
      <tr class="trade-row" tabindex="0" data-trade-index="${idx}">
        <td class="font-mono">${trade.date}</td>
        <td class="${typeClass}">${typeLabel}</td>
        <td class="font-mono">${formatCurrency(trade.price)}</td>
        <td class="font-mono">${trade.units.toFixed(6)}</td>
        <td class="font-mono">${formatCurrency(trade.fee)}</td>
        <td class="font-mono">${formatCurrency(trade.cashBalance)}</td>
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

/**
 * Show derived details for one selected trade.
 *
 * @param {number} tradeIdx Index in `state.trades`.
 */
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
  el.tradeHoldDays.textContent = t("trade.days", { count: diffDays });
  
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

/**
 * Render the chart point inspector for the hovered or selected price row.
 *
 * @param {object|null} row Price row from `state.strategyData`.
 */
function renderSelectedPoint(row) {
  if (!row) {
    el.selectedDate.textContent = t("inspect.defaultDate");
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
    valStr = hasNumber(row.moving_average) ? formatCurrency(row.moving_average) : "-";
  } else if (strategy === "rsi") {
    valStr = hasNumber(row.rsi) ? `${row.rsi.toFixed(2)}` : "-";
  } else if (strategy === "macd") {
    valStr = hasNumber(row.macd_line)
      ? `MACD: ${row.macd_line.toFixed(2)} / Sig: ${row.signal_line.toFixed(2)}`
      : "-";
  } else if (strategy === "bollinger") {
    valStr = hasNumber(row.bb_middle) ? `${formatCurrency(row.bb_middle)}` : "-";
  }
  
  el.selectedAverage.textContent = valStr;
  const signalLabels = {
    buy: t("signal.buy"),
    sell: t("signal.sell"),
    hold: t("signal.hold")
  };
  el.selectedSignal.textContent = signalLabels[row.signal] || t("signal.hold");
  
  el.selectedSignal.className = "";
  if (row.signal === "buy") {
    el.selectedSignal.style.color = "var(--color-profit)";
  } else if (row.signal === "sell") {
    el.selectedSignal.style.color = "var(--color-loss)";
  } else {
    el.selectedSignal.style.color = "var(--text-main)";
  }
}

// --- CHART DRAWING ---

/**
 * Prepare a canvas for the current device pixel ratio and return scale helpers.
 */
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
  
  const maxIndex = Math.max(1, dataSize - 1);
  const xForIdx = (idx) => margin.left + (idx / maxIndex) * width;
  const yForVal = (val) => margin.top + ((maxVal - val) / valRange) * height;

  return { ctx, xForIdx, yForVal, margin, width, height, rect };
}

/**
 * Draw horizontal chart grid lines and their value labels.
 */
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

/**
 * Draw one line series while skipping missing indicator values.
 */
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

/**
 * Redraw the price chart and secondary indicator chart.
 *
 * @param {number} progress Animation progress between 0 and 1.
 */
function drawCharts(progress = 1) {
  const data = state.strategyData;
  if (!data || data.length === 0) return;
  
  const strategy = el.strategySelect.value;
  const len = data.length;
  const margin = { top: 12, right: 16, bottom: 12, left: 54 };
  
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
  
  drawGrid(priceHelpers.ctx, margin, priceHelpers.width, priceHelpers.height, minPrice - pricePad, maxPrice + pricePad, 4, formatCurrency);
  drawLine(priceHelpers.ctx, closeVals, priceHelpers.xForIdx, priceHelpers.yForVal, "#f3f4f6", 2.2, progress);

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

/**
 * Find the nearest strategy-data row for a mouse x-coordinate.
 */
function findNearestIndex(clientX, geometry) {
  if (!geometry || state.strategyData.length === 0) return null;
  
  const x = clientX - geometry.rect.left;
  const { margin, width } = geometry;
  if (!margin || width <= 0) return null;
  
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
    <strong>${t("tooltip.date")}: ${row.date}</strong>
    <span>${t("tooltip.close")}: ${formatCurrency(row.close)}</span>
    <span>${t("tooltip.capital")}: ${formatCurrency(state.capitalHistory[idx]?.capital || 0)}</span>
  `;
  el.chartTooltip.style.left = `${x}px`;
  el.chartTooltip.style.top = `${y}px`;
  el.chartTooltip.hidden = false;
}

/**
 * Select a chart point and optionally link it to a trade row.
 */
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

/**
 * Bind all user interactions once the DOM references are available.
 */
function setupEventListeners() {
  el.sourceApiBtn.addEventListener("click", () => setDataSource("api"));
  el.sourceCsvBtn.addEventListener("click", () => setDataSource("csv"));

  el.strategySelect.addEventListener("change", handleStrategyChange);

  el.optimizeBtn.addEventListener("click", runOptimization);
  el.closeOptimizeModalBtn.addEventListener("click", () => {
    el.optimizationModal.hidden = true;
  });
  
  el.closeInspectorBtn.addEventListener("click", () => {
    el.tradeInspectorPanel.hidden = true;
    state.selectedTradeIndex = null;
    drawCharts(1);
  });
  
  el.fetchDataBtn.addEventListener("click", runBacktest);
  document.querySelectorAll(".suggestion-token").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      el.tickerInput.value = e.target.dataset.ticker;
      runBacktest();
    });
  });
  
  el.startingCapital.addEventListener("input", scheduleAutoRun);
  el.feeRate.addEventListener("input", scheduleAutoRun);
  el.periodSelect.addEventListener("change", scheduleAutoRun);
  el.intervalSelect.addEventListener("change", scheduleAutoRun);
  
  document.querySelectorAll(".strategy-params-panel input").forEach((input) => {
    input.addEventListener("input", scheduleAutoRun);
  });
  
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
  
  el.runButton.addEventListener("click", runBacktest);
  el.loadSampleBtn.addEventListener("click", () => {
    setDataSource("csv");
    el.csvText.value = SAMPLE_CSV;
    runBacktest();
  });
  
  el.priceChart.addEventListener("mousemove", (e) => {
    const idx = findNearestIndex(e.clientX, state.chartGeom);
    if (idx !== null) {
      selectPoint(idx, state.selectedTradeIndex);
    }
  });
  
  el.priceChart.addEventListener("mouseleave", () => {
    el.chartTooltip.hidden = true;
  });
  
  el.indicatorChart.addEventListener("mousemove", (e) => {
    const idx = findNearestIndex(e.clientX, state.subChartGeom);
    if (idx !== null) {
      selectPoint(idx, state.selectedTradeIndex);
    }
  });
  
  el.indicatorChart.addEventListener("mouseleave", () => {
    el.chartTooltip.hidden = true;
  });
  
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
  
  window.addEventListener("resize", () => {
    drawCharts(1);
    if (state.selectedPointIndex !== null) {
      positionTooltip(state.selectedPointIndex);
    }
  });
}

setupEventListeners();
initI18n(refreshLanguageSensitiveUi);
el.startingCapital.value = DEFAULT_STARTING_CAPITAL.toString();
el.feeRate.value = DEFAULT_FEE_PERCENT.toString();
el.csvText.value = SAMPLE_CSV;
renderActiveConfig();

runBacktest();
