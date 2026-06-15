import { describe, expect, test } from 'bun:test';
import type { BacktestResponse } from './api';
import { calculateSimulationAnalytics, getTradeInspectorDetails } from './analytics';

const fixture: BacktestResponse = {
	start_capital: 10_000,
	end_capital: 10_150,
	profit_loss: 150,
	profit_loss_percent: 1.5,
	buy_trades: 1,
	sell_trades: 1,
	final_status: 'holding cash',
	sharpe_ratio: 1.2,
	max_drawdown: 2.5,
	win_rate: 100,
	buy_and_hold_return: 2,
	capital_history: [
		{ date: '2024-01-01', capital: 10_000 },
		{ date: '2024-01-02', capital: 9_900 },
		{ date: '2024-01-03', capital: 10_150 }
	],
	series_data: [
		{ date: '2024-01-01', close: 100, signal: 'hold', moving_average: null },
		{ date: '2024-01-02', close: 99, signal: 'buy', moving_average: 99.5 },
		{ date: '2024-01-03', close: 101, signal: 'sell', moving_average: 100 }
	],
	trades: [
		{
			date: '2024-01-02',
			type: 'buy',
			price: 99,
			units: 10,
			fee: 1,
			cashBalance: 9_010
		},
		{
			date: '2024-01-03',
			type: 'sell',
			price: 101,
			units: 10,
			fee: 1,
			cashBalance: 10_150
		}
	]
};

describe('calculateSimulationAnalytics', () => {
	test('pairs buy and sell into one completed position', () => {
		const analytics = calculateSimulationAnalytics(fixture);
		expect(analytics.trade.completedPositions).toHaveLength(1);
		expect(analytics.trade.winningPositions).toBe(1);
		expect(analytics.trade.losingPositions).toBe(0);
		expect(analytics.summary.positions).toBe(1);
		expect(analytics.summary.trades).toBe(2);
	});

	test('sums fees and computes drawdown', () => {
		const analytics = calculateSimulationAnalytics(fixture);
		expect(analytics.fees.totalFees).toBe(2);
		expect(analytics.drawdown.deepestDrawdown).toBeLessThan(0);
		expect(analytics.drawdown.deepestDate).toBe('2024-01-02');
	});
});

describe('getTradeInspectorDetails', () => {
	test('computes buy profit against next sell', () => {
		const buy = fixture.trades[0];
		const sell = fixture.trades[1];
		const details = getTradeInspectorDetails(buy, sell, fixture.series_data);
		expect(details.profit).toBeCloseTo(18, 5);
		expect(details.fees).toBe(2);
		expect(details.holdDays).toBeGreaterThan(0);
	});
});
