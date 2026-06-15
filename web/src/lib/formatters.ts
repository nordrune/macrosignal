/** Shared display formatting helpers. */

export function formatCurrency(value: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD'
	}).format(value);
}

export function hasNumber(value: unknown): boolean {
	return value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function signedCurrency(value: number): string {
	const prefix = value > 0 ? '+' : '';
	return `${prefix}${formatCurrency(value)}`;
}

export function signedPercent(value: number): string {
	const prefix = value > 0 ? '+' : '';
	return `${prefix}${value.toFixed(2)}%`;
}

export function pnlClass(value: number): string {
	return value >= 0 ? 'text-emerald-400' : 'text-rose-400';
}

export function formatKeyValueParams(params: Record<string, number>): string {
	return (
		Object.entries(params)
			.map(([key, value]) => `${key}: ${value}`)
			.join(', ') || '-'
	);
}
