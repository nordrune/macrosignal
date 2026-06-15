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
  statusMessage: document.getElementById("statusMessage"),
  activeStrategy: document.getElementById("activeStrategy"),
  activeTicker: document.getElementById("activeTicker"),
  activeFee: document.getElementById("activeFee"),
  exportMenuBtn: document.getElementById("exportMenuBtn"),
  exportMenu: document.getElementById("exportMenu"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  exportExcelBtn: document.getElementById("exportExcelBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),

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

  analysisSummary: document.getElementById("analysisSummary"),
  tradeAnalysisGrid: document.getElementById("tradeAnalysisGrid"),
  feeAnalysisGrid: document.getElementById("feeAnalysisGrid"),
  drawdownAnalysisGrid: document.getElementById("drawdownAnalysisGrid"),
  activityAnalysisGrid: document.getElementById("activityAnalysisGrid"),

  tradeTableBody: document.getElementById("tradeTableBody"),

  tradeInspectorPanel: document.getElementById("tradeInspectorPanel"),
  closeInspectorBtn: document.getElementById("closeInspectorBtn"),
  tradeHoldDays: document.getElementById("tradeHoldDays"),
  tradeNetProfit: document.getElementById("tradeNetProfit"),
  tradeRoi: document.getElementById("tradeRoi"),
  tradeFees: document.getElementById("tradeFees")
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
  lastResult: null,
  statusKey: null,
  statusType: "info",
  statusValues: {},
  activeStrategy: "sma",
  activeTicker: "BTC-USD",
  activeUsesCsv: false,
  activeFee: DEFAULT_FEE_PERCENT,
  lastRunSnapshot: null,
  lastAnalytics: null,

  selectedPointIndex: null,
  selectedTradeIndex: null,
  chartGeom: null,
  subChartGeom: null,
  animationFrame: null,
  pendingRunTimeout: null,
  activeRequestId: 0,
  isRunning: false
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
    el.sourceApiBtn.setAttribute("aria-pressed", "true");
    el.sourceCsvBtn.setAttribute("aria-pressed", "false");
    el.apiSettings.classList.add("active");
    el.csvSettings.classList.remove("active");
  } else {
    el.sourceApiBtn.classList.remove("active");
    el.sourceCsvBtn.classList.add("active");
    el.sourceApiBtn.setAttribute("aria-pressed", "false");
    el.sourceCsvBtn.setAttribute("aria-pressed", "true");
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
    renderAnalysisPanel(state.lastAnalytics);
    renderSelectedPoint(
      state.selectedPointIndex !== null ? state.strategyData[state.selectedPointIndex] : null
    );
    drawCharts(1);
  } else {
    resetAnalysisPanel();
    renderSelectedPoint(null);
  }
  updateExportState();
}

/**
 * Build a backtest request from the form, call the API, and render the result.
 */
async function runBacktest() {
  const requestId = state.activeRequestId + 1;
  state.activeRequestId = requestId;
  setBusyState(true);
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
    const runSnapshot = buildRunSnapshot(payload, strategyParams);
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

    if (requestId !== state.activeRequestId) {
      return;
    }
    
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
    state.lastRunSnapshot = {
      ...runSnapshot,
      dateStart: result.series_data[0]?.date || "-",
      dateEnd: result.series_data[result.series_data.length - 1]?.date || "-",
      dataPoints: result.series_data.length
    };
    state.lastAnalytics = calculateSimulationAnalytics(result);
    
    state.selectedPointIndex = null;
    state.selectedTradeIndex = null;
    el.tradeInspectorPanel.hidden = true;
    
    renderResults(result);
    renderTradeLog(result.trades);
    renderAnalysisPanel(state.lastAnalytics);
    renderSelectedPoint(null);
    animateCharts();
    updateExportState();
    setStatusKey("status.done", "success");
    
  } catch (error) {
    if (requestId !== state.activeRequestId) {
      return;
    }
    console.error(error);
    setStatusText(error.message, "error");
  } finally {
    if (requestId === state.activeRequestId) {
      setBusyState(false);
    }
  }
}

function setBusyState(isRunning) {
  state.isRunning = isRunning;
  [el.fetchDataBtn, el.runButton].forEach((button) => {
    button.disabled = isRunning;
    button.setAttribute("aria-busy", String(isRunning));
  });
}

function buildRunSnapshot(payload, strategyParams) {
  return {
    dataSource: state.dataSource === "api" ? t("source.yahoo") : t("source.csv"),
    asset: state.dataSource === "api" ? payload.symbol : t("active.customCsv"),
    period: state.dataSource === "api" ? selectedOptionText(el.periodSelect) : "-",
    interval: state.dataSource === "api" ? selectedOptionText(el.intervalSelect) : "-",
    strategy: selectedOptionText(el.strategySelect),
    strategyType: payload.strategy_type,
    strategyParams,
    startingCapital: payload.starting_capital,
    feePercent: payload.transaction_fee_percent
  };
}

function selectedOptionText(select) {
  return select.selectedOptions[0]?.textContent.trim() || select.value;
}

function updateExportState() {
  const hasExportData = Boolean(state.lastResult && state.lastRunSnapshot);
  [el.exportMenuBtn, el.exportCsvBtn, el.exportExcelBtn, el.exportPdfBtn].forEach((button) => {
    button.disabled = !hasExportData;
  });
}

function getExportRows() {
  if (!state.lastResult || !state.lastRunSnapshot) {
    throw new Error(t("export.empty"));
  }

  const snapshot = state.lastRunSnapshot;
  const result = state.lastResult;
  const params = Object.entries(snapshot.strategyParams)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ") || "-";

  const parameterRows = [
    [t("export.generatedAt"), new Date().toLocaleString()],
    [t("export.asset"), snapshot.asset],
    [t("export.dataSource"), snapshot.dataSource],
    [t("export.timeRange"), snapshot.period],
    [t("export.interval"), snapshot.interval],
    [t("export.dateRange"), `${snapshot.dateStart} - ${snapshot.dateEnd}`],
    [t("export.strategy"), snapshot.strategy],
    [t("export.strategyParams"), params],
    [t("export.startingCapital"), formatCurrency(snapshot.startingCapital)],
    [t("export.fee"), `${snapshot.feePercent}%`],
    [t("export.dataPoints"), snapshot.dataPoints],
    [t("export.finalCapital"), formatCurrency(result.end_capital)],
    [t("export.profitLoss"), formatCurrency(result.profit_loss)],
    [t("export.strategyReturn"), `${result.profit_loss_percent.toFixed(2)}%`]
  ];

  const tradeRows = state.trades.map((trade) => [
    trade.date,
    trade.type === "buy" ? t("trade.buy") : t("trade.sell"),
    trade.price,
    trade.units,
    trade.fee,
    trade.cashBalance
  ]);

  return { parameterRows, tradeRows };
}

function exportCurrentRun(format) {
  try {
    if (format === "csv") {
      exportCsv();
    } else if (format === "excel") {
      exportExcel();
    } else if (format === "pdf") {
      exportPdf();
    }
    closeExportMenu();
  } catch (error) {
    setStatusText(error.message, "error");
  }
}

function exportCsv() {
  const { parameterRows, tradeRows } = getExportRows();
  const rows = [
    [t("export.parametersTitle")],
    ...parameterRows,
    [],
    [t("export.tradesTitle")],
    getTradeHeaderRow(),
    ...tradeRows
  ];
  downloadBlob(toCsv(rows), "macrosignal-export.csv", "text/csv;charset=utf-8");
}

function exportExcel() {
  const { parameterRows, tradeRows } = getExportRows();
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${excelWorksheet(t("export.parametersTitle"), parameterRows)}
  ${excelWorksheet(t("export.tradesTitle"), [getTradeHeaderRow(), ...tradeRows])}
</Workbook>`;
  downloadBlob(workbook, "macrosignal-export.xls", "application/vnd.ms-excel;charset=utf-8");
}

function exportPdf() {
  const { parameterRows, tradeRows } = getExportRows();
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    throw new Error(t("error.backtest"));
  }

  reportWindow.document.write(buildPrintReport(parameterRows, tradeRows));
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

function getTradeHeaderRow() {
  return [
    t("table.date"),
    t("table.action"),
    t("table.price"),
    t("table.units"),
    t("table.fee"),
    t("table.cash")
  ];
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function excelWorksheet(name, rows) {
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${rows.map(excelRow).join("")}</Table></Worksheet>`;
}

function excelRow(row) {
  return `<Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === "number" ? "Number" : "String"}">${escapeXml(cell)}</Data></Cell>`).join("")}</Row>`;
}

function buildPrintReport(parameterRows, tradeRows) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(t("export.reportTitle"))}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 28px; }
    h1 { margin: 0 0 20px; }
    h2 { margin: 0 0 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    th { background: #f3f4f6; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  </style>
</head>
<body>
  <section class="page">
    <h1>${escapeHtml(t("export.reportTitle"))}</h1>
    <h2>${escapeHtml(t("export.parametersTitle"))}</h2>
    ${htmlTable(parameterRows)}
  </section>
  <section class="page">
    <h2>${escapeHtml(t("export.tradesTitle"))}</h2>
    ${htmlTable([getTradeHeaderRow(), ...tradeRows], true)}
  </section>
</body>
</html>`;
}

function htmlTable(rows, hasHeader = false) {
  return `<table>${rows.map((row, index) => {
    const tag = hasHeader && index === 0 ? "th" : "td";
    return `<tr>${row.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join("")}</tr>`;
  }).join("")}</table>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toggleExportMenu() {
  if (el.exportMenuBtn.disabled) {
    setStatusKey("export.empty", "error");
    return;
  }
  const nextHidden = !el.exportMenu.hidden;
  el.exportMenu.hidden = nextHidden;
  el.exportMenuBtn.setAttribute("aria-expanded", String(!nextHidden));
}

function closeExportMenu() {
  el.exportMenu.hidden = true;
  el.exportMenuBtn.setAttribute("aria-expanded", "false");
}

function calculateSimulationAnalytics(result) {
  const tradeAnalytics = calculateTradeAnalytics(result.trades, result.series_data);
  const feeAnalytics = calculateFeeAnalytics(result.trades, result);
  const drawdownAnalytics = calculateDrawdownAnalytics(result.capital_history);
  const activityAnalytics = calculateActivityAnalytics(result.trades, result.series_data);

  return {
    trade: tradeAnalytics,
    fees: feeAnalytics,
    drawdown: drawdownAnalytics,
    activity: activityAnalytics,
    summary: {
      positions: tradeAnalytics.completedPositions.length,
      trades: result.trades.length,
      days: result.series_data.length
    }
  };
}

function calculateTradeAnalytics(trades, seriesData) {
  const completedPositions = [];
  const openBuys = [];
  const finalPoint = seriesData[seriesData.length - 1] || null;

  trades.forEach((trade) => {
    if (trade.type === "buy") {
      openBuys.push(trade);
      return;
    }

    if (trade.type !== "sell" || openBuys.length === 0) {
      return;
    }

    const entry = openBuys.shift();
    completedPositions.push(buildPositionAnalytics(entry, trade, false));
  });

  const openPositions = openBuys.map((entry) => {
    if (!finalPoint) return null;
    const syntheticExit = {
      date: finalPoint.date,
      price: finalPoint.close,
      fee: 0
    };
    return buildPositionAnalytics(entry, syntheticExit, true);
  }).filter(Boolean);

  const winningPositions = completedPositions.filter((position) => position.profit > 0);
  const losingPositions = completedPositions.filter((position) => position.profit < 0);
  const bestPosition = maxBy(completedPositions, (position) => position.profit);
  const worstPosition = minBy(completedPositions, (position) => position.profit);

  return {
    completedPositions,
    openPositions,
    bestPosition,
    worstPosition,
    winningPositions: winningPositions.length,
    losingPositions: losingPositions.length,
    averageProfit: average(completedPositions.map((position) => position.profit)),
    averageRoi: average(completedPositions.map((position) => position.roi)),
    averageHoldDays: average(completedPositions.map((position) => position.holdDays)),
    longestWinStreak: longestStreak(completedPositions, (position) => position.profit > 0),
    longestLossStreak: longestStreak(completedPositions, (position) => position.profit < 0)
  };
}

function buildPositionAnalytics(entry, exit, isOpen) {
  const units = entry.units || 0;
  const totalFees = (entry.fee || 0) + (exit.fee || 0);
  const profit = (exit.price - entry.price) * units - totalFees;
  const cost = entry.price * units;
  return {
    entryDate: entry.date,
    exitDate: exit.date,
    entryPrice: entry.price,
    exitPrice: exit.price,
    units,
    profit,
    roi: cost > 0 ? (profit / cost) * 100 : 0,
    holdDays: daysBetween(entry.date, exit.date),
    fees: totalFees,
    isOpen
  };
}

function calculateFeeAnalytics(trades, result) {
  const totalFees = trades.reduce((sum, trade) => sum + (Number(trade.fee) || 0), 0);
  const averageFee = trades.length > 0 ? totalFees / trades.length : 0;
  const startCapital = result.start_capital || 0;
  const endCapital = result.end_capital || 0;

  return {
    totalFees,
    averageFee,
    feesStartShare: startCapital > 0 ? (totalFees / startCapital) * 100 : 0,
    feesEndShare: endCapital > 0 ? (totalFees / endCapital) * 100 : 0
  };
}

function calculateDrawdownAnalytics(capitalHistory) {
  let peakCapital = 0;
  let peakDate = "-";
  let deepestDrawdown = 0;
  let deepestDate = "-";
  let peakBeforeDeepest = 0;
  let longestDrawdownDays = 0;
  let currentDrawdownStart = null;
  let recovered = true;

  capitalHistory.forEach((point) => {
    const capital = Number(point.capital) || 0;

    if (capital >= peakCapital) {
      if (currentDrawdownStart) {
        longestDrawdownDays = Math.max(longestDrawdownDays, daysBetween(currentDrawdownStart, point.date));
      }
      peakCapital = capital;
      peakDate = point.date;
      currentDrawdownStart = null;
      recovered = true;
    } else if (peakCapital > 0) {
      if (!currentDrawdownStart) {
        currentDrawdownStart = peakDate;
      }
      const drawdown = ((capital - peakCapital) / peakCapital) * 100;
      if (drawdown < deepestDrawdown) {
        deepestDrawdown = drawdown;
        deepestDate = point.date;
        peakBeforeDeepest = peakCapital;
      }
      recovered = false;
    }
  });

  if (currentDrawdownStart && capitalHistory.length > 0) {
    const lastDate = capitalHistory[capitalHistory.length - 1].date;
    longestDrawdownDays = Math.max(longestDrawdownDays, daysBetween(currentDrawdownStart, lastDate));
  }

  return {
    deepestDrawdown,
    deepestDate,
    longestDrawdownDays,
    recovered,
    peakBeforeDeepest
  };
}

function calculateActivityAnalytics(trades, seriesData) {
  const firstTrade = trades[0] || null;
  const lastTrade = trades[trades.length - 1] || null;
  const gaps = [];
  const monthCounts = new Map();

  for (let idx = 1; idx < trades.length; idx += 1) {
    gaps.push(daysBetween(trades[idx - 1].date, trades[idx].date));
  }

  trades.forEach((trade) => {
    const month = String(trade.date).slice(0, 7);
    monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
  });

  let activeMonth = null;
  monthCounts.forEach((count, month) => {
    if (!activeMonth || count > activeMonth.count) {
      activeMonth = { month, count };
    }
  });

  return {
    firstTrade,
    lastTrade,
    averageTradeGap: average(gaps),
    activeMonth,
    testedDays: seriesData.length
  };
}

function renderAnalysisPanel(analytics) {
  if (!analytics) {
    resetAnalysisPanel();
    return;
  }

  el.analysisSummary.textContent = t("analysis.summary", analytics.summary);
  renderAnalysisCards(el.tradeAnalysisGrid, buildTradeAnalysisCards(analytics.trade));
  renderAnalysisCards(el.feeAnalysisGrid, buildFeeAnalysisCards(analytics.fees));
  renderAnalysisCards(el.drawdownAnalysisGrid, buildDrawdownAnalysisCards(analytics.drawdown));
  renderAnalysisCards(el.activityAnalysisGrid, buildActivityAnalysisCards(analytics.activity));
}

function resetAnalysisPanel() {
  el.analysisSummary.textContent = t("analysis.empty");
  [el.tradeAnalysisGrid, el.feeAnalysisGrid, el.drawdownAnalysisGrid, el.activityAnalysisGrid].forEach((container) => {
    container.innerHTML = "";
  });
}

function buildTradeAnalysisCards(analytics) {
  return [
    analysisCard(t("analysis.bestTrade"), formatPositionProfit(analytics.bestPosition), formatPositionRange(analytics.bestPosition), "positive"),
    analysisCard(t("analysis.worstTrade"), formatPositionProfit(analytics.worstPosition), formatPositionRange(analytics.worstPosition), "negative"),
    analysisCard(t("analysis.winningTrades"), analytics.winningPositions.toString(), t("analysis.positionUnit"), "positive"),
    analysisCard(t("analysis.losingTrades"), analytics.losingPositions.toString(), t("analysis.positionUnit"), analytics.losingPositions > 0 ? "negative" : ""),
    analysisCard(t("analysis.avgProfit"), formatCurrency(analytics.averageProfit), "", valueTone(analytics.averageProfit)),
    analysisCard(t("analysis.avgRoi"), formatPercent(analytics.averageRoi), "", valueTone(analytics.averageRoi)),
    analysisCard(t("analysis.avgHold"), formatDays(analytics.averageHoldDays), "", ""),
    analysisCard(t("analysis.longestWinStreak"), analytics.longestWinStreak.toString(), t("analysis.positionUnit"), "positive"),
    analysisCard(t("analysis.longestLossStreak"), analytics.longestLossStreak.toString(), t("analysis.positionUnit"), analytics.longestLossStreak > 0 ? "negative" : "")
  ];
}

function buildFeeAnalysisCards(analytics) {
  return [
    analysisCard(t("analysis.totalFees"), formatCurrency(analytics.totalFees), "", analytics.totalFees > 0 ? "warning" : ""),
    analysisCard(t("analysis.avgFee"), formatCurrency(analytics.averageFee), "", ""),
    analysisCard(t("analysis.feesStartShare"), formatPercent(analytics.feesStartShare), "", analytics.feesStartShare > 1 ? "warning" : ""),
    analysisCard(t("analysis.feesEndShare"), formatPercent(analytics.feesEndShare), "", analytics.feesEndShare > 1 ? "warning" : "")
  ];
}

function buildDrawdownAnalysisCards(analytics) {
  return [
    analysisCard(t("analysis.deepestDrawdown"), formatPercent(analytics.deepestDrawdown), "", analytics.deepestDrawdown < 0 ? "negative" : ""),
    analysisCard(t("analysis.drawdownDate"), analytics.deepestDate || "-", "", ""),
    analysisCard(t("analysis.longestDrawdown"), formatDays(analytics.longestDrawdownDays), "", analytics.longestDrawdownDays > 0 ? "warning" : ""),
    analysisCard(t("analysis.recoveryStatus"), analytics.recovered ? t("analysis.recovered") : t("analysis.notRecovered"), "", analytics.recovered ? "positive" : "warning"),
    analysisCard(t("analysis.peakBeforeDrawdown"), analytics.peakBeforeDeepest > 0 ? formatCurrency(analytics.peakBeforeDeepest) : "-", "", "")
  ];
}

function buildActivityAnalysisCards(analytics) {
  const activeMonthValue = analytics.activeMonth
    ? `${analytics.activeMonth.month} (${analytics.activeMonth.count})`
    : "-";
  return [
    analysisCard(t("analysis.firstTrade"), formatTradeAction(analytics.firstTrade), analytics.firstTrade?.date || "", ""),
    analysisCard(t("analysis.lastTrade"), formatTradeAction(analytics.lastTrade), analytics.lastTrade?.date || "", ""),
    analysisCard(t("analysis.avgTradeGap"), formatDays(analytics.averageTradeGap), "", ""),
    analysisCard(t("analysis.activeMonth"), activeMonthValue, t("analysis.tradeUnit"), "")
  ];
}

function analysisCard(label, value, detail = "", tone = "") {
  return { label, value, detail, tone };
}

function renderAnalysisCards(container, cards) {
  container.innerHTML = cards.map((card) => `
    <article class="analysis-card ${card.tone ? `analysis-card-${card.tone}` : ""}">
      <span class="analysis-label">${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <small>${escapeHtml(card.detail)}</small>
    </article>
  `).join("");
}

function formatPositionProfit(position) {
  if (!position) return t("analysis.noCompletedTrades");
  return formatCurrency(position.profit);
}

function formatPositionRange(position) {
  if (!position) return "";
  return `${position.entryDate} → ${position.exitDate}`;
}

function formatTradeAction(trade) {
  if (!trade) return t("analysis.noTrades");
  return trade.type === "buy" ? t("trade.buy") : t("trade.sell");
}

function formatPercent(value) {
  const number = Number(value) || 0;
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${number.toFixed(2)}%`;
}

function formatDays(value) {
  const number = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${number.toFixed(number % 1 === 0 ? 0 : 1)} ${t("analysis.dayShort")}`;
}

function valueTone(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "";
}

function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

function average(values) {
  const validValues = values.filter((value) => Number.isFinite(Number(value)));
  if (validValues.length === 0) return 0;
  return validValues.reduce((sum, value) => sum + Number(value), 0) / validValues.length;
}

function maxBy(items, selector) {
  if (items.length === 0) return null;
  return items.reduce((best, item) => selector(item) > selector(best) ? item : best, items[0]);
}

function minBy(items, selector) {
  if (items.length === 0) return null;
  return items.reduce((worst, item) => selector(item) < selector(worst) ? item : worst, items[0]);
}

function longestStreak(items, predicate) {
  let current = 0;
  let best = 0;
  items.forEach((item) => {
    if (predicate(item)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });
  return best;
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
  if (strategy === "sma" || strategy === "ema") {
    valStr = hasNumber(row.moving_average) ? formatCurrency(row.moving_average) : "-";
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
  
  if (strategy === "sma" || strategy === "ema") {
    data.forEach((d) => { if (d.moving_average !== null) mainVals.push(d.moving_average); });
  }
  
  const minPrice = Math.min(...mainVals);
  const maxPrice = Math.max(...mainVals);
  const pricePad = (maxPrice - minPrice) * 0.05 || 1;
  
  const priceHelpers = getChartHelpers(el.priceChart, margin, len, minPrice - pricePad, maxPrice + pricePad);
  state.chartGeom = priceHelpers;
  
  drawGrid(priceHelpers.ctx, margin, priceHelpers.width, priceHelpers.height, minPrice - pricePad, maxPrice + pricePad, 4, formatCurrency);
  drawLine(priceHelpers.ctx, closeVals, priceHelpers.xForIdx, priceHelpers.yForVal, "#f3f4f6", 2.2, progress);

  if (strategy === "sma" || strategy === "ema") {
    const maVals = data.map((d, i) => ({ index: i, value: d.moving_average }));
    drawLine(priceHelpers.ctx, maVals, priceHelpers.xForIdx, priceHelpers.yForVal, "#00e6c3", 1.8, progress);
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

  let maxCap = 0;
  const dds = state.capitalHistory.map(h => {
    if (h.capital > maxCap) maxCap = h.capital;
    return maxCap === 0 ? 0 : ((h.capital - maxCap) / maxCap) * 100;
  });
  const subMin = Math.min(...dds, -2);
  const subMax = 0.2;
  const formatFn = (v) => `${v.toFixed(1)}%`;
  
  const subHelpers = getChartHelpers(el.indicatorChart, margin, len, subMin, subMax);
  state.subChartGeom = subHelpers;
  
  drawGrid(subHelpers.ctx, margin, subHelpers.width, subHelpers.height, subMin, subMax, 2, formatFn);
  
  maxCap = 0;
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
  el.exportMenuBtn.addEventListener("click", toggleExportMenu);
  el.exportCsvBtn.addEventListener("click", () => exportCurrentRun("csv"));
  el.exportExcelBtn.addEventListener("click", () => exportCurrentRun("excel"));
  el.exportPdfBtn.addEventListener("click", () => exportCurrentRun("pdf"));

  document.querySelectorAll("[data-source-option]").forEach((button) => {
    button.addEventListener("click", () => setDataSource(button.dataset.sourceOption));
  });

  el.strategySelect.addEventListener("change", handleStrategyChange);

  el.closeInspectorBtn.addEventListener("click", () => {
    el.tradeInspectorPanel.hidden = true;
    state.selectedTradeIndex = null;
    drawCharts(1);
  });
  
  el.fetchDataBtn.addEventListener("click", runBacktest);
  document.querySelectorAll(".suggestion-token").forEach((btn) => {
    btn.addEventListener("click", () => {
      el.tickerInput.value = btn.dataset.ticker;
      runBacktest();
    });
  });
  
  el.startingCapital.addEventListener("input", scheduleAutoRun);
  el.feeRate.addEventListener("input", scheduleAutoRun);
  el.periodSelect.addEventListener("change", scheduleAutoRun);
  el.intervalSelect.addEventListener("change", scheduleAutoRun);
  el.autoRun.addEventListener("change", () => {
    if (el.autoRun.checked) scheduleAutoRun();
  });
  
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

  el.dropZone.addEventListener("click", () => {
    el.csvFile.click();
  });
  
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

  document.addEventListener("click", (event) => {
    if (event.target.closest(".export-controls")) return;
    closeExportMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeExportMenu();
  });
}

setupEventListeners();
initI18n(refreshLanguageSensitiveUi);
el.startingCapital.value = DEFAULT_STARTING_CAPITAL.toString();
el.feeRate.value = DEFAULT_FEE_PERCENT.toString();
el.csvText.value = SAMPLE_CSV;
renderActiveConfig();

runBacktest();
