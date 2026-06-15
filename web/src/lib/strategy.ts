/** Strategy parameter and chart-legend helpers for SMA / EMA. */

export type StrategyType = 'sma' | 'ema';

export const DEFAULT_WINDOW = 20;

export type StrategyLegend = {
	label: string;
	color: string;
	showMain: boolean;
	showBands: boolean;
};

const LEGEND_CONFIG: Record<StrategyType, StrategyLegend> = {
	sma: { label: 'SMA', color: '#00e6c3', showMain: true, showBands: false },
	ema: { label: 'EMA', color: '#00e6c3', showMain: true, showBands: false }
};

// ponytail: sma and ema share one window param — same backend shape
function parseWindow(value: string | number, fallback = DEFAULT_WINDOW): number {
	const parsed = typeof value === 'number' ? value : parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

export function getLegendConfig(strategy: StrategyType): StrategyLegend {
	return LEGEND_CONFIG[strategy] ?? LEGEND_CONFIG.sma;
}

export function getStrategyParams(
	_strategy: StrategyType,
	window: string | number
): Record<string, number> {
	return { window: parseWindow(window) };
}
