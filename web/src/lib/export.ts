/** CSV, Excel, and PDF export from backtest run snapshot. */

import type { BacktestResponse } from '$lib/api';
import { formatCurrency, formatKeyValueParams } from '$lib/formatters';
import type { I18nContext } from '$lib/i18n';

export type RunSnapshot = {
	dataSource: string;
	asset: string;
	period: string;
	interval: string;
	strategy: string;
	strategyParams: Record<string, number>;
	startingCapital: number;
	feePercent: number;
	dateStart: string;
	dateEnd: string;
	dataPoints: number;
};

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export const EXPORT_FORMATS: ExportFormat[] = ['csv', 'excel', 'pdf'];

function csvCell(value: unknown): string {
	const text = String(value ?? '');
	return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: unknown[][]): string {
	return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function getTradeHeaderRow(i18n: I18nContext): string[] {
	return [
		i18n.t('table.date'),
		i18n.t('table.action'),
		i18n.t('table.price'),
		i18n.t('table.units'),
		i18n.t('table.fee'),
		i18n.t('table.cash')
	];
}

function getExportRows(result: BacktestResponse, snapshot: RunSnapshot, i18n: I18nContext) {
	const params = formatKeyValueParams(snapshot.strategyParams);

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

function escapeHtml(value: unknown): string {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function escapeXml(value: unknown): string {
	return escapeHtml(value).replaceAll("'", '&apos;');
}

function excelRow(row: unknown[]): string {
	return `<Row>${row
		.map(
			(cell) =>
				`<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${escapeXml(cell)}</Data></Cell>`
		)
		.join('')}</Row>`;
}

function excelWorksheet(name: string, rows: unknown[][]): string {
	return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${rows.map(excelRow).join('')}</Table></Worksheet>`;
}

function htmlTable(rows: unknown[][], hasHeader = false): string {
	return `<table>${rows
		.map((row, index) => {
			const tag = hasHeader && index === 0 ? 'th' : 'td';
			return `<tr>${row.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('')}</tr>`;
		})
		.join('')}</table>`;
}

function buildPrintReport(
	i18n: I18nContext,
	parameterRows: unknown[][],
	tradeRows: unknown[][]
): string {
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(i18n.t('export.reportTitle'))}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 28px; }
    h1 { margin: 0 0 20px; }
    h2 { margin: 0 0 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    th { background: #f3f4f6; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  </style>
</head>
<body>
  <section class="page">
    <h1>${escapeHtml(i18n.t('export.reportTitle'))}</h1>
    <h2>${escapeHtml(i18n.t('export.parametersTitle'))}</h2>
    ${htmlTable(parameterRows)}
  </section>
  <section class="page">
    <h2>${escapeHtml(i18n.t('export.tradesTitle'))}</h2>
    ${htmlTable([getTradeHeaderRow(i18n), ...tradeRows], true)}
  </section>
</body>
</html>`;
}

export function exportRun(
	result: BacktestResponse,
	snapshot: RunSnapshot,
	format: ExportFormat,
	i18n: I18nContext
): void {
	const { parameterRows, tradeRows } = getExportRows(result, snapshot, i18n);

	if (format === 'csv') {
		const rows = [
			[i18n.t('export.parametersTitle')],
			...parameterRows,
			[],
			[i18n.t('export.tradesTitle')],
			getTradeHeaderRow(i18n),
			...tradeRows
		];
		downloadBlob(toCsv(rows), 'macrosignal-export.csv', 'text/csv;charset=utf-8');
		return;
	}

	if (format === 'excel') {
		const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${excelWorksheet(i18n.t('export.parametersTitle'), parameterRows)}
  ${excelWorksheet(i18n.t('export.tradesTitle'), [getTradeHeaderRow(i18n), ...tradeRows])}
</Workbook>`;
		downloadBlob(workbook, 'macrosignal-export.xls', 'application/vnd.ms-excel;charset=utf-8');
		return;
	}

	const reportWindow = window.open('', '_blank');
	if (!reportWindow) throw new Error(i18n.t('error.backtest'));
	reportWindow.document.write(buildPrintReport(i18n, parameterRows, tradeRows));
	reportWindow.document.close();
	reportWindow.focus();
	reportWindow.print();
}
