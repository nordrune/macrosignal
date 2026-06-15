import { describe, expect, test } from 'bun:test';
import { parseCsvText, SAMPLE_CSV } from './csv';

describe('parseCsvText', () => {
	test('parses SAMPLE_CSV', () => {
		const rows = parseCsvText(SAMPLE_CSV);
		expect(rows.length).toBeGreaterThan(10);
		expect(rows[0]).toEqual({ date: '2024-01-01', close: 100 });
	});

	test('rejects header only', () => {
		expect(() => parseCsvText('date,close')).toThrow('header and at least one price row');
	});

	test('rejects missing close column', () => {
		expect(() => parseCsvText('date,open\n2024-01-01,100')).toThrow("'date' and 'close'");
	});

	test('accepts case-insensitive headers', () => {
		const rows = parseCsvText('Date,Close\n2024-01-01,100.5');
		expect(rows).toEqual([{ date: '2024-01-01', close: 100.5 }]);
	});

	test('skips invalid rows', () => {
		const rows = parseCsvText('date,close\n2024-01-01,100\nbad-row\n2024-01-02,-1\n2024-01-03,101');
		expect(rows).toEqual([
			{ date: '2024-01-01', close: 100 },
			{ date: '2024-01-03', close: 101 }
		]);
	});

	test('parses CRLF line endings', () => {
		const rows = parseCsvText('date,close\r\n2024-01-01,100\r\n2024-01-02,101');
		expect(rows).toHaveLength(2);
	});

	test('rejects when no valid rows remain', () => {
		expect(() => parseCsvText('date,close\n2024-01-01,0\n2024-01-02,-5')).toThrow(
			'no valid date or close'
		);
	});
});
