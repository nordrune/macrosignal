/**
 * Strategy-specific form and legend helpers.
 *
 * The HTML contains all parameter inputs, but only the group for the selected
 * strategy is shown. Keeping the mapping here makes it easier to add another
 * strategy without touching the main dashboard state machine.
 */

const LEGEND_CONFIG = {
  sma: { label: "SMA", color: "#00e6c3", showMain: true, showBands: false },
  ema: { label: "EMA", color: "#00e6c3", showMain: true, showBands: false },
  rsi: { showMain: false, showBands: false },
  macd: { showMain: false, showBands: false },
  bollinger: { labelKey: "legend.middleBand", color: "#00bfa5", showMain: true, showBands: true },
  combined: { label: "SMA", color: "#00e6c3", showMain: true, showBands: false }
};

// Read a numeric input and fall back when the value is empty or invalid.
function numericInput(id, fallback, parser = parseInt) {
  const value = parser(document.getElementById(id).value, 10);
  return Number.isFinite(value) ? value : fallback;
}

// Apply optimizer values without overwriting fields that are not present.
function setInputValue(id, value) {
  if (value !== undefined) {
    document.getElementById(id).value = value;
  }
}

/**
 * Show the relevant parameter fields and chart legend for a strategy.
 *
 * @param {string} strategy Selected strategy key.
 * @param {{maLegend: HTMLElement, bbUpperLegend: HTMLElement, bbLowerLegend: HTMLElement}} elements Legend elements.
 * @param {(key: string) => string} translate Translation function for labels.
 */
export function updateStrategyControls(strategy, elements, translate = (key) => key) {
  document.querySelectorAll(".param-group").forEach((group) => {
    group.classList.remove("active");
  });

  const activeParamGroup = document.getElementById(`params_${strategy}`);
  if (activeParamGroup) {
    activeParamGroup.classList.add("active");
  }

  const legend = LEGEND_CONFIG[strategy] || LEGEND_CONFIG.sma;
  elements.bbUpperLegend.hidden = !legend.showBands;
  elements.bbLowerLegend.hidden = !legend.showBands;

  if (!legend.showMain) {
    elements.maLegend.style.display = "none";
    return;
  }

  const label = legend.labelKey ? translate(legend.labelKey) : legend.label;
  elements.maLegend.innerHTML = `<i class="legend-line indicator-line" style="background-color: ${legend.color};"></i>${label}`;
  elements.maLegend.style.display = "inline-flex";
}

/**
 * Read the currently visible strategy parameters from the form.
 *
 * @param {string} strategy Selected strategy key.
 * @returns {Record<string, number>} Parameters expected by the backend.
 */
export function getStrategyParams(strategy) {
  if (strategy === "sma") {
    return { window: numericInput("sma_window", 20) };
  }
  if (strategy === "ema") {
    return { window: numericInput("ema_window", 20) };
  }
  if (strategy === "rsi") {
    return {
      window: numericInput("rsi_window", 14),
      buy_threshold: numericInput("rsi_buy", 30),
      sell_threshold: numericInput("rsi_sell", 70)
    };
  }
  if (strategy === "macd") {
    return {
      fast: numericInput("macd_fast", 12),
      slow: numericInput("macd_slow", 26),
      signal_window: numericInput("macd_signal", 9)
    };
  }
  if (strategy === "bollinger") {
    return {
      window: numericInput("bb_window", 20),
      num_std: numericInput("bb_std", 2.0, parseFloat)
    };
  }
  if (strategy === "combined") {
    return {
      sma_window: numericInput("comb_sma_window", 20),
      rsi_window: numericInput("comb_rsi_window", 14),
      buy_threshold: numericInput("comb_rsi_buy", 50),
      sell_threshold: numericInput("comb_rsi_sell", 70)
    };
  }
  return {};
}

/**
 * Apply optimizer output back to the form fields for the selected strategy.
 *
 * @param {string} strategy Selected strategy key.
 * @param {Record<string, number>} params Optimizer parameter values.
 */
export function applyStrategyParams(strategy, params) {
  if (strategy === "sma") {
    setInputValue("sma_window", params.window);
  } else if (strategy === "ema") {
    setInputValue("ema_window", params.window);
  } else if (strategy === "rsi") {
    setInputValue("rsi_window", params.window);
    setInputValue("rsi_buy", params.buy_threshold);
    setInputValue("rsi_sell", params.sell_threshold);
  } else if (strategy === "macd") {
    setInputValue("macd_fast", params.fast);
    setInputValue("macd_slow", params.slow);
    setInputValue("macd_signal", params.signal_window);
  } else if (strategy === "bollinger") {
    setInputValue("bb_window", params.window);
    setInputValue("bb_std", params.num_std);
  } else if (strategy === "combined") {
    setInputValue("comb_sma_window", params.sma_window);
    setInputValue("comb_rsi_window", params.rsi_window);
    setInputValue("comb_rsi_buy", params.buy_threshold);
    setInputValue("comb_rsi_sell", params.sell_threshold);
  }
}
