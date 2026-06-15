/** CSV export from backtest run snapshot — PDF/Excel skipped for ponytail MVP. */

import type { BacktestResponse } from '$lib/api';
import { formatCurrency } from '$lib/formatters';
import { getI18n } from '$lib/i18n';

export type RunSnapshot = {
	dataSource: string;
	asset: string;
	period: string;
	interval: string;
	strategy: string;
	strategyType: string;
	strategyParams: Record<string, number>;
	startingCapital: number;
	feePercent: number;
	dateStart: string;
	dateEnd: string;
	dataPoints: number;
};

function csvCell(value: unknown): string {
	const text = String(value ?? '');
	return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: unknown[][]): string {
	return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function getTradeHeaderRow(): string[] {
	const i18n = getI18n();
	return [
		i18n.t('table.date'),
		i18n.t('table.action'),
		i18n.t('table.price'),
		i18n.t('table.units'),
		i18n.t('table.fee'),
		i18n.t('table.cash')
	];
}

// ponytail: CSV only — Excel/PDF parity deferred
export function getExportRows(result: BacktestResponse, snapshot: RunSnapshot) {
	const i18n = getI18n();
	const params =
		Object.entries(snapshot.strategyParams)
			.map(([key, value]) => `${key}: ${value}`)
			.join(', ') || '-';

	const parameterRows: unknown[][] = [
		[i18n.t('export.generatedAt'), new Date().toLocaleString()],
		[i18n.t('export.asset'), snapshot.asset],
		[i18n.t('export.dataSource'), snapshot.dataSource],
		[i18n.t('export.timeRange'), snapshot.period],
		[i18n.t('export.interval'), snapshot.interval],
		[i18n.t('export.dateRange'), `${snapshot.dateStart} - ${snapshot.dateEnd}`],
		[i18n.t('export.strategy'), snapshot.strategy],
		[i18n.t('export.strategyParams'), params],
		[i18n.t('export.startingCapital'), formatCurrency(snapshot.startingCapital)],
		[i18n.t('export.fee'), `${snapshot.feePercent}%`],
		[i18n.t('export.dataPoints'), snapshot.dataPoints],
		[i18n.t('export.finalCapital'), formatCurrency(result.end_capital)],
		[i18n.t('export.profitLoss'), formatCurrency(result.profit_loss)],
		[i18n.t('export.strategyReturn'), `${result.profit_loss_percent.toFixed(2)}%`]
	];

	const tradeRows = result.trades.map((trade) => [
		trade.date,
		trade.type === 'buy' ? i18n.t('trade.buy') : i18n.t('trade.sell'),
		trade.price,
		trade.units,
		trade.fee,
		trade.cashBalance
	]);

	return { parameterRows, tradeRows };
}

export function exportCsv(result: BacktestResponse, snapshot: RunSnapshot): void {
	const i18n = getI18n();
	const { parameterRows, tradeRows } = getExportRows(result, snapshot);
	const rows = [
		[i18n.t('export.parametersTitle')],
		...parameterRows,
		[],
		[i18n.t('export.tradesTitle')],
		getTradeHeaderRow(),
		...tradeRows
	];
	downloadBlob(toCsv(rows), 'macrosignal-export.csv', 'text/csv;charset=utf-8');
}

function downloadBlob(content: string, filename: string, type: string): void {
	const blob = new Blob([content], { type });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}
