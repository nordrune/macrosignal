/** Strategy parameter and chart-legend helpers. */

export type StrategyType = 'sma' | 'ema' | 'rsi' | 'macd' | 'bollinger' | 'crossover';
export type StrategyParamKey =
	| 'window'
	| 'slow_window'
	| 'signal_window'
	| 'oversold'
	| 'overbought'
	| 'num_std';

export type StrategyParamDefinition = {
	key: StrategyParamKey;
	label: string;
	defaultValue: string;
	min: string;
	step: string;
};

export const DEFAULT_WINDOW = 20;

export type StrategyLegend = {
	label: string;
};

const LEGEND_CONFIG: Record<StrategyType, StrategyLegend> = {
	sma: { label: 'SMA' },
	ema: { label: 'EMA' },
	rsi: { label: 'RSI' },
	macd: { label: 'MACD' },
	bollinger: { label: 'Bollinger' },
	crossover: { label: 'SMA Crossover' }
};

const STRATEGY_PARAM_DEFINITIONS: Record<StrategyType, StrategyParamDefinition[]> = {
	sma: [{ key: 'window', label: 'Zeitraum', defaultValue: '20', min: '1', step: '1' }],
	ema: [{ key: 'window', label: 'Zeitraum', defaultValue: '20', min: '1', step: '1' }],
	rsi: [
		{ key: 'window', label: 'Zeitraum', defaultValue: '14', min: '1', step: '1' },
		{ key: 'oversold', label: 'Überverkauft', defaultValue: '30', min: '0', step: '1' },
		{ key: 'overbought', label: 'Überkauft', defaultValue: '70', min: '0', step: '1' }
	],
	macd: [
		{ key: 'window', label: 'Fast EMA', defaultValue: '12', min: '1', step: '1' },
		{ key: 'slow_window', label: 'Slow EMA', defaultValue: '26', min: '2', step: '1' },
		{ key: 'signal_window', label: 'Signal', defaultValue: '9', min: '1', step: '1' }
	],
	bollinger: [
		{ key: 'window', label: 'Zeitraum', defaultValue: '20', min: '1', step: '1' },
		{ key: 'num_std', label: 'Std-Abw.', defaultValue: '2', min: '0.1', step: '0.1' }
	],
	crossover: [
		{ key: 'window', label: 'Fast SMA', defaultValue: '20', min: '1', step: '1' },
		{ key: 'slow_window', label: 'Slow SMA', defaultValue: '60', min: '2', step: '1' }
	]
};

function parseNumeric(value: string | number | undefined, fallback: string): number {
	const parsed = typeof value === 'number' ? value : parseFloat(value ?? fallback);
	const fallbackParsed = parseFloat(fallback);
	return Number.isFinite(parsed) ? parsed : fallbackParsed;
}

export function getLegendConfig(strategy: StrategyType): StrategyLegend {
	return LEGEND_CONFIG[strategy] ?? LEGEND_CONFIG.sma;
}

export function getStrategyParamDefinitions(strategy: StrategyType): StrategyParamDefinition[] {
	return STRATEGY_PARAM_DEFINITIONS[strategy] ?? STRATEGY_PARAM_DEFINITIONS.sma;
}

export function getDefaultStrategyParamValues(
	strategy: StrategyType,
	primaryWindow?: string | number
): Record<string, string> {
	const definitions = getStrategyParamDefinitions(strategy);
	return Object.fromEntries(
		definitions.map((definition) => [
			definition.key,
			definition.key === 'window' && primaryWindow !== undefined
				? String(primaryWindow)
				: definition.defaultValue
		])
	);
}

export function normalizeStrategyParamValues(
	strategy: StrategyType,
	params?: Record<string, string | number> | null,
	primaryWindow?: string | number
): Record<string, string> {
	const defaults = getDefaultStrategyParamValues(strategy, primaryWindow);
	return Object.fromEntries(
		getStrategyParamDefinitions(strategy).map((definition) => [
			definition.key,
			String(params?.[definition.key] ?? defaults[definition.key])
		])
	);
}

export function getStrategyParams(
	strategy: StrategyType,
	windowOrParams: string | number | Record<string, string | number>
): Record<string, number> {
	const rawParams =
		typeof windowOrParams === 'object'
			? normalizeStrategyParamValues(strategy, windowOrParams)
			: normalizeStrategyParamValues(strategy, null, windowOrParams);

	return Object.fromEntries(
		getStrategyParamDefinitions(strategy).map((definition) => [
			definition.key,
			parseNumeric(rawParams[definition.key], definition.defaultValue)
		])
	);
}

export function primaryStrategyWindow(params: Record<string, string | number>): string {
	return String(params.window ?? DEFAULT_WINDOW);
}

export function formatStrategyParamSummary(
	strategy: StrategyType,
	params: Record<string, string | number>
): string {
	const normalized = normalizeStrategyParamValues(strategy, params);
	return getStrategyParamDefinitions(strategy)
		.map((definition) => `${definition.label}: ${normalized[definition.key]}`)
		.join(' · ');
}
