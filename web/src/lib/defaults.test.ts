import { describe, expect, test } from 'bun:test';
import { capPricePoints, MAX_PRICE_POINTS } from './defaults';

describe('capPricePoints', () => {
	test('returns input when under cap', () => {
		const prices = [{ date: '2024-01-01', close: 1 }];
		expect(capPricePoints(prices)).toBe(prices);
	});

	test('keeps most recent rows when over cap', () => {
		const prices = Array.from({ length: MAX_PRICE_POINTS + 2 }, (_, i) => ({
			date: `2024-01-${String(i + 1).padStart(2, '0')}`,
			close: i
		}));
		const capped = capPricePoints(prices);
		expect(capped).toHaveLength(MAX_PRICE_POINTS);
		expect(capped[0]?.close).toBe(2);
		expect(capped.at(-1)?.close).toBe(MAX_PRICE_POINTS + 1);
	});
});
