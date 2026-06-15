export type DataSource = 'api' | 'csv';

export type Period = '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | 'max';

export type Interval = '1h' | '1d' | '1wk';

export type StatusType = 'info' | 'success' | 'error';

export const PERIODS = [
	'1mo',
	'3mo',
	'6mo',
	'1y',
	'2y',
	'5y',
	'max'
] as const satisfies readonly Period[];

export const INTERVALS = ['1h', '1d', '1wk'] as const satisfies readonly Interval[];
