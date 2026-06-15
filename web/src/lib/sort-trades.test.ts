import { describe, expect, test } from 'bun:test';
import type { Trade } from './api';
import { nextTradeSort, sortTrades } from './sort-trades';

const trades: Trade[] = [
	{
		date: '2024-01-03',
		type: 'sell',
		price: 101,
		units: 1,
		fee: 0.1,
		cashBalance: 100
	},
	{
		date: '2024-01-01',
		type: 'buy',
		price: 99,
		units: 2,
		fee: 0.2,
		cashBalance: 50
	}
];

describe('sortTrades', () => {
	test('sorts by date ascending', () => {
		const sorted = sortTrades(trades, 'date', 'asc');
		expect(sorted.map((row) => row.trade.date)).toEqual(['2024-01-01', '2024-01-03']);
		expect(sorted.map((row) => row.index)).toEqual([1, 0]);
	});

	test('sorts by price descending', () => {
		const sorted = sortTrades(trades, 'price', 'desc');
		expect(sorted.map((row) => row.trade.price)).toEqual([101, 99]);
	});
});

describe('nextTradeSort', () => {
	test('toggles direction on same column', () => {
		expect(nextTradeSort('date', 'date', 'asc')).toBe('desc');
		expect(nextTradeSort('date', 'date', 'desc')).toBe('asc');
	});

	test('defaults to ascending on new column', () => {
		expect(nextTradeSort('price', 'date', 'desc')).toBe('asc');
	});
});
