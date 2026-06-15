/**
 * Strategy-specific form and legend helpers.
 *
 * The HTML contains all parameter inputs, but only the group for the selected
 * strategy is shown. Keeping the mapping here makes it easier to add another
 * strategy without touching the main dashboard state machine.
 */

const LEGEND_CONFIG = {
  sma: { label: "SMA", color: "#00e6c3", showMain: true, showBands: false },
  ema: { label: "EMA", color: "#00e6c3", showMain: true, showBands: false }
};

// Read a numeric input and fall back when the value is empty or invalid.
function numericInput(id, fallback, parser = parseInt) {
  const value = parser(document.getElementById(id).value, 10);
  return Number.isFinite(value) ? value : fallback;
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
  return {};
}
