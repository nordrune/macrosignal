/**
 * Small translation layer for the dashboard.
 *
 * This avoids adding a framework-level i18n dependency while still keeping all
 * user-facing text in one place. Static DOM text is translated through
 * `data-i18n` attributes; dynamic strings call `t()` from app.js.
 */

const DEFAULT_LANGUAGE = "de";
const STORAGE_KEY = "macrosignal-language";

const STRINGS = {
  de: {
    "app.title": "MacroSignal - Strategie-Tester",
    "header.eyebrow": "Software Engineering Projekt",
    "header.productSuffix": "Strategie-Tester",
    "active.strategy": "Strategie",
    "active.settings": "Aktuelle Einstellungen",
    "active.ticker": "Ticker",
    "active.fee": "Gebühr",
    "active.customCsv": "Eigene CSV",
    "language.aria": "Sprache wechseln",
    "section.settings": "Einstellungen",
    "source.label": "Datenquelle",
    "source.tooltip": "Hier wählst du, ob echte historische Marktdaten geladen werden oder ob eine eigene CSV-Datei verwendet wird.",
    "source.yahoo": "Yahoo Finance",
    "source.csv": "CSV-Datei",
    "ticker.label": "Ticker-Symbol",
    "ticker.tooltip": "Kurzname eines Assets an der Börse. Beispiele: AAPL für Apple, BTC-USD für Bitcoin in US-Dollar.",
    "ticker.placeholder": "z. B. AAPL, BTC-USD, EURUSD=X",
    "action.loadData": "Daten laden",
    "period.label": "Zeitraum",
    "period.tooltip": "Wie weit die historischen Kursdaten zurückreichen sollen.",
    "period.1mo": "1 Monat",
    "period.3mo": "3 Monate",
    "period.6mo": "6 Monate",
    "period.1y": "1 Jahr",
    "period.2y": "2 Jahre",
    "period.5y": "5 Jahre",
    "period.max": "Maximal",
    "interval.label": "Datenabstand",
    "interval.tooltip": "Legt fest, ob jeder Kurswert z. B. eine Stunde, einen Tag oder eine Woche abbildet.",
    "interval.1h": "1 Stunde",
    "interval.1d": "1 Tag",
    "interval.1wk": "1 Woche",
    "csv.heading": "CSV hochladen oder einfügen (Spalten: date, close)",
    "csv.tooltip": "CSV ist eine einfache Tabellen-Datei. Diese App braucht mindestens Datum und Schlusskurs.",
    "csv.upload": "CSV hochladen",
    "csv.drop": "CSV-Datei hier ablegen oder unten einfügen",
    "csv.aria": "CSV-Daten",
    "strategy.label": "Strategie",
    "strategy.tooltip": "Eine Regel, nach der die App rückwirkend entscheidet: kaufen, verkaufen oder halten. SMA/EMA sind Durchschnittslinien, RSI misst Stärke/Schwäche, MACD sucht Trendwechsel.",
    "strategy.sma": "Einfacher Durchschnitt (SMA)",
    "strategy.ema": "Gewichteter Durchschnitt (EMA)",
    "strategy.rsi": "Überkauft/überverkauft (RSI)",
    "strategy.macd": "Trendwechsel (MACD)",
    "strategy.bollinger": "Preisspanne (Bollinger Bands)",
    "strategy.combined": "SMA + RSI kombiniert",
    "param.smaWindow": "SMA-Zeitraum",
    "param.smaTooltip": "SMA bedeutet Simple Moving Average: der einfache Durchschnitt der letzten X Kurswerte.",
    "param.emaWindow": "EMA-Zeitraum",
    "param.emaTooltip": "EMA ist ein Durchschnitt, der neue Kurse stärker gewichtet als ältere Kurse.",
    "param.rsiWindow": "RSI-Zeitraum",
    "param.rsiTooltip": "RSI misst, ob ein Asset zuletzt eher stark gestiegen oder gefallen ist. Werte nahe 0 sind schwach, Werte nahe 100 sehr stark.",
    "param.buyThreshold": "Kauf-Schwelle",
    "param.buyThresholdTooltip": "Unter diesem RSI-Wert gilt das Asset als eher überverkauft. Die Strategie kann dann ein Kaufsignal erzeugen.",
    "param.sellThreshold": "Verkauf-Schwelle",
    "param.sellThresholdTooltip": "Über diesem RSI-Wert gilt das Asset als eher überkauft. Die Strategie kann dann ein Verkaufssignal erzeugen.",
    "param.fastLine": "Schnelle Linie",
    "param.fastLineTooltip": "MACD vergleicht zwei Durchschnittslinien. Die schnelle Linie reagiert stärker auf neue Kurse.",
    "param.slowLine": "Langsame Linie",
    "param.slowLineTooltip": "Die langsame MACD-Linie reagiert träger und dient als Vergleich zur schnellen Linie.",
    "param.signalLine": "Signallinie",
    "param.signalLineTooltip": "Die Signallinie glättet den MACD. Kreuzungen werden als mögliche Kauf- oder Verkaufspunkte genutzt.",
    "param.bandWindow": "Band-Zeitraum",
    "param.bandWindowTooltip": "Bollinger Bands zeigen eine obere und untere Preisspanne rund um den Durchschnitt.",
    "param.bandWidth": "Band-Breite",
    "param.bandWidthTooltip": "Bestimmt, wie weit die Bollinger-Bänder vom Durchschnitt entfernt liegen. Größer bedeutet breitere Bänder.",
    "param.smaFilter": "SMA-Filter",
    "param.combinedSmaTooltip": "Die kombinierte Strategie kauft nur, wenn der Kurs zusätzlich zum RSI-Signal zum SMA-Filter passt.",
    "param.combinedRsiTooltip": "Legt fest, wie viele Kurswerte für den RSI-Teil der kombinierten Strategie betrachtet werden.",
    "param.rsiBuyFilter": "RSI-Kauffilter",
    "param.rsiBuyFilterTooltip": "Unter diesem RSI-Wert darf die kombinierte Strategie ein Kaufsignal prüfen.",
    "param.rsiSellFilter": "RSI-Verkaufsfilter",
    "param.rsiSellFilterTooltip": "Über diesem RSI-Wert darf die kombinierte Strategie ein Verkaufssignal prüfen.",
    "capital.start": "Startkapital",
    "capital.tooltip": "Virtuelles Geld, mit dem die Simulation startet. Es wird kein echtes Geld verwendet.",
    "fee.label": "Gebühr pro Kauf/Verkauf (%)",
    "fee.tooltip": "Simulierte Handelsgebühr bei jedem Kauf oder Verkauf. 0.1 bedeutet 0.1 Prozent.",
    "autorun.label": "Bei Änderungen automatisch neu berechnen",
    "action.run": "Strategie testen",
    "action.optimize": "Parameter suchen",
    "action.sample": "Beispieldaten laden",
    "results.title": "Ergebnis der Simulation",
    "results.empty": "Noch nicht berechnet",
    "metric.start": "Startkapital",
    "metric.end": "Endkapital",
    "metric.profit": "Gewinn / Verlust",
    "metric.strategyReturn": "Strategie-Rendite",
    "metric.strategyReturnTooltip": "Prozentuale Veränderung des Startkapitals durch die getestete Strategie.",
    "metric.sharpe": "Sharpe Ratio",
    "metric.sharpeTooltip": "Kennzahl für Rendite im Verhältnis zum Risiko. Höher ist besser, aber für diesen MVP nur eine grobe Orientierung.",
    "metric.drawdown": "Größter Rückgang",
    "metric.drawdownTooltip": "Der größte zwischenzeitliche Verlust vom bisherigen Höchststand des virtuellen Kapitals.",
    "metric.winRate": "Trefferquote",
    "metric.winRateTooltip": "Anteil der abgeschlossenen Trades, die mit Gewinn endeten.",
    "metric.buyHold": "Kaufen und Halten",
    "metric.buyHoldTooltip": "Vergleich: Was passiert wäre, wenn man am Anfang gekauft und bis zum Ende gehalten hätte.",
    "metric.trades": "Aktionen (Kauf/Verkauf)",
    "metrics.aria": "Kennzahlen der Simulation",
    "status.position": "Aktueller Simulationsstatus",
    "position.cash": "hält Bargeld",
    "position.asset": "hält Asset",
    "chart.mainAria": "Kursverlauf und Strategie-Indikatoren",
    "chart.subAria": "Zusätzlicher Indikator",
    "legend.price": "Kurs",
    "legend.indicator": "Indikator",
    "legend.middleBand": "Mittleres Band",
    "legend.upperBand": "Oberes Band",
    "legend.lowerBand": "Unteres Band",
    "legend.buy": "Kaufsignal",
    "legend.sell": "Verkaufssignal",
    "legend.aria": "Chart-Legende",
    "inspect.date": "Ausgewähltes Datum",
    "inspect.defaultDate": "Über den Chart fahren",
    "inspect.close": "Schlusskurs",
    "inspect.indicator": "Indikatorwert",
    "inspect.signal": "Signal",
    "inspect.aria": "Information zum ausgewählten Chartpunkt",
    "trades.title": "Simulierte Käufe und Verkäufe",
    "trades.subtitle": "Virtuelle Käufe und Verkäufe der Strategie",
    "table.date": "Datum",
    "table.action": "Aktion",
    "table.price": "Kurs",
    "table.units": "Anzahl",
    "table.fee": "Gebühr",
    "table.cash": "Bargeld danach",
    "table.empty": "Strategie testen, um simulierte Trades zu sehen.",
    "trade.details": "Details zur Aktion",
    "trade.closeAria": "Details schließen",
    "trade.hold": "Haltedauer",
    "trade.profit": "Gewinn dieser Aktion",
    "trade.roi": "Rendite dieser Aktion (ROI)",
    "trade.roiTooltip": "ROI bedeutet Return on Investment: prozentuale Rendite eines einzelnen Kaufs oder Verkaufs.",
    "trade.fees": "Gezahlte Gebühren",
    "optimizer.title": "Parameter-Suche",
    "optimizer.closeAria": "Parameter-Suche schließen",
    "optimizer.desc": "Die App testet mehrere Einstellungen und zeigt die besten Ergebnisse.",
    "optimizer.loading": "Einstellungen werden getestet...",
    "optimizer.rank": "Rang",
    "optimizer.params": "Einstellungen",
    "optimizer.finalCapital": "Endkapital",
    "optimizer.return": "Rendite",
    "optimizer.trades": "Aktionen",
    "optimizer.noRuns": "Keine passenden Einstellungen gefunden.",
    "optimizer.apply": "Übernehmen",
    "footer": "MacroSignal Dashboard © 2026. Software-Engineering-Projekt.",
    "status.running": "Simulation wird berechnet...",
    "status.done": "Simulation abgeschlossen.",
    "status.optimizeFailed": "Parameter-Suche fehlgeschlagen: {message}",
    "error.capital": "Das Startkapital muss größer als 0 sein.",
    "error.fee": "Die Gebühr darf nicht negativ sein.",
    "error.ticker": "Bitte ein gültiges Ticker-Symbol eingeben.",
    "error.tickerFirst": "Bitte zuerst ein gültiges Ticker-Symbol eingeben.",
    "error.backtest": "Serverfehler beim Berechnen der Simulation.",
    "error.optimize": "Serverfehler bei der Parameter-Suche.",
    "summary.loaded": "{count} Kurswerte geladen",
    "trade.none": "Die Strategie hat keine Käufe oder Verkäufe ausgelöst.",
    "trade.buy": "Kauf",
    "trade.sell": "Verkauf",
    "trade.count": "{total} ({buy} K / {sell} V)",
    "trade.days": "{count} {count, plural, one {Tag} other {Tage}}",
    "signal.buy": "KAUFEN",
    "signal.sell": "VERKAUFEN",
    "signal.hold": "HALTEN",
    "tooltip.date": "Datum",
    "tooltip.close": "Schlusskurs",
    "tooltip.capital": "Kapital",
    "param.window": "Zeitraum",
    "param.buy_threshold": "Kauf-Schwelle",
    "param.sell_threshold": "Verkauf-Schwelle",
    "param.fast": "Schnelle Linie",
    "param.slow": "Langsame Linie",
    "param.signal_window": "Signallinie",
    "param.num_std": "Band-Breite",
    "param.sma_window": "SMA-Zeitraum",
    "param.rsi_window": "RSI-Zeitraum"
  },
  en: {
    "app.title": "MacroSignal - Strategy Tester",
    "header.eyebrow": "Software Engineering Project",
    "header.productSuffix": "Strategy Tester",
    "active.strategy": "Strategy",
    "active.settings": "Current settings",
    "active.ticker": "Ticker",
    "active.fee": "Fee",
    "active.customCsv": "Custom CSV",
    "language.aria": "Change language",
    "section.settings": "Settings",
    "source.label": "Data source",
    "source.tooltip": "Choose whether to load real historical market data or use your own CSV file.",
    "source.yahoo": "Yahoo Finance",
    "source.csv": "CSV file",
    "ticker.label": "Ticker symbol",
    "ticker.tooltip": "Short market symbol for an asset. Examples: AAPL for Apple, BTC-USD for Bitcoin in US dollars.",
    "ticker.placeholder": "e.g. AAPL, BTC-USD, EURUSD=X",
    "action.loadData": "Load data",
    "period.label": "Time range",
    "period.tooltip": "How far back the historical price data should go.",
    "period.1mo": "1 month",
    "period.3mo": "3 months",
    "period.6mo": "6 months",
    "period.1y": "1 year",
    "period.2y": "2 years",
    "period.5y": "5 years",
    "period.max": "Maximum",
    "interval.label": "Data interval",
    "interval.tooltip": "Defines whether each price point represents one hour, one day, or one week.",
    "interval.1h": "1 hour",
    "interval.1d": "1 day",
    "interval.1wk": "1 week",
    "csv.heading": "Upload or paste CSV data (columns: date, close)",
    "csv.tooltip": "CSV is a simple table file. This app needs at least date and closing price.",
    "csv.upload": "Upload CSV",
    "csv.drop": "Drop a CSV file here or paste data below",
    "csv.aria": "CSV data",
    "strategy.label": "Strategy",
    "strategy.tooltip": "A rule the app tests backwards in time: buy, sell, or hold. SMA/EMA are average lines, RSI measures strength/weakness, MACD looks for trend changes.",
    "strategy.sma": "Simple average (SMA)",
    "strategy.ema": "Weighted average (EMA)",
    "strategy.rsi": "Overbought/oversold (RSI)",
    "strategy.macd": "Trend change (MACD)",
    "strategy.bollinger": "Price range (Bollinger Bands)",
    "strategy.combined": "SMA + RSI combined",
    "param.smaWindow": "SMA period",
    "param.smaTooltip": "SMA means Simple Moving Average: the average of the last X price values.",
    "param.emaWindow": "EMA period",
    "param.emaTooltip": "EMA is an average that gives newer prices more weight than older prices.",
    "param.rsiWindow": "RSI period",
    "param.rsiTooltip": "RSI measures whether an asset recently moved strongly up or down. Values near 0 are weak, values near 100 are very strong.",
    "param.buyThreshold": "Buy threshold",
    "param.buyThresholdTooltip": "Below this RSI value the asset is treated as more oversold. The strategy may create a buy signal.",
    "param.sellThreshold": "Sell threshold",
    "param.sellThresholdTooltip": "Above this RSI value the asset is treated as more overbought. The strategy may create a sell signal.",
    "param.fastLine": "Fast line",
    "param.fastLineTooltip": "MACD compares two average lines. The fast line reacts more strongly to new prices.",
    "param.slowLine": "Slow line",
    "param.slowLineTooltip": "The slow MACD line reacts more slowly and is compared with the fast line.",
    "param.signalLine": "Signal line",
    "param.signalLineTooltip": "The signal line smooths the MACD. Crossings are used as possible buy or sell points.",
    "param.bandWindow": "Band period",
    "param.bandWindowTooltip": "Bollinger Bands show an upper and lower price range around an average.",
    "param.bandWidth": "Band width",
    "param.bandWidthTooltip": "Defines how far the Bollinger Bands are from the average. Higher means wider bands.",
    "param.smaFilter": "SMA filter",
    "param.combinedSmaTooltip": "The combined strategy only buys when the price also fits the SMA filter in addition to the RSI signal.",
    "param.combinedRsiTooltip": "Defines how many price values are used for the RSI part of the combined strategy.",
    "param.rsiBuyFilter": "RSI buy filter",
    "param.rsiBuyFilterTooltip": "Below this RSI value the combined strategy may check for a buy signal.",
    "param.rsiSellFilter": "RSI sell filter",
    "param.rsiSellFilterTooltip": "Above this RSI value the combined strategy may check for a sell signal.",
    "capital.start": "Starting capital",
    "capital.tooltip": "Virtual money used at the start of the simulation. No real money is used.",
    "fee.label": "Fee per buy/sell (%)",
    "fee.tooltip": "Simulated trading fee for every buy or sell. 0.1 means 0.1 percent.",
    "autorun.label": "Automatically recalculate when settings change",
    "action.run": "Test strategy",
    "action.optimize": "Find parameters",
    "action.sample": "Load sample data",
    "results.title": "Simulation result",
    "results.empty": "Not calculated yet",
    "metric.start": "Starting capital",
    "metric.end": "Final capital",
    "metric.profit": "Profit / loss",
    "metric.strategyReturn": "Strategy return",
    "metric.strategyReturnTooltip": "Percentage change of the starting capital caused by the tested strategy.",
    "metric.sharpe": "Sharpe ratio",
    "metric.sharpeTooltip": "Risk-adjusted return measure. Higher is better, but in this MVP it is only a rough guide.",
    "metric.drawdown": "Largest drop",
    "metric.drawdownTooltip": "The biggest temporary loss from the previous peak of the virtual capital.",
    "metric.winRate": "Win rate",
    "metric.winRateTooltip": "Share of completed trades that ended with a profit.",
    "metric.buyHold": "Buy and hold",
    "metric.buyHoldTooltip": "Comparison: what would have happened if you bought at the start and held until the end.",
    "metric.trades": "Actions (buy/sell)",
    "metrics.aria": "Simulation metrics",
    "status.position": "Current simulation status",
    "position.cash": "holding cash",
    "position.asset": "holding asset",
    "chart.mainAria": "Price chart and strategy indicators",
    "chart.subAria": "Additional indicator",
    "legend.price": "Price",
    "legend.indicator": "Indicator",
    "legend.middleBand": "Middle band",
    "legend.upperBand": "Upper band",
    "legend.lowerBand": "Lower band",
    "legend.buy": "Buy signal",
    "legend.sell": "Sell signal",
    "legend.aria": "Chart legend",
    "inspect.date": "Selected date",
    "inspect.defaultDate": "Hover over chart",
    "inspect.close": "Closing price",
    "inspect.indicator": "Indicator value",
    "inspect.signal": "Signal",
    "inspect.aria": "Selected chart point information",
    "trades.title": "Simulated buys and sells",
    "trades.subtitle": "Virtual buys and sells created by the strategy",
    "table.date": "Date",
    "table.action": "Action",
    "table.price": "Price",
    "table.units": "Units",
    "table.fee": "Fee",
    "table.cash": "Cash afterwards",
    "table.empty": "Test a strategy to see simulated trades.",
    "trade.details": "Action details",
    "trade.closeAria": "Close details",
    "trade.hold": "Holding time",
    "trade.profit": "Profit of this action",
    "trade.roi": "Return of this action (ROI)",
    "trade.roiTooltip": "ROI means Return on Investment: percentage return of a single buy or sell.",
    "trade.fees": "Fees paid",
    "optimizer.title": "Parameter search",
    "optimizer.closeAria": "Close parameter search",
    "optimizer.desc": "The app tests several settings and shows the best results.",
    "optimizer.loading": "Testing settings...",
    "optimizer.rank": "Rank",
    "optimizer.params": "Settings",
    "optimizer.finalCapital": "Final capital",
    "optimizer.return": "Return",
    "optimizer.trades": "Actions",
    "optimizer.noRuns": "No suitable settings found.",
    "optimizer.apply": "Apply",
    "footer": "MacroSignal Dashboard © 2026. Software engineering project.",
    "status.running": "Calculating simulation...",
    "status.done": "Simulation completed.",
    "status.optimizeFailed": "Parameter search failed: {message}",
    "error.capital": "Starting capital must be greater than 0.",
    "error.fee": "The fee cannot be negative.",
    "error.ticker": "Please enter a valid ticker symbol.",
    "error.tickerFirst": "Please enter a valid ticker symbol first.",
    "error.backtest": "Server error while calculating the simulation.",
    "error.optimize": "Server error during parameter search.",
    "summary.loaded": "{count} price points loaded",
    "trade.none": "The strategy did not trigger any buys or sells.",
    "trade.buy": "Buy",
    "trade.sell": "Sell",
    "trade.count": "{total} ({buy} B / {sell} S)",
    "trade.days": "{count} {count, plural, one {day} other {days}}",
    "signal.buy": "BUY",
    "signal.sell": "SELL",
    "signal.hold": "HOLD",
    "tooltip.date": "Date",
    "tooltip.close": "Closing price",
    "tooltip.capital": "Capital",
    "param.window": "Period",
    "param.buy_threshold": "Buy threshold",
    "param.sell_threshold": "Sell threshold",
    "param.fast": "Fast line",
    "param.slow": "Slow line",
    "param.signal_window": "Signal line",
    "param.num_std": "Band width",
    "param.sma_window": "SMA period",
    "param.rsi_window": "RSI period"
  }
};

let currentLanguage = DEFAULT_LANGUAGE;

function interpolate(template, values = {}) {
  return template.replace(/\{(\w+), plural, one \{([^{}]+)\} other \{([^{}]+)\}\}/g, (_, key, one, other) => {
    return Number(values[key]) === 1 ? one : other;
  }).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

/**
 * Translate a key for the currently active language.
 *
 * @param {string} key Translation key.
 * @param {Record<string, string|number>} values Values for placeholders.
 * @returns {string} Interpolated translation, or the key when missing.
 */
export function t(key, values = {}) {
  const template = STRINGS[currentLanguage][key] ?? STRINGS[DEFAULT_LANGUAGE][key] ?? key;
  return interpolate(template, values);
}

/**
 * Return the currently active language code.
 *
 * @returns {"de"|"en"} Current language code.
 */
export function getLanguage() {
  return currentLanguage;
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.title = t("app.title");

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-tooltip]").forEach((element) => {
    const tooltip = t(element.dataset.i18nTooltip);
    element.dataset.tooltip = tooltip;
    element.setAttribute("aria-label", tooltip);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
}

function updateLanguageButtons() {
  document.querySelectorAll("[data-language-option]").forEach((button) => {
    const isActive = button.dataset.languageOption === currentLanguage;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

/**
 * Persist and apply a new dashboard language.
 *
 * @param {string} language Language key from STRINGS.
 * @param {(language: string) => void} [onChange] Callback for dynamic UI redraws.
 */
export function setLanguage(language, onChange) {
  if (!STRINGS[language]) return;
  currentLanguage = language;
  localStorage.setItem(STORAGE_KEY, language);
  applyTranslations();
  updateLanguageButtons();
  if (onChange) onChange(language);
}

/**
 * Initialise translations, button handlers, and persisted language state.
 *
 * @param {(language: string) => void} [onChange] Callback for dynamic UI redraws.
 */
export function initI18n(onChange) {
  const storedLanguage = localStorage.getItem(STORAGE_KEY);
  currentLanguage = STRINGS[storedLanguage] ? storedLanguage : DEFAULT_LANGUAGE;

  document.querySelectorAll("[data-language-option]").forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.languageOption, onChange));
  });

  applyTranslations();
  updateLanguageButtons();
  if (onChange) onChange(currentLanguage);
}
