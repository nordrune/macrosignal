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
