/**
 * Shared display formatting helpers.
 *
 * Keeping formatting in one place prevents small differences between cards,
 * chart tooltips, and table rows.
 */

/**
 * Format a number as a US-dollar amount.
 *
 * @param {number} value Amount to format.
 * @returns {string} Currency string for the dashboard.
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

/**
 * Check whether a value can be rendered as a finite number.
 *
 * @param {unknown} value Candidate value from the API.
 * @returns {boolean} True when the value is numeric and finite.
 */
export function hasNumber(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

/**
 * Render a signed metric and update its positive/negative card styling.
 *
 * @param {HTMLElement} element Element that receives the formatted text.
 * @param {number} value Numeric value used for sign detection.
 * @param {(value: number) => string} formatter Formatter for the visible text.
 */
export function setSignedText(element, value, formatter) {
  element.textContent = formatter(value);
  element.parentElement.classList.remove("positive", "negative");

  if (value > 0) {
    element.parentElement.classList.add("positive");
  } else if (value < 0) {
    element.parentElement.classList.add("negative");
  }
}
