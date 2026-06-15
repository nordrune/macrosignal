/** Persist dashboard settings and last run in localStorage (survives refresh). */

import { browser } from '$app/environment';
import type { BacktestResponse, OptimizeRun } from '$lib/api';
import type { SimulationAnalytics } from '$lib/analytics';
import { SAMPLE_CSV } from '$lib/csv';
import { DEFAULT_FEE_PERCENT, DEFAULT_STARTING_CAPITAL } from '$lib/defaults';
import type { RunSnapshot } from '$lib/export';
import { DEFAULT_WINDOW, type StrategyType } from '$lib/strategy';
import type { DataSource, Interval, Period } from '$lib/types';
import { INTERVALS, PERIODS } from '$lib/types';

const STORAGE_KEY = 'macrosignal-dashboard';
const VERSION = 1;

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
	dataSource: 'api',
	ticker: 'BTC-USD',
	period: '1y',
	interval: '1d',
	csvText: SAMPLE_CSV,
	strategy: 'sma',
	windowSize: String(DEFAULT_WINDOW),
	startingCapital: String(DEFAULT_STARTING_CAPITAL),
	feeRate: String(DEFAULT_FEE_PERCENT),
	autoRun: true
};

export type DashboardSettings = {
	dataSource: DataSource;
	ticker: string;
	period: Period;
	interval: Interval;
	csvText: string;
	strategy: StrategyType;
	windowSize: string;
	startingCapital: string;
	feeRate: string;
	autoRun: boolean;
};

export type DashboardPersisted = DashboardSettings & {
	v: typeof VERSION;
	result: BacktestResponse | null;
	runSnapshot: RunSnapshot | null;
	analytics: SimulationAnalytics | null;
	optimizeRuns: OptimizeRun[];
};

function isStrategyType(value: unknown): value is StrategyType {
	return value === 'sma' || value === 'ema';
}

function isPeriod(value: unknown): value is Period {
	return typeof value === 'string' && (PERIODS as readonly string[]).includes(value);
}

function isInterval(value: unknown): value is Interval {
	return typeof value === 'string' && (INTERVALS as readonly string[]).includes(value);
}

function parseSettings(raw: Record<string, unknown>): DashboardSettings | null {
	if (raw.dataSource !== 'api' && raw.dataSource !== 'csv') return null;
	if (typeof raw.ticker !== 'string') return null;
	if (!isPeriod(raw.period)) return null;
	if (!isInterval(raw.interval)) return null;
	if (typeof raw.csvText !== 'string') return null;
	if (!isStrategyType(raw.strategy)) return null;
	if (typeof raw.windowSize !== 'string') return null;
	if (typeof raw.startingCapital !== 'string') return null;
	if (typeof raw.feeRate !== 'string') return null;
	if (typeof raw.autoRun !== 'boolean') return null;

	return {
		dataSource: raw.dataSource,
		ticker: raw.ticker,
		period: raw.period,
		interval: raw.interval,
		csvText: raw.csvText,
		strategy: raw.strategy,
		windowSize: raw.windowSize,
		startingCapital: raw.startingCapital,
		feeRate: raw.feeRate,
		autoRun: raw.autoRun
	};
}

function pickSettings(state: DashboardPersisted): DashboardSettings {
	const {
		dataSource,
		ticker,
		period,
		interval,
		csvText,
		strategy,
		windowSize,
		startingCapital,
		feeRate,
		autoRun
	} = state;
	return {
		dataSource,
		ticker,
		period,
		interval,
		csvText,
		strategy,
		windowSize,
		startingCapital,
		feeRate,
		autoRun
	};
}

export function readDashboardState(): Partial<DashboardPersisted> {
	if (!browser) return {};

	try {
		const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
		if (!raw || typeof raw !== 'object' || raw.v !== VERSION) return {};

		const settings = parseSettings(raw as Record<string, unknown>);
		if (!settings) return {};

		return {
			...settings,
			v: VERSION,
			result: raw.result ?? null,
			runSnapshot: raw.runSnapshot ?? null,
			analytics: raw.analytics ?? null,
			optimizeRuns: Array.isArray(raw.optimizeRuns) ? raw.optimizeRuns : []
		};
	} catch {
		return {};
	}
}

export function writeDashboardState(state: Omit<DashboardPersisted, 'v'>): void {
	if (!browser) return;

	const payload: DashboardPersisted = { v: VERSION, ...state };

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
		return;
	} catch {
		// ponytail: quota exceeded, keep settings only
	}

	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				v: VERSION,
				...pickSettings(payload),
				result: null,
				runSnapshot: null,
				analytics: null,
				optimizeRuns: []
			})
		);
	} catch {
		// ignore
	}
}
