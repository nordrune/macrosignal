/** Theme tokens: CSS :root in app.css is the source of truth; this module reads vars for canvas/SSR. */

import { browser } from '$app/environment';

/** PWA meta + manifest; dark must match static/site.webmanifest. */
export const META_THEME_COLOR = '#08090d';

/** White logo on dark bg; also copied to /favicon.ico and /favicon.png. */
export const FAVICON = {
	png: '/favicon.png',
	ico: '/favicon.ico'
} as const;

/** PWA install icons: black bg + white logo. */
export const PWA_ICON = {
	icon192: '/pwa-icon-192.png',
	icon512: '/pwa-icon-512.png',
	icon512Maskable: '/pwa-icon-512-maskable.png',
	apple: '/apple-touch-icon.png'
} as const;

export const CSS_VAR = {
	background: '--background',
	foreground: '--foreground',
	primary: '--primary',
	positive: '--positive',
	negative: '--negative',
	warning: '--warning',
	chartPrice: '--chart-price',
	chartMa: '--chart-ma',
	chartBuy: '--chart-buy',
	chartSell: '--chart-sell',
	chartGrid: '--chart-grid',
	chartLabel: '--chart-label',
	chartMarkerStroke: '--chart-marker-stroke',
	chartRange: '--chart-range',
	chartDrawdownFill: '--chart-drawdown-fill'
} as const;

export const CHART_RANGE_ALPHA_FALLBACK = 0.07;

/** Tailwind utilities mapped in app.css @theme from CSS_VAR tokens. */
export const TONE_CLASS = {
	positive: 'text-positive',
	negative: 'text-negative',
	warning: 'text-warning',
	neutral: 'text-foreground'
} as const;

export const SIGNAL_CLASS = {
	buy: 'text-positive',
	sell: 'text-negative'
} as const;

export const SIGNAL_DOT_CLASS = {
	buy: 'bg-positive',
	sell: 'bg-negative'
} as const;

export const SURFACE_CLASS = {
	shell: 'surface-shell',
	card: 'surface-card',
	inset: 'surface-inset',
	control: 'surface-control',
	table: 'surface-table'
} as const;

/** Native `<select>` — popup list is OS-rendered; color-scheme/accent-color in app.css. */
export const NATIVE_SELECT_CLASS = 'native-select';

/** Layout stability — reserved heights/slots; definitions in app.css. */
export const STABLE_CLASS = {
	status: 'stable-status',
	subtitle: 'stable-subtitle',
	value: 'stable-value',
	label: 'stable-label',
	iconSlot: 'stable-icon-slot',
	headerAction: 'stable-header-action'
} as const;

const SSR_FALLBACK: Record<(typeof CSS_VAR)[keyof typeof CSS_VAR], string> = {
	'--background': META_THEME_COLOR,
	'--foreground': '#f3f4f6',
	'--primary': '#00e6c3',
	'--positive': '#10b981',
	'--negative': '#f43f5e',
	'--warning': '#f59e0b',
	'--chart-price': '#f3f4f6',
	'--chart-ma': '#00e6c3',
	'--chart-buy': '#10b981',
	'--chart-sell': '#f43f5e',
	'--chart-grid': '#242a3c',
	'--chart-label': '#9ca3af',
	'--chart-marker-stroke': '#ffffff',
	'--chart-range': '#7c3aed',
	'--chart-drawdown-fill': 'rgba(244, 63, 94, 0.05)'
};

let canvasColorParser: CanvasRenderingContext2D | null = null;

function needsCssVarResolution(value: string): boolean {
	return value.startsWith('var(') || value.includes('color-mix');
}

export function cssColor(name: (typeof CSS_VAR)[keyof typeof CSS_VAR]): string {
	const fallback = SSR_FALLBACK[name];
	if (!browser) return fallback;

	const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	if (raw && !needsCssVarResolution(raw)) return raw;

	const probe = document.createElement('span');
	probe.hidden = true;
	probe.style.setProperty('color', `var(${name})`);
	document.documentElement.appendChild(probe);
	const resolved = getComputedStyle(probe).color;
	probe.remove();
	return resolved || fallback;
}

function parseColorToRgb(color: string): [number, number, number] | null {
	const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
	if (rgb) {
		return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
	}

	if (color.startsWith('#')) {
		const hex = color.length === 4 ? color.replace(/(.)/g, '$1$1') : color.slice(1);
		return [
			Number.parseInt(hex.slice(0, 2), 16),
			Number.parseInt(hex.slice(2, 4), 16),
			Number.parseInt(hex.slice(4, 6), 16)
		];
	}

	if (browser) {
		if (!canvasColorParser) {
			const canvas = document.createElement('canvas');
			canvasColorParser = canvas.getContext('2d');
		}
		if (canvasColorParser) {
			canvasColorParser.fillStyle = '#000000';
			canvasColorParser.fillStyle = color;
			const normalized = canvasColorParser.fillStyle;
			const parsed = normalized.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
			if (parsed) return [Number(parsed[1]), Number(parsed[2]), Number(parsed[3])];
		}
	}

	return null;
}

export function withAlpha(color: string, alpha: number): string {
	const rgb = parseColorToRgb(color);
	if (rgb) return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
	return color;
}

export function chartAlphaColor(
	varName: (typeof CSS_VAR)[keyof typeof CSS_VAR],
	alpha: number
): string {
	if (browser) {
		const direct = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
		if (direct.includes('color-mix')) {
			const mixed = withAlpha(cssColor(varName), alpha);
			if (mixed !== cssColor(varName)) return mixed;
		}
		if (direct && !direct.startsWith('var(')) {
			const parsed = withAlpha(direct, alpha);
			if (parsed !== direct) return parsed;
		}
	}
	return withAlpha(cssColor(varName), alpha);
}

export type ChartColors = {
	price: string;
	ma: string;
	buy: string;
	sell: string;
	grid: string;
	label: string;
	markerStroke: string;
	range: string;
	drawdownFill: string;
};

export function getChartColors(): ChartColors {
	return {
		price: cssColor(CSS_VAR.chartPrice),
		ma: cssColor(CSS_VAR.chartMa),
		buy: cssColor(CSS_VAR.chartBuy),
		sell: cssColor(CSS_VAR.chartSell),
		grid: cssColor(CSS_VAR.chartGrid),
		label: cssColor(CSS_VAR.chartLabel),
		markerStroke: cssColor(CSS_VAR.chartMarkerStroke),
		range: cssColor(CSS_VAR.chartRange),
		drawdownFill: cssColor(CSS_VAR.chartDrawdownFill)
	};
}

export function pnlClass(value: number): string {
	return value >= 0 ? TONE_CLASS.positive : TONE_CLASS.negative;
}
