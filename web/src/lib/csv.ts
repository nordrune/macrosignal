/** CSV helpers — backend validates; this catches obvious issues early. */

export type PricePoint = { date: string; close: number };

export const SAMPLE_CSV = `date,close
2024-01-01,100.00
2024-01-02,101.00
2024-01-03,102.00
2024-01-04,103.00
2024-01-05,104.00
2024-01-08,105.00
2024-01-09,106.00
2024-01-10,107.00
2024-01-11,108.00
2024-01-12,109.00
2024-01-15,110.00
2024-01-16,111.00
2024-01-17,112.00
2024-01-18,113.00
2024-01-19,114.00
2024-01-22,115.00
2024-01-23,116.00
2024-01-24,117.00
2024-01-25,118.00
2024-01-26,119.00
2024-01-29,121.00
2024-01-30,123.00
2024-01-31,125.00
2024-02-01,127.00
2024-02-02,129.00
2024-02-05,128.00
2024-02-06,126.00
2024-02-07,124.00
2024-02-08,121.00
2024-02-09,118.00
2024-02-12,115.00
2024-02-13,112.00
2024-02-14,109.00
2024-02-15,106.00
2024-02-16,103.00`;

export function parseCsvText(text: string): PricePoint[] {
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length < 2) {
		throw new Error('CSV must include a header and at least one price row.');
	}

	const headers = lines[0].split(',').map((header) => header.trim().toLowerCase());
	const dateIndex = headers.indexOf('date');
	const closeIndex = headers.indexOf('close');

	if (dateIndex === -1 || closeIndex === -1) {
		throw new Error("CSV file must contain 'date' and 'close' columns.");
	}

	const pricePoints: PricePoint[] = [];
	for (let i = 1; i < lines.length; i++) {
		const columns = lines[i].split(',').map((column) => column.trim());
		if (columns.length <= Math.max(dateIndex, closeIndex)) continue;

		const date = columns[dateIndex];
		const close = parseFloat(columns[closeIndex]);

		if (date && Number.isFinite(close) && close > 0) {
			pricePoints.push({ date, close });
		}
	}

	if (pricePoints.length === 0) {
		throw new Error('CSV has no valid date or close values.');
	}

	return pricePoints;
}
