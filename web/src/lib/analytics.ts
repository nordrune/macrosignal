/** Client-side simulation analytics from backtest response. */

import type { BacktestResponse, CapitalPoint, SeriesPoint, Trade } from '$lib/api';

export type PositionAnalytics = {
	entryDate: string;
	exitDate: string;
	entryPrice: number;
	exitPrice: number;
	units: number;
	profit: number;
	roi: number;
	holdDays: number;
	fees: number;
	isOpen: boolean;
};

export type TradeAnalytics = {
	completedPositions: PositionAnalytics[];
	openPositions: PositionAnalytics[];
	bestPosition: PositionAnalytics | null;
	worstPosition: PositionAnalytics | null;
	winningPositions: number;
	losingPositions: number;
	averageProfit: number;
	averageRoi: number;
	averageHoldDays: number;
	longestWinStreak: number;
	longestLossStreak: number;
};

export type FeeAnalytics = {
	totalFees: number;
	averageFee: number;
	feesStartShare: number;
	feesEndShare: number;
};

export type DrawdownAnalytics = {
	deepestDrawdown: number;
	deepestDate: string;
	longestDrawdownDays: number;
	recovered: boolean;
	peakBeforeDeepest: number;
};

export type ActivityAnalytics = {
	firstTrade: Trade | null;
	lastTrade: Trade | null;
	averageTradeGap: number;
	activeMonth: { month: string; count: number } | null;
	testedDays: number;
};

export type SimulationAnalytics = {
	trade: TradeAnalytics;
	fees: FeeAnalytics;
	drawdown: DrawdownAnalytics;
	activity: ActivityAnalytics;
	summary: { positions: number; trades: number; days: number };
};

export type AnalysisCard = {
	label: string;
	value: string;
	detail: string;
	tone: '' | 'positive' | 'negative' | 'warning';
};

function daysBetween(startDate: string, endDate: string): number {
	const start = new Date(startDate);
	const end = new Date(endDate);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
	return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function average(values: number[]): number {
	const valid = values.filter((v) => Number.isFinite(v));
	if (valid.length === 0) return 0;
	return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

function maxBy<T>(items: T[], selector: (item: T) => number): T | null {
	if (items.length === 0) return null;
	return items.reduce((best, item) => (selector(item) > selector(best) ? item : best), items[0]);
}

function minBy<T>(items: T[], selector: (item: T) => number): T | null {
	if (items.length === 0) return null;
	return items.reduce((worst, item) => (selector(item) < selector(worst) ? item : worst), items[0]);
}

function longestStreak<T>(items: T[], predicate: (item: T) => boolean): number {
	let current = 0;
	let best = 0;
	for (const item of items) {
		if (predicate(item)) {
			current += 1;
			best = Math.max(best, current);
		} else {
			current = 0;
		}
	}
	return best;
}

function buildPositionAnalytics(
	entry: Trade,
	exit: { date: string; price: number; fee: number },
	isOpen: boolean
): PositionAnalytics {
	const units = entry.units || 0;
	const totalFees = (entry.fee || 0) + (exit.fee || 0);
	const profit = (exit.price - entry.price) * units - totalFees;
	const cost = entry.price * units;
	return {
		entryDate: entry.date,
		exitDate: exit.date,
		entryPrice: entry.price,
		exitPrice: exit.price,
		units,
		profit,
		roi: cost > 0 ? (profit / cost) * 100 : 0,
		holdDays: daysBetween(entry.date, exit.date),
		fees: totalFees,
		isOpen
	};
}

function calculateTradeAnalytics(trades: Trade[], seriesData: SeriesPoint[]): TradeAnalytics {
	const completedPositions: PositionAnalytics[] = [];
	const openBuys: Trade[] = [];
	const finalPoint = seriesData[seriesData.length - 1] ?? null;

	for (const trade of trades) {
		if (trade.type === 'buy') {
			openBuys.push(trade);
			continue;
		}
		if (trade.type !== 'sell' || openBuys.length === 0) continue;
		const entry = openBuys.shift()!;
		completedPositions.push(
			buildPositionAnalytics(entry, { date: trade.date, price: trade.price, fee: trade.fee }, false)
		);
	}

	const openPositions = openBuys
		.map((entry) => {
			if (!finalPoint) return null;
			return buildPositionAnalytics(
				entry,
				{ date: finalPoint.date, price: finalPoint.close, fee: 0 },
				true
			);
		})
		.filter((p): p is PositionAnalytics => p !== null);

	const winningPositions = completedPositions.filter((p) => p.profit > 0);
	const losingPositions = completedPositions.filter((p) => p.profit < 0);

	return {
		completedPositions,
		openPositions,
		bestPosition: maxBy(completedPositions, (p) => p.profit),
		worstPosition: minBy(completedPositions, (p) => p.profit),
		winningPositions: winningPositions.length,
		losingPositions: losingPositions.length,
		averageProfit: average(completedPositions.map((p) => p.profit)),
		averageRoi: average(completedPositions.map((p) => p.roi)),
		averageHoldDays: average(completedPositions.map((p) => p.holdDays)),
		longestWinStreak: longestStreak(completedPositions, (p) => p.profit > 0),
		longestLossStreak: longestStreak(completedPositions, (p) => p.profit < 0)
	};
}

function calculateFeeAnalytics(trades: Trade[], result: BacktestResponse): FeeAnalytics {
	const totalFees = trades.reduce((sum, trade) => sum + (Number(trade.fee) || 0), 0);
	const averageFee = trades.length > 0 ? totalFees / trades.length : 0;
	const startCapital = result.start_capital || 0;
	const endCapital = result.end_capital || 0;
	return {
		totalFees,
		averageFee,
		feesStartShare: startCapital > 0 ? (totalFees / startCapital) * 100 : 0,
		feesEndShare: endCapital > 0 ? (totalFees / endCapital) * 100 : 0
	};
}

function calculateDrawdownAnalytics(capitalHistory: CapitalPoint[]): DrawdownAnalytics {
	let peakCapital = 0;
	let peakDate = '-';
	let deepestDrawdown = 0;
	let deepestDate = '-';
	let peakBeforeDeepest = 0;
	let longestDrawdownDays = 0;
	let currentDrawdownStart: string | null = null;
	let recovered = true;

	for (const point of capitalHistory) {
		const capital = Number(point.capital) || 0;
		if (capital >= peakCapital) {
			if (currentDrawdownStart) {
				longestDrawdownDays = Math.max(
					longestDrawdownDays,
					daysBetween(currentDrawdownStart, point.date)
				);
			}
			peakCapital = capital;
			peakDate = point.date;
			currentDrawdownStart = null;
			recovered = true;
		} else if (peakCapital > 0) {
			if (!currentDrawdownStart) currentDrawdownStart = peakDate;
			const drawdown = ((capital - peakCapital) / peakCapital) * 100;
			if (drawdown < deepestDrawdown) {
				deepestDrawdown = drawdown;
				deepestDate = point.date;
				peakBeforeDeepest = peakCapital;
			}
			recovered = false;
		}
	}

	if (currentDrawdownStart && capitalHistory.length > 0) {
		const lastDate = capitalHistory[capitalHistory.length - 1].date;
		longestDrawdownDays = Math.max(
			longestDrawdownDays,
			daysBetween(currentDrawdownStart, lastDate)
		);
	}

	return {
		deepestDrawdown,
		deepestDate,
		longestDrawdownDays,
		recovered,
		peakBeforeDeepest
	};
}

function calculateActivityAnalytics(trades: Trade[], seriesData: SeriesPoint[]): ActivityAnalytics {
	const gaps: number[] = [];
	const monthCounts = new Map<string, number>();

	for (let idx = 1; idx < trades.length; idx += 1) {
		gaps.push(daysBetween(trades[idx - 1].date, trades[idx].date));
	}

	for (const trade of trades) {
		const month = String(trade.date).slice(0, 7);
		monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
	}

	let activeMonth: { month: string; count: number } | null = null;
	for (const [month, count] of monthCounts) {
		if (!activeMonth || count > activeMonth.count) activeMonth = { month, count };
	}

	return {
		firstTrade: trades[0] ?? null,
		lastTrade: trades[trades.length - 1] ?? null,
		averageTradeGap: average(gaps),
		activeMonth,
		testedDays: seriesData.length
	};
}

export function calculateSimulationAnalytics(result: BacktestResponse): SimulationAnalytics {
	const trade = calculateTradeAnalytics(result.trades, result.series_data);
	const fees = calculateFeeAnalytics(result.trades, result);
	const drawdown = calculateDrawdownAnalytics(result.capital_history);
	const activity = calculateActivityAnalytics(result.trades, result.series_data);

	return {
		trade,
		fees,
		drawdown,
		activity,
		summary: {
			positions: trade.completedPositions.length,
			trades: result.trades.length,
			days: result.series_data.length
		}
	};
}

export type TradeInspectorDetails = {
	holdDays: number;
	profit: number;
	roi: number;
	fees: number;
};

export function getTradeInspectorDetails(
	trade: Trade,
	nextTrade: Trade | null,
	seriesData: SeriesPoint[]
): TradeInspectorDetails {
	const lastDay = seriesData[seriesData.length - 1];
	const exitDate = nextTrade ? new Date(nextTrade.date) : new Date(lastDay?.date ?? trade.date);
	const entryDate = new Date(trade.date);
	const diffDays =
		Math.ceil(Math.abs(exitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;

	const exitPrice = nextTrade ? nextTrade.price : (lastDay?.close ?? trade.price);
	const exitFee = nextTrade ? nextTrade.fee : 0;
	const totalFees = trade.fee + exitFee;

	let profit = 0;
	let roi = 0;

	if (trade.type === 'buy') {
		profit = (exitPrice - trade.price) * trade.units - totalFees;
		const cost = trade.price * trade.units;
		roi = cost > 0 ? (profit / cost) * 100 : 0;
	} else {
		profit = (trade.price - exitPrice) * trade.units - totalFees;
		const cost = exitPrice * trade.units;
		roi = cost > 0 ? (profit / cost) * 100 : 0;
	}

	return { holdDays: diffDays, profit, roi, fees: totalFees };
}
