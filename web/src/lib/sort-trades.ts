import type { Trade } from '$lib/api';

export type TradeSortKey = 'date' | 'type' | 'price' | 'units' | 'fee' | 'cashBalance';
export type SortDir = 'asc' | 'desc';

export type IndexedTrade = { trade: Trade; index: number };

export function sortTrades(trades: Trade[], key: TradeSortKey, dir: SortDir): IndexedTrade[] {
	const mult = dir === 'asc' ? 1 : -1;
	return trades
		.map((trade, index) => ({ trade, index }))
		.toSorted((a, b) => {
			const left = a.trade[key];
			const right = b.trade[key];
			if (typeof left === 'number' && typeof right === 'number') {
				return mult * (left - right);
			}
			return mult * String(left).localeCompare(String(right));
		});
}

export function nextTradeSort(
	key: TradeSortKey,
	currentKey: TradeSortKey,
	currentDir: SortDir
): SortDir {
	return currentKey === key && currentDir === 'asc' ? 'desc' : 'asc';
}
