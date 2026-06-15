/** Typed fetch client for MacroSignal API routes. */

import type { PricePoint } from '$lib/csv';

export type { PricePoint };

export type PriceSourceRequest = {
	prices?: PricePoint[] | null;
	symbol?: string | null;
	period?: string;
	interval?: string;
};

export type BacktestRequest = PriceSourceRequest & {
	starting_capital?: number;
	transaction_fee_percent?: number;
	strategy_type?: string;
	strategy_params?: Record<string, unknown>;
};

export type SeriesPoint = {
	date: string;
	close: number;
	signal: 'buy' | 'sell' | 'hold';
	moving_average: number | null;
	[key: string]: string | number | null;
};

export type CapitalPoint = { date: string; capital: number };

export type Trade = {
	date: string;
	type: 'buy' | 'sell';
	price: number;
	units: number;
	fee: number;
	cashBalance: number;
};

export type BacktestResponse = {
	start_capital: number;
	end_capital: number;
	profit_loss: number;
	profit_loss_percent: number;
	buy_trades: number;
	sell_trades: number;
	final_status: string;
	sharpe_ratio: number;
	max_drawdown: number;
	win_rate: number;
	buy_and_hold_return: number;
	capital_history: CapitalPoint[];
	series_data: SeriesPoint[];
	trades: Trade[];
};

export type TickerResponse = {
	symbol: string;
	prices: PricePoint[];
};

export type OptimizeRequest = PriceSourceRequest & {
	starting_capital?: number;
	transaction_fee_percent?: number;
	strategy_type?: string;
};

export type OptimizeRun = {
	params: Record<string, number>;
	end_capital: number;
	profit_loss: number;
	profit_loss_percent: number;
	sharpe_ratio: number;
	max_drawdown: number;
	win_rate: number;
	total_trades: number;
};

export type OptimizeResponse = {
	strategy_type: string;
	runs: OptimizeRun[];
};

type ApiError = { detail?: string };

// ponytail: one fetch helper instead of per-route error handling
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, init);
	if (!response.ok) {
		const err = (await response.json().catch(() => ({}))) as ApiError;
		throw new Error(err.detail ?? `Request failed: ${response.status}`);
	}
	return response.json() as Promise<T>;
}

export function getTicker(symbol: string, period = '1y', interval = '1d'): Promise<TickerResponse> {
	const params = new URLSearchParams({ symbol, period, interval });
	return apiFetch(`/api/ticker?${params}`);
}

export function postBacktest(body: BacktestRequest): Promise<BacktestResponse> {
	return apiFetch('/api/backtest', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

export function postOptimize(body: OptimizeRequest): Promise<OptimizeResponse> {
	return apiFetch('/api/optimize', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}
