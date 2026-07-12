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
	portfolioId: null,
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
	portfolioId: string | null;
	period: Period;
	interval: Interval;
	csvText: string;
	strategy: StrategyType;
	windowSize: string;
	startingCapital: string;
	feeRate: string;
	autoRun: boolean;
};

export type PortfolioAsset = {
	symbol: string;
	label: string;
	weight: string;
};

export type Portfolio = {
	id: string;
	name: string;
	assets: PortfolioAsset[];
};

export type SimulationPersisted = DashboardSettings & {
	name?: string;
	result: BacktestResponse | null;
	runSnapshot: RunSnapshot | null;
	analytics: SimulationAnalytics | null;
	optimizeRuns: OptimizeRun[];
};

export type StrategyComparisonItem = {
	enabled: boolean;
	windowSize: string;
};

export type StrategyComparisonResult = {
	strategy: StrategyType;
	windowSize: string;
	result: BacktestResponse;
};

export type StrategyComparison = {
	id: string;
	name: string;
	dataSource: DataSource;
	ticker: string;
	portfolioId: string | null;
	period: Period;
	interval: Interval;
	csvText: string;
	startingCapital: string;
	feeRate: string;
	strategies: Record<StrategyType, StrategyComparisonItem>;
	results: StrategyComparisonResult[];
};

export type DashboardPersisted = SimulationPersisted & {
	v: typeof VERSION;
	simulations: SimulationPersisted[];
	activeSimulationIndex: number;
	portfolios: Portfolio[];
	activePortfolioIndex: number;
	strategyComparisons: StrategyComparison[];
	activeStrategyComparisonIndex: number;
};

function isStrategyType(value: unknown): value is StrategyType {
	return (
		value === 'sma' ||
		value === 'ema' ||
		value === 'rsi' ||
		value === 'macd' ||
		value === 'bollinger' ||
		value === 'crossover'
	);
}

function isPeriod(value: unknown): value is Period {
	return typeof value === 'string' && (PERIODS as readonly string[]).includes(value);
}

function isInterval(value: unknown): value is Interval {
	return typeof value === 'string' && (INTERVALS as readonly string[]).includes(value);
}

function parseSettings(raw: Record<string, unknown>): DashboardSettings | null {
	if (raw.dataSource !== 'api' && raw.dataSource !== 'portfolio' && raw.dataSource !== 'csv') {
		return null;
	}
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
		portfolioId: typeof raw.portfolioId === 'string' ? raw.portfolioId : null,
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

function parseSimulation(raw: Record<string, unknown>): SimulationPersisted | null {
	const settings = parseSettings(raw);
	if (!settings) return null;
	return {
		...settings,
		name: typeof raw.name === 'string' ? raw.name : undefined,
		result: raw.result ?? null,
		runSnapshot: raw.runSnapshot ?? null,
		analytics: raw.analytics ?? null,
		optimizeRuns: Array.isArray(raw.optimizeRuns) ? raw.optimizeRuns : []
	} as SimulationPersisted;
}

function defaultComparisonStrategies(): Record<StrategyType, StrategyComparisonItem> {
	return {
		sma: { enabled: true, windowSize: '20' },
		ema: { enabled: true, windowSize: '20' },
		rsi: { enabled: true, windowSize: '14' },
		macd: { enabled: false, windowSize: '12' },
		bollinger: { enabled: false, windowSize: '20' },
		crossover: { enabled: false, windowSize: '20' }
	};
}

function parseComparisonStrategies(raw: unknown): Record<StrategyType, StrategyComparisonItem> {
	const fallback = defaultComparisonStrategies();
	if (!raw || typeof raw !== 'object') return fallback;
	const record = raw as Record<string, unknown>;
	return Object.fromEntries(
		Object.entries(fallback).map(([strategy, defaults]) => {
			const item = record[strategy];
			if (!item || typeof item !== 'object') return [strategy, defaults];
			const row = item as Record<string, unknown>;
			return [
				strategy,
				{
					enabled: typeof row.enabled === 'boolean' ? row.enabled : defaults.enabled,
					windowSize: typeof row.windowSize === 'string' ? row.windowSize : defaults.windowSize
				}
			];
		})
	) as Record<StrategyType, StrategyComparisonItem>;
}

function parseStrategyComparisons(raw: unknown): StrategyComparison[] {
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((item) => {
		if (!item || typeof item !== 'object') return [];
		const record = item as Record<string, unknown>;
		const settings = parseSettings({
			dataSource: record.dataSource,
			ticker: record.ticker,
			portfolioId: record.portfolioId,
			period: record.period,
			interval: record.interval,
			csvText: record.csvText,
			strategy: 'sma',
			windowSize: '20',
			startingCapital: record.startingCapital,
			feeRate: record.feeRate,
			autoRun: false
		});
		if (!settings || typeof record.id !== 'string' || typeof record.name !== 'string') return [];
		return [
			{
				id: record.id,
				name: record.name,
				dataSource: settings.dataSource,
				ticker: settings.ticker,
				portfolioId: settings.portfolioId,
				period: settings.period,
				interval: settings.interval,
				csvText: settings.csvText,
				startingCapital: settings.startingCapital,
				feeRate: settings.feeRate,
				strategies: parseComparisonStrategies(record.strategies),
				results: Array.isArray(record.results) ? (record.results as StrategyComparisonResult[]) : []
			}
		];
	});
}

function parsePortfolios(raw: unknown): Portfolio[] {
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((item) => {
		if (!item || typeof item !== 'object') return [];
		const portfolio = item as Record<string, unknown>;
		if (typeof portfolio.id !== 'string' || typeof portfolio.name !== 'string') return [];
		if (!Array.isArray(portfolio.assets)) return [];
		const assets = portfolio.assets.flatMap((asset) => {
			if (!asset || typeof asset !== 'object') return [];
			const row = asset as Record<string, unknown>;
			if (typeof row.symbol !== 'string') return [];
			return [
				{
					symbol: row.symbol,
					label: typeof row.label === 'string' ? row.label : row.symbol,
					weight: typeof row.weight === 'string' ? row.weight : String(row.weight ?? '')
				}
			];
		});
		return [{ id: portfolio.id, name: portfolio.name, assets }];
	});
}

function pickSettings(state: SimulationPersisted): DashboardSettings {
	const {
		dataSource,
		ticker,
		portfolioId,
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
		portfolioId,
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

		const rawRecord = raw as Record<string, unknown>;
		const settings = parseSettings(rawRecord);
		if (!settings) return {};
		const currentSimulation: SimulationPersisted = {
			...settings,
			result: raw.result ?? null,
			runSnapshot: raw.runSnapshot ?? null,
			analytics: raw.analytics ?? null,
			optimizeRuns: Array.isArray(raw.optimizeRuns) ? raw.optimizeRuns : []
		};
		const simulations = Array.isArray(raw.simulations)
			? raw.simulations.flatMap((simulation: unknown) => {
					if (!simulation || typeof simulation !== 'object') return [];
					const parsed = parseSimulation(simulation as Record<string, unknown>);
					return parsed ? [parsed] : [];
				})
			: [];
		const activeSimulationIndex =
			typeof raw.activeSimulationIndex === 'number' &&
			raw.activeSimulationIndex >= 0 &&
			raw.activeSimulationIndex < Math.max(simulations.length, 1)
				? raw.activeSimulationIndex
				: 0;
		const portfolios = parsePortfolios(raw.portfolios);
		const strategyComparisons = parseStrategyComparisons(raw.strategyComparisons);

		return {
			...currentSimulation,
			v: VERSION,
			simulations: simulations.length ? simulations : [currentSimulation],
			activeSimulationIndex,
			portfolios,
			activePortfolioIndex:
				typeof raw.activePortfolioIndex === 'number' &&
				raw.activePortfolioIndex >= 0 &&
				raw.activePortfolioIndex < Math.max(portfolios.length, 1)
					? raw.activePortfolioIndex
					: 0,
			strategyComparisons,
			activeStrategyComparisonIndex:
				typeof raw.activeStrategyComparisonIndex === 'number' &&
				raw.activeStrategyComparisonIndex >= 0 &&
				raw.activeStrategyComparisonIndex < Math.max(strategyComparisons.length, 1)
					? raw.activeStrategyComparisonIndex
					: 0
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
				optimizeRuns: [],
				simulations: payload.simulations.map((simulation) => ({
					...pickSettings(simulation),
					result: null,
					runSnapshot: null,
					analytics: null,
					optimizeRuns: []
				})),
				activeSimulationIndex: payload.activeSimulationIndex,
				portfolios: payload.portfolios,
				activePortfolioIndex: payload.activePortfolioIndex,
				strategyComparisons: payload.strategyComparisons.map((comparison) => ({
					...comparison,
					results: []
				})),
				activeStrategyComparisonIndex: payload.activeStrategyComparisonIndex
			})
		);
	} catch {
		// ignore
	}
}
