/** Client-side Yahoo price cache — one fetch per symbol/period/interval, reused for backtests. */

import { getTicker, type PricePoint } from '$lib/api';
import type { Interval, Period } from '$lib/types';

const TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
	prices: PricePoint[];
	fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<PricePoint[]>>();

export function tickerCacheKey(symbol: string, period: Period, interval: Interval): string {
	return `${symbol.trim().toUpperCase()}|${period}|${interval}`;
}

export function clearTickerPriceCache(): void {
	cache.clear();
	inflight.clear();
}

export async function getTickerPrices(
	symbol: string,
	period: Period,
	interval: Interval
): Promise<PricePoint[]> {
	const normalized = symbol.trim().toUpperCase();
	if (normalized.length < 2) {
		throw new Error('Ticker symbol too short');
	}

	const key = tickerCacheKey(normalized, period, interval);
	const hit = cache.get(key);
	if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
		return hit.prices;
	}

	let pending = inflight.get(key);
	if (!pending) {
		pending = getTicker(normalized, period, interval).then((response) => {
			const prices = response.prices;
			cache.set(key, { prices, fetchedAt: Date.now() });
			inflight.delete(key);
			return prices;
		});
		inflight.set(key, pending);
	}

	return pending;
}
