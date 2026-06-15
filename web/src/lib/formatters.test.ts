import { describe, expect, test } from 'bun:test';
import {
	formatKeyValueParams,
	hasNumber,
	signedCurrency,
	signedPercent,
	valueTone
} from './formatters';

describe('formatters', () => {
	test('signedCurrency adds plus only for positive values', () => {
		expect(signedCurrency(10)).toMatch(/^\+\$/);
		expect(signedCurrency(-10)).toMatch(/^-\$/);
		expect(signedCurrency(0)).toMatch(/^\$/);
	});

	test('signedPercent adds plus only for positive values', () => {
		expect(signedPercent(1.5)).toBe('+1.50%');
		expect(signedPercent(-2)).toBe('-2.00%');
	});

	test('hasNumber rejects nullish and NaN', () => {
		expect(hasNumber(1)).toBe(true);
		expect(hasNumber(null)).toBe(false);
		expect(hasNumber(undefined)).toBe(false);
		expect(hasNumber(Number.NaN)).toBe(false);
	});

	test('valueTone maps sign', () => {
		expect(valueTone(1)).toBe('positive');
		expect(valueTone(-1)).toBe('negative');
		expect(valueTone(0)).toBe('');
	});

	test('formatKeyValueParams formats entries', () => {
		expect(formatKeyValueParams({ window: 20 })).toBe('window: 20');
		expect(formatKeyValueParams({})).toBe('-');
	});
});
