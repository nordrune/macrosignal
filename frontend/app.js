"use strict";

const DEFAULT_STARTING_CAPITAL = 10000;
const DEFAULT_TRANSACTION_FEE_PERCENT = 0.1;
const DEFAULT_MOVING_AVERAGE_WINDOW = 20;

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

const elements = {
  csvFile: document.querySelector("#csvFile"),
  csvText: document.querySelector("#csvText"),
  startingCapital: document.querySelector("#startingCapital"),
  movingAverageWindow: document.querySelector("#movingAverageWindow"),
  feeRate: document.querySelector("#feeRate"),
  autoRun: document.querySelector("#autoRun"),
  dropZone: document.querySelector("#dropZone"),
  runButton: document.querySelector("#runButton"),
  sampleButton: document.querySelector("#sampleButton"),
  statusMessage: document.querySelector("#statusMessage"),
  ruleCapital: document.querySelector("#ruleCapital"),
  ruleWindow: document.querySelector("#ruleWindow"),
  ruleFee: document.querySelector("#ruleFee"),
  dataSummary: document.querySelector("#dataSummary"),
  startCapital: document.querySelector("#startCapital"),
  endCapital: document.querySelector("#endCapital"),
  profitLoss: document.querySelector("#profitLoss"),
  profitLossPercent: document.querySelector("#profitLossPercent"),
  buyTrades: document.querySelector("#buyTrades"),
  sellTrades: document.querySelector("#sellTrades"),
  finalStatus: document.querySelector("#finalStatus"),
  priceChart: document.querySelector("#priceChart"),
  chartTooltip: document.querySelector("#chartTooltip"),
  selectedDate: document.querySelector("#selectedDate"),
  selectedClose: document.querySelector("#selectedClose"),
  selectedAverage: document.querySelector("#selectedAverage"),
  selectedSignal: document.querySelector("#selectedSignal"),
  tradeTableBody: document.querySelector("#tradeTableBody"),
};

let currentStrategyData = [];
let currentTrades = [];
let animationFrame = null;
let selectedPointIndex = null;
let selectedTradeIndex = null;
let chartGeometry = null;
let pendingRun = null;

function getBacktestConfig() {
  const startingCapital = Number(elements.startingCapital.value);
  const movingAverageWindow = Number.parseInt(elements.movingAverageWindow.value, 10);
  const transactionFeePercent = Number(elements.feeRate.value);

  if (!Number.isFinite(startingCapital) || startingCapital <= 0) {
    throw new Error("Starting capital must be greater than zero.");
  }
  if (!Number.isInteger(movingAverageWindow) || movingAverageWindow < 1) {
    throw new Error("SMA window must be at least 1.");
  }
  if (!Number.isFinite(transactionFeePercent) || transactionFeePercent < 0) {
    throw new Error("Fee percent cannot be negative.");
  }

  return {
    startingCapital,
    movingAverageWindow,
    transactionFeeRate: transactionFeePercent / 100,
    transactionFeePercent,
  };
}

function updateRuleSummary(config) {
  elements.ruleCapital.textContent = `Capital: ${formatCurrency(config.startingCapital)}`;
  elements.ruleWindow.textContent = `SMA: ${config.movingAverageWindow}`;
  elements.ruleFee.textContent = `Fee: ${config.transactionFeePercent}%`;
}

function parseCsvLine(line) {
  const values = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      currentValue += '"';
      index += 1;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = "";
    } else {
      currentValue += character;
    }
  }

  values.push(currentValue.trim());
  return values;
}

function parsePriceData(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const dateIndex = headers.indexOf("date");
  const closeIndex = headers.indexOf("close");

  if (dateIndex === -1 || closeIndex === -1) {
    throw new Error("CSV file is missing required columns: date, close");
  }

  const skippedRows = [];
  const validRows = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values = parseCsvLine(lines[lineIndex]);
    const dateText = values[dateIndex];
    const closePrice = Number(values[closeIndex]);
    const timestamp = Date.parse(dateText);

    if (!dateText || Number.isNaN(timestamp) || !Number.isFinite(closePrice) || closePrice <= 0) {
      skippedRows.push(lineIndex + 1);
      continue;
    }

    validRows.push({
      date: dateText,
      timestamp,
      close: closePrice,
    });
  }

  if (validRows.length === 0) {
    throw new Error("CSV file contains no valid price rows.");
  }

  validRows.sort((left, right) => left.timestamp - right.timestamp);
  return { rows: validRows, skippedCount: skippedRows.length };
}

function calculateMovingAverage(rows, index, windowSize) {
  if (index < windowSize - 1) {
    return null;
  }

  let total = 0;
  const firstIndex = index - windowSize + 1;

  for (let cursor = firstIndex; cursor <= index; cursor += 1) {
    total += rows[cursor].close;
  }

  return total / windowSize;
}

function generateSignal(closePrice, movingAverage) {
  if (movingAverage === null) {
    return "hold";
  }
  if (closePrice > movingAverage) {
    return "buy";
  }
  if (closePrice < movingAverage) {
    return "sell";
  }
  return "hold";
}

function addStrategySignals(rows, movingAverageWindow) {
  return rows.map((row, index) => {
    const movingAverage = calculateMovingAverage(rows, index, movingAverageWindow);
    return {
      ...row,
      index,
      movingAverage,
      signal: generateSignal(row.close, movingAverage),
    };
  });
}

function runBacktest(rows, config) {
  const strategyData = addStrategySignals(rows, config.movingAverageWindow);
  const trades = [];
  let cashBalance = config.startingCapital;
  let assetUnits = 0;
  let buyTrades = 0;
  let sellTrades = 0;

  strategyData.forEach((row) => {
    if (row.signal === "buy" && assetUnits === 0) {
      const fee = cashBalance * config.transactionFeeRate;
      const investableCash = cashBalance - fee;
      assetUnits = investableCash / row.close;
      cashBalance = 0;
      buyTrades += 1;

      trades.push({
        ...row,
        type: "buy",
        fee,
        units: assetUnits,
        cashBalance,
      });
    } else if (row.signal === "sell" && assetUnits > 0) {
      const grossSaleValue = assetUnits * row.close;
      const fee = grossSaleValue * config.transactionFeeRate;
      const soldUnits = assetUnits;
      cashBalance = grossSaleValue - fee;
      assetUnits = 0;
      sellTrades += 1;

      trades.push({
        ...row,
        type: "sell",
        fee,
        units: soldUnits,
        cashBalance,
      });
    }
  });

  const lastClosePrice = strategyData[strategyData.length - 1].close;
  const endCapital = assetUnits > 0 ? assetUnits * lastClosePrice : cashBalance;
  const profitLoss = endCapital - config.startingCapital;

  return {
    strategyData,
    trades,
    result: {
      startCapital: config.startingCapital,
      endCapital,
      profitLoss,
      profitLossPercent: (profitLoss / config.startingCapital) * 100,
      buyTrades,
      sellTrades,
      finalStatus: assetUnits > 0 ? "holding asset" : "holding cash",
    },
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value, maximumFractionDigits = 4) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

function setSignedValue(element, value, formatter) {
  element.textContent = formatter(value);
  element.classList.remove("positive", "negative");

  if (value > 0) {
    element.classList.add("positive");
  } else if (value < 0) {
    element.classList.add("negative");
  }
}

function renderResults(result, rowCount, skippedCount) {
  elements.startCapital.textContent = formatCurrency(result.startCapital);
  elements.endCapital.textContent = formatCurrency(result.endCapital);
  setSignedValue(elements.profitLoss, result.profitLoss, formatCurrency);
  setSignedValue(
    elements.profitLossPercent,
    result.profitLossPercent,
    (value) => `${value.toFixed(2)}%`,
  );
  elements.buyTrades.textContent = String(result.buyTrades);
  elements.sellTrades.textContent = String(result.sellTrades);
  elements.finalStatus.textContent = result.finalStatus;
  elements.dataSummary.textContent = `${rowCount} valid rows, ${skippedCount} skipped`;
}

function renderTradeLog(trades) {
  if (trades.length === 0) {
    elements.tradeTableBody.innerHTML = `
      <tr>
        <td colspan="6">No buy or sell trades were triggered.</td>
      </tr>
    `;
    return;
  }

  elements.tradeTableBody.innerHTML = trades
    .map((trade, tradeIndex) => {
      const typeLabel = trade.type === "buy" ? "Buy" : "Sell";
      const typeClass = trade.type === "buy" ? "trade-buy" : "trade-sell";

      return `
        <tr class="trade-row" tabindex="0" data-trade-index="${tradeIndex}">
          <td>${trade.date}</td>
          <td class="${typeClass}">${typeLabel}</td>
          <td>${formatCurrency(trade.close)}</td>
          <td>${formatNumber(trade.units, 6)}</td>
          <td>${formatCurrency(trade.fee)}</td>
          <td>${formatCurrency(trade.cashBalance)}</td>
        </tr>
      `;
    })
    .join("");
}

function updateTradeSelection() {
  elements.tradeTableBody.querySelectorAll(".trade-row").forEach((row) => {
    const tradeIndex = Number(row.dataset.tradeIndex);
    row.classList.toggle("is-selected", tradeIndex === selectedTradeIndex);
  });
}

function renderSelectedPoint(row) {
  if (!row) {
    elements.selectedDate.textContent = "No point selected";
    elements.selectedClose.textContent = "-";
    elements.selectedAverage.textContent = "-";
    elements.selectedSignal.textContent = "-";
    elements.chartTooltip.hidden = true;
    return;
  }

  elements.selectedDate.textContent = row.date;
  elements.selectedClose.textContent = formatCurrency(row.close);
  elements.selectedAverage.textContent =
    row.movingAverage === null ? "-" : formatCurrency(row.movingAverage);
  elements.selectedSignal.textContent = row.signal;
}

function drawLine(context, points, xForIndex, yForValue, color, width, progress) {
  const visibleCount = Math.max(1, Math.ceil(points.length * progress));
  const visiblePoints = points.slice(0, visibleCount);

  context.beginPath();
  visiblePoints.forEach((point, index) => {
    const x = xForIndex(point.index);
    const y = yForValue(point.value);

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();
}

function drawChart(strategyData, trades, progress = 1) {
  const canvas = elements.priceChart;
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);

  chartGeometry = null;

  if (strategyData.length === 0) {
    return;
  }

  const margin = { top: 18, right: 20, bottom: 30, left: 52 };
  const width = rect.width - margin.left - margin.right;
  const height = rect.height - margin.top - margin.bottom;
  const closePoints = strategyData.map((row) => ({
    index: row.index,
    value: row.close,
  }));
  const averagePoints = strategyData
    .filter((row) => row.movingAverage !== null)
    .map((row) => ({ index: row.index, value: row.movingAverage }));
  const allValues = [...closePoints, ...averagePoints].map((point) => point.value);
  const minimumValue = Math.min(...allValues);
  const maximumValue = Math.max(...allValues);
  const valueRange = maximumValue - minimumValue || 1;
  const paddedMinimum = minimumValue - valueRange * 0.08;
  const paddedMaximum = maximumValue + valueRange * 0.08;
  const paddedRange = paddedMaximum - paddedMinimum;
  const finalIndex = Math.max(1, strategyData.length - 1);

  const xForIndex = (index) => margin.left + (index / finalIndex) * width;
  const yForValue = (value) =>
    margin.top + ((paddedMaximum - value) / paddedRange) * height;
  chartGeometry = {
    margin,
    width,
    height,
    finalIndex,
    xForIndex,
    yForValue,
  };

  context.fillStyle = "#fbfcf8";
  context.fillRect(0, 0, rect.width, rect.height);
  context.strokeStyle = "#d8ded1";
  context.lineWidth = 1;

  for (let gridIndex = 0; gridIndex <= 4; gridIndex += 1) {
    const y = margin.top + (height / 4) * gridIndex;
    context.beginPath();
    context.moveTo(margin.left, y);
    context.lineTo(margin.left + width, y);
    context.stroke();

    const value = paddedMaximum - (paddedRange / 4) * gridIndex;
    context.fillStyle = "#666c60";
    context.font = "12px system-ui";
    context.fillText(formatCurrency(value), 6, y + 4);
  }

  drawLine(context, closePoints, xForIndex, yForValue, "#161815", 2.4, progress);
  if (averagePoints.length > 0) {
    drawLine(context, averagePoints, xForIndex, yForValue, "#157a6e", 2, progress);
  }

  trades.forEach((trade) => {
    if (trade.index / finalIndex > progress) {
      return;
    }

    const x = xForIndex(trade.index);
    const y = yForValue(trade.close);
    const tradeIndex = trades.indexOf(trade);
    context.beginPath();
    context.arc(x, y, tradeIndex === selectedTradeIndex ? 7 : 5, 0, Math.PI * 2);
    context.fillStyle = trade.type === "buy" ? "#157a6e" : "#b64236";
    context.fill();
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.stroke();
  });

  if (selectedPointIndex !== null) {
    const selectedRow = strategyData[selectedPointIndex];
    if (selectedRow) {
      const x = xForIndex(selectedRow.index);
      const y = yForValue(selectedRow.close);

      context.strokeStyle = "rgba(15, 95, 87, 0.42)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, margin.top);
      context.lineTo(x, margin.top + height);
      context.stroke();

      context.beginPath();
      context.arc(x, y, 6, 0, Math.PI * 2);
      context.fillStyle = "#ffffff";
      context.fill();
      context.strokeStyle = "#0f5f57";
      context.lineWidth = 2;
      context.stroke();
    }
  }
}

function animateChart(strategyData, trades) {
  const start = performance.now();
  const duration = 520;

  if (animationFrame !== null) {
    cancelAnimationFrame(animationFrame);
  }

  const tick = (timestamp) => {
    const progress = Math.min(1, (timestamp - start) / duration);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    drawChart(strategyData, trades, easedProgress);

    if (progress < 1) {
      animationFrame = requestAnimationFrame(tick);
    }
  };

  animationFrame = requestAnimationFrame(tick);
}

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.toggle("error", isError);
}

function runFromText() {
  try {
    const config = getBacktestConfig();
    updateRuleSummary(config);
    const parsedData = parsePriceData(elements.csvText.value);
    const { strategyData, trades, result } = runBacktest(parsedData.rows, config);

    currentStrategyData = strategyData;
    currentTrades = trades;
    selectedPointIndex = null;
    selectedTradeIndex = null;
    renderSelectedPoint(null);
    renderResults(result, parsedData.rows.length, parsedData.skippedCount);
    renderTradeLog(trades);
    animateChart(strategyData, trades);
    setStatus("Backtest completed.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function scheduleAutoRun() {
  if (!elements.autoRun.checked) {
    return;
  }

  if (pendingRun !== null) {
    clearTimeout(pendingRun);
  }

  pendingRun = window.setTimeout(() => {
    runFromText();
  }, 260);
}

function handleFileUpload(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    elements.csvText.value = String(reader.result);
    runFromText();
  };
  reader.onerror = () => {
    setStatus("Could not read the selected CSV file.", true);
  };
  reader.readAsText(file);
}

function handleDroppedFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    elements.csvText.value = String(reader.result);
    runFromText();
  };
  reader.onerror = () => {
    setStatus("Could not read the dropped CSV file.", true);
  };
  reader.readAsText(file);
}

function findNearestPointIndex(clientX) {
  if (!chartGeometry || currentStrategyData.length === 0) {
    return null;
  }

  const rect = elements.priceChart.getBoundingClientRect();
  const x = clientX - rect.left;
  const { margin, width, finalIndex } = chartGeometry;

  if (x < margin.left || x > margin.left + width) {
    return null;
  }

  const relativeX = (x - margin.left) / width;
  return Math.max(0, Math.min(finalIndex, Math.round(relativeX * finalIndex)));
}

function positionTooltip(row) {
  if (!chartGeometry || !row) {
    elements.chartTooltip.hidden = true;
    return;
  }

  const x = chartGeometry.xForIndex(row.index);
  const y = chartGeometry.yForValue(row.close);
  elements.chartTooltip.innerHTML = `
    <strong>${row.date}</strong>
    <span>Close ${formatCurrency(row.close)}</span>
    <span>SMA ${row.movingAverage === null ? "-" : formatCurrency(row.movingAverage)}</span>
  `;
  elements.chartTooltip.style.left = `${x}px`;
  elements.chartTooltip.style.top = `${y}px`;
  elements.chartTooltip.hidden = false;
}

function selectPoint(pointIndex, tradeIndex = null) {
  selectedPointIndex = pointIndex;
  selectedTradeIndex = tradeIndex;
  const selectedRow = currentStrategyData[pointIndex] || null;

  renderSelectedPoint(selectedRow);
  updateTradeSelection();
  drawChart(currentStrategyData, currentTrades);
  positionTooltip(selectedRow);
}

elements.startingCapital.value = String(DEFAULT_STARTING_CAPITAL);
elements.movingAverageWindow.value = String(DEFAULT_MOVING_AVERAGE_WINDOW);
elements.feeRate.value = String(DEFAULT_TRANSACTION_FEE_PERCENT);
elements.csvText.value = SAMPLE_CSV;
elements.runButton.addEventListener("click", runFromText);
elements.sampleButton.addEventListener("click", () => {
  elements.csvText.value = SAMPLE_CSV;
  runFromText();
});
elements.csvFile.addEventListener("change", handleFileUpload);
elements.csvText.addEventListener("input", scheduleAutoRun);
elements.startingCapital.addEventListener("input", scheduleAutoRun);
elements.movingAverageWindow.addEventListener("input", scheduleAutoRun);
elements.feeRate.addEventListener("input", scheduleAutoRun);
elements.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropZone.classList.add("drag-over");
});
elements.dropZone.addEventListener("dragleave", () => {
  elements.dropZone.classList.remove("drag-over");
});
elements.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove("drag-over");

  const [file] = event.dataTransfer.files;
  if (file) {
    handleDroppedFile(file);
  }
});
elements.priceChart.addEventListener("mousemove", (event) => {
  const pointIndex = findNearestPointIndex(event.clientX);
  if (pointIndex !== null) {
    selectPoint(pointIndex);
  }
});
elements.priceChart.addEventListener("mouseleave", () => {
  elements.chartTooltip.hidden = true;
});
elements.tradeTableBody.addEventListener("click", (event) => {
  const row = event.target.closest(".trade-row");
  if (!row) {
    return;
  }

  const tradeIndex = Number(row.dataset.tradeIndex);
  const trade = currentTrades[tradeIndex];
  if (trade) {
    selectPoint(trade.index, tradeIndex);
  }
});
elements.tradeTableBody.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const row = event.target.closest(".trade-row");
  if (!row) {
    return;
  }

  event.preventDefault();
  const tradeIndex = Number(row.dataset.tradeIndex);
  const trade = currentTrades[tradeIndex];
  if (trade) {
    selectPoint(trade.index, tradeIndex);
  }
});

window.addEventListener("resize", () => {
  drawChart(currentStrategyData, currentTrades);
  if (selectedPointIndex !== null) {
    positionTooltip(currentStrategyData[selectedPointIndex]);
  }
});

runFromText();
