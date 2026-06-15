/** Default simulation and dashboard values. */

import type { PricePoint } from '$lib/api';

/** Mirrors trading_backtester/api.py MAX_PRICE_POINTS. */
export const MAX_PRICE_POINTS = 10_000;

export function capPricePoints(prices: PricePoint[]): PricePoint[] {
	return prices.length > MAX_PRICE_POINTS ? prices.slice(-MAX_PRICE_POINTS) : prices;
}

export const DEFAULT_STARTING_CAPITAL = 10_000;
export const DEFAULT_FEE_PERCENT = 0.1;

export const TICKER_SUGGESTIONS = [
	{ label: 'BTC', symbol: 'BTC-USD' },
	{ label: 'ETH', symbol: 'ETH-USD' },
	{ label: 'AAPL', symbol: 'AAPL' },
	{ label: 'TSLA', symbol: 'TSLA' },
	{ label: 'EUR/USD', symbol: 'EURUSD=X' }
] as const;
