<script lang="ts">
	import AnalysisPanel from '$lib/components/AnalysisPanel.svelte';
	import ExportMenu from '$lib/components/ExportMenu.svelte';
	import IntervalSelect from '$lib/components/IntervalSelect.svelte';
	import ResultsSkeleton from '$lib/components/ResultsSkeleton.svelte';
	import TableSkeleton from '$lib/components/TableSkeleton.svelte';
	import PeriodSelect from '$lib/components/PeriodSelect.svelte';
	import PriceChart from '$lib/components/PriceChart.svelte';
	import RefreshOverlay from '$lib/components/RefreshOverlay.svelte';
	import StrategyComparisonChart from '$lib/components/StrategyComparisonChart.svelte';
	import StrategySelect from '$lib/components/StrategySelect.svelte';
	import TradeInspector from '$lib/components/TradeInspector.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Table from '$lib/components/ui/table';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		postBacktest,
		postOptimize,
		type BacktestRequest,
		type BacktestResponse,
		type OptimizeRun
	} from '$lib/api';
	import { calculateSimulationAnalytics, type SimulationAnalytics } from '$lib/analytics';
	import {
		DEFAULT_DASHBOARD_SETTINGS,
		readDashboardState,
		writeDashboardState,
		type Portfolio,
		type PortfolioAsset,
		type SimulationPersisted,
		type StrategyComparison,
		type StrategyComparisonResult
	} from '$lib/dashboard-state';
	import {
		ASSET_OPTIONS,
		type AssetOption,
		capPricePoints,
		DEFAULT_FEE_PERCENT,
		DEFAULT_STARTING_CAPITAL,
		MAX_TRADE_TABLE_ROWS
	} from '$lib/defaults';
	import { SAMPLE_CSV, parseCsvText } from '$lib/csv';
	import type { RunSnapshot } from '$lib/export';
	import {
		formatCurrency,
		formatKeyValueParams,
		hasNumber,
		signedCurrency,
		signedPercent
	} from '$lib/formatters';
	import {
		pnlClass,
		SIGNAL_CLASS,
		SIGNAL_DOT_CLASS,
		STABLE_CLASS,
		SURFACE_CLASS,
		TONE_CLASS
	} from '$lib/theme';
	import { getI18n } from '$lib/i18n';
	import type { Lang, StringKey } from '$lib/i18n/strings';
	import { nextTradeSort, sortTrades, type SortDir, type TradeSortKey } from '$lib/sort-trades';
	import { clearTickerPriceCache, getTickerPrices } from '$lib/price-cache';
	import {
		DEFAULT_WINDOW,
		formatStrategyParamSummary,
		getDefaultStrategyParamValues,
		getLegendConfig,
		getStrategyParamDefinitions,
		getStrategyParams,
		normalizeStrategyParamValues,
		primaryStrategyWindow,
		type StrategyType
	} from '$lib/strategy';
	import type { DataSource, Interval, Period, StatusType } from '$lib/types';
	import { REPO_URL } from '$lib/site';
	import { cn } from '$lib/utils';
	import { onMount } from 'svelte';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';

	const TRADE_COLUMNS: { key: TradeSortKey; label: StringKey }[] = [
		{ key: 'date', label: 'table.date' },
		{ key: 'type', label: 'table.action' },
		{ key: 'price', label: 'table.price' },
		{ key: 'units', label: 'table.units' },
		{ key: 'fee', label: 'table.fee' },
		{ key: 'cashBalance', label: 'table.cash' }
	];
	const STRATEGIES: StrategyType[] = ['sma', 'ema', 'rsi', 'macd', 'bollinger', 'crossover'];

	const i18n = getI18n();
	const saved = readDashboardState();
	const initialSimulations = saved.simulations?.length
		? saved.simulations
		: [createSimulationFromSettings(saved)];
	const initialSimulationIndex = Math.min(
		Math.max(saved.activeSimulationIndex ?? 0, 0),
		initialSimulations.length - 1
	);
	const initialSimulation = initialSimulations[initialSimulationIndex] ?? initialSimulations[0];

	let simulations = $state.raw<SimulationPersisted[]>(initialSimulations);
	let activeSimulationIndex = $state(initialSimulationIndex);
	let dataSource = $state<DataSource>(initialSimulation.dataSource);
	let ticker = $state(initialSimulation.ticker);
	let portfolioId = $state<string | null>(initialSimulation.portfolioId);
	let assetSearch = $state(assetSearchLabel(initialSimulation.ticker));
	let assetDropdownOpen = $state(false);
	let portfolioAssetSearch = $state<Record<number, string>>({});
	let openPortfolioAssetIndex = $state<number | null>(null);
	let period = $state<Period>(initialSimulation.period);
	let interval = $state<Interval>(initialSimulation.interval);
	let csvText = $state(initialSimulation.csvText);
	let strategy = $state<StrategyType>(initialSimulation.strategy);
	let windowSize = $state(initialSimulation.windowSize);
	let startingCapital = $state(initialSimulation.startingCapital);
	let feeRate = $state(initialSimulation.feeRate);
	let autoRun = $state(initialSimulation.autoRun);
	let csvDropActive = $state(false);
	let portfolioModalOpen = $state(false);
	let portfolios = $state.raw<Portfolio[]>(saved.portfolios ?? []);
	let activePortfolioIndex = $state(saved.activePortfolioIndex ?? 0);
	let comparisonModalOpen = $state(false);
	let strategyComparisons = $state.raw<StrategyComparison[]>(saved.strategyComparisons ?? []);
	let activeStrategyComparisonIndex = $state(saved.activeStrategyComparisonIndex ?? 0);
	let isComparing = $state(false);

	let isRunning = $state(false);
	let isOptimizing = $state(false);
	let statusMessage = $state('');
	let statusType = $state<StatusType>('info');

	let result = $state.raw<BacktestResponse | null>(initialSimulation.result);
	let runSnapshot = $state<RunSnapshot | null>(initialSimulation.runSnapshot);
	let analytics = $state.raw<SimulationAnalytics | null>(initialSimulation.analytics);
	let optimizeRuns = $state.raw<OptimizeRun[]>(initialSimulation.optimizeRuns);
	let selectedPointIndex = $state<number | null>(null);
	let selectedTradeIndex = $state<number | null>(null);
	let tradeSortKey = $state<TradeSortKey>('date');
	let tradeSortDir = $state<SortDir>('asc');

	let autoRunTimeout: ReturnType<typeof setTimeout> | undefined;
	let persistTimeout: ReturnType<typeof setTimeout> | undefined;
	let activeRequestId = 0;
	let activeOptimizeRequestId = 0;

	const TICKER_AUTORUN_MS = 800;
	const DEFAULT_AUTORUN_MS = 350;
	// ponytail: archived optimizer panel; set true to restore UI and auto-run hook
	const OPTIMIZER_ENABLED = true;

	const legend = $derived(getLegendConfig(strategy));
	const selectedPoint = $derived(
		selectedPointIndex !== null ? (result?.series_data[selectedPointIndex] ?? null) : null
	);
	const holdingAsset = $derived(result?.final_status.includes('asset') ?? false);
	const isRefreshing = $derived(isRunning && result !== null);
	const isOptimizingRefresh = $derived(isOptimizing && optimizeRuns.length > 0);
	const isInitialLoad = $derived(isRunning && result === null);
	const sortedTrades = $derived(
		result?.trades.length ? sortTrades(result.trades, tradeSortKey, tradeSortDir) : []
	);
	const displayedTrades = $derived(sortedTrades.slice(0, MAX_TRADE_TABLE_ROWS));
	const tradesTruncated = $derived(sortedTrades.length > MAX_TRADE_TABLE_ROWS);
	const filteredAssetOptions = $derived(filterAssetOptions(assetSearch));
	const selectedAsset = $derived(findAssetOption(ticker));
	const sourceTab = $derived(dataSource === 'csv' ? 'csv' : 'market');
	const portfolioSelectionActive = $derived(dataSource === 'portfolio' && portfolioId !== null);
	const activePortfolio = $derived(portfolios[activePortfolioIndex] ?? null);
	const activeComparison = $derived(strategyComparisons[activeStrategyComparisonIndex] ?? null);
	const selectedPortfolio = $derived(
		portfolioId ? (portfolios.find((portfolio) => portfolio.id === portfolioId) ?? null) : null
	);
	const totalPortfolioWeight = $derived(
		activePortfolio?.assets.reduce((sum, asset) => sum + (parseFloat(asset.weight) || 0), 0) ?? 0
	);

	function createId(prefix: string): string {
		return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	}

	function createSimulationFromSettings(
		settings: Partial<SimulationPersisted> = {}
	): SimulationPersisted {
		return {
			name: settings.name,
			dataSource: settings.dataSource ?? DEFAULT_DASHBOARD_SETTINGS.dataSource,
			ticker: settings.ticker ?? DEFAULT_DASHBOARD_SETTINGS.ticker,
			portfolioId: settings.portfolioId ?? DEFAULT_DASHBOARD_SETTINGS.portfolioId,
			period: settings.period ?? DEFAULT_DASHBOARD_SETTINGS.period,
			interval: settings.interval ?? DEFAULT_DASHBOARD_SETTINGS.interval,
			csvText: settings.csvText ?? DEFAULT_DASHBOARD_SETTINGS.csvText,
			strategy: settings.strategy ?? DEFAULT_DASHBOARD_SETTINGS.strategy,
			windowSize: settings.windowSize ?? DEFAULT_DASHBOARD_SETTINGS.windowSize,
			startingCapital: settings.startingCapital ?? DEFAULT_DASHBOARD_SETTINGS.startingCapital,
			feeRate: settings.feeRate ?? DEFAULT_DASHBOARD_SETTINGS.feeRate,
			autoRun: settings.autoRun ?? DEFAULT_DASHBOARD_SETTINGS.autoRun,
			result: settings.result ?? null,
			runSnapshot: settings.runSnapshot ?? null,
			analytics: settings.analytics ?? null,
			optimizeRuns: settings.optimizeRuns ?? []
		};
	}

	function currentSimulation(): SimulationPersisted {
		return {
			name: simulations[activeSimulationIndex]?.name,
			dataSource,
			ticker,
			portfolioId,
			period,
			interval,
			csvText,
			strategy,
			windowSize,
			startingCapital,
			feeRate,
			autoRun,
			result,
			runSnapshot,
			analytics,
			optimizeRuns
		};
	}

	function saveCurrentSimulation() {
		simulations = simulations.map((simulation, index) =>
			index === activeSimulationIndex ? currentSimulation() : simulation
		);
	}

	function loadSimulation(index: number) {
		const simulation = simulations[index];
		if (!simulation) return;
		dataSource = simulation.dataSource;
		ticker = simulation.ticker;
		portfolioId = simulation.portfolioId;
		assetSearch = assetSearchLabel(simulation.ticker);
		assetDropdownOpen = false;
		period = simulation.period;
		interval = simulation.interval;
		csvText = simulation.csvText;
		strategy = simulation.strategy;
		windowSize = simulation.windowSize;
		startingCapital = simulation.startingCapital;
		feeRate = simulation.feeRate;
		autoRun = simulation.autoRun;
		result = simulation.result;
		runSnapshot = simulation.runSnapshot;
		analytics = simulation.analytics;
		optimizeRuns = simulation.optimizeRuns;
		selectedPointIndex = null;
		selectedTradeIndex = null;
		setStatus(
			simulation.result ? i18n.t('status.done') : '',
			simulation.result ? 'success' : 'info'
		);
	}

	function switchSimulation(index: number) {
		if (index === activeSimulationIndex) return;
		saveCurrentSimulation();
		activeSimulationIndex = index;
		loadSimulation(index);
	}

	function addSimulation(seed: SimulationPersisted = createSimulationFromSettings()) {
		saveCurrentSimulation();
		simulations = [...simulations, seed];
		activeSimulationIndex = simulations.length - 1;
		loadSimulation(activeSimulationIndex);
		schedulePersist();
		if (seed.autoRun) scheduleAutoRun();
	}

	function duplicateSimulation() {
		addSimulation({
			...currentSimulation(),
			name: `${simulations[activeSimulationIndex]?.name ?? `Simulation ${activeSimulationIndex + 1}`} Copy`,
			result: null,
			runSnapshot: null,
			analytics: null,
			optimizeRuns: []
		});
	}

	function deleteActiveSimulation() {
		if (simulations.length <= 1) return;
		const name =
			simulations[activeSimulationIndex]?.name ?? `Simulation ${activeSimulationIndex + 1}`;
		if (!confirm(i18n.t('simulation.deleteConfirm', { name }))) return;
		const nextSimulations = simulations.filter((_, index) => index !== activeSimulationIndex);
		const nextIndex = Math.min(activeSimulationIndex, nextSimulations.length - 1);
		simulations = nextSimulations;
		activeSimulationIndex = nextIndex;
		loadSimulation(nextIndex);
		schedulePersist();
	}

	function updateActiveSimulationName(name: string) {
		simulations = simulations.map((simulation, index) =>
			index === activeSimulationIndex ? { ...simulation, name } : simulation
		);
	}

	function defaultComparisonStrategies(): StrategyComparison['strategies'] {
		return {
			sma: {
				enabled: true,
				params: getDefaultStrategyParamValues('sma', windowSize || '20'),
				windowSize: windowSize || '20'
			},
			ema: {
				enabled: true,
				params: getDefaultStrategyParamValues('ema', windowSize || '20'),
				windowSize: windowSize || '20'
			},
			rsi: {
				enabled: true,
				params: getDefaultStrategyParamValues('rsi'),
				windowSize: '14'
			},
			macd: {
				enabled: false,
				params: getDefaultStrategyParamValues('macd'),
				windowSize: '12'
			},
			bollinger: {
				enabled: false,
				params: getDefaultStrategyParamValues('bollinger'),
				windowSize: '20'
			},
			crossover: {
				enabled: false,
				params: getDefaultStrategyParamValues('crossover'),
				windowSize: '20'
			}
		};
	}

	function createComparison(seed: Partial<StrategyComparison> = {}): StrategyComparison {
		return {
			id: seed.id ?? createId('comparison'),
			name: seed.name ?? `Vergleich ${strategyComparisons.length + 1}`,
			dataSource: seed.dataSource ?? dataSource,
			ticker: seed.ticker ?? ticker,
			portfolioId: seed.portfolioId ?? portfolioId,
			period: seed.period ?? period,
			interval: seed.interval ?? interval,
			csvText: seed.csvText ?? csvText,
			startingCapital: seed.startingCapital ?? startingCapital,
			feeRate: seed.feeRate ?? feeRate,
			strategies: seed.strategies ?? defaultComparisonStrategies(),
			results: seed.results ?? []
		};
	}

	function ensureComparison() {
		if (strategyComparisons.length) return;
		strategyComparisons = [createComparison()];
		activeStrategyComparisonIndex = 0;
	}

	function openStrategyComparison() {
		ensureComparison();
		comparisonModalOpen = true;
		schedulePersist();
	}

	function updateActiveComparison(patch: Partial<StrategyComparison>) {
		if (!activeComparison) return;
		strategyComparisons = strategyComparisons.map((comparison, index) =>
			index === activeStrategyComparisonIndex ? { ...comparison, ...patch } : comparison
		);
	}

	function addComparison(seed?: StrategyComparison) {
		const next = seed ?? createComparison();
		strategyComparisons = [...strategyComparisons, next];
		activeStrategyComparisonIndex = strategyComparisons.length - 1;
		schedulePersist();
	}

	function duplicateComparison() {
		if (!activeComparison) return;
		addComparison({
			...activeComparison,
			id: createId('comparison'),
			name: `${activeComparison.name} Copy`,
			results: []
		});
	}

	function deleteComparison() {
		if (strategyComparisons.length <= 1) return;
		strategyComparisons = strategyComparisons.filter(
			(_, index) => index !== activeStrategyComparisonIndex
		);
		activeStrategyComparisonIndex = Math.max(0, activeStrategyComparisonIndex - 1);
		schedulePersist();
	}

	function applyCurrentSettingsToComparison() {
		if (!activeComparison) return;
		updateActiveComparison({
			dataSource,
			ticker,
			portfolioId,
			period,
			interval,
			csvText,
			startingCapital,
			feeRate,
			results: []
		});
	}

	function updateComparisonStrategy(
		strategyType: StrategyType,
		patch: Partial<StrategyComparison['strategies'][StrategyType]>
	) {
		if (!activeComparison) return;
		const current = activeComparison.strategies[strategyType];
		const params = patch.params
			? normalizeStrategyParamValues(
					strategyType,
					patch.params,
					patch.windowSize ?? current.windowSize
				)
			: current.params;
		updateActiveComparison({
			strategies: {
				...activeComparison.strategies,
				[strategyType]: {
					...current,
					...patch,
					params,
					windowSize: patch.windowSize ?? primaryStrategyWindow(params)
				}
			},
			results: []
		});
	}

	function updateComparisonStrategyParam(strategyType: StrategyType, key: string, value: string) {
		if (!activeComparison) return;
		const current = activeComparison.strategies[strategyType];
		const params = normalizeStrategyParamValues(strategyType, {
			...current.params,
			[key]: value
		});
		updateComparisonStrategy(strategyType, {
			params,
			windowSize: primaryStrategyWindow(params)
		});
	}

	function addPortfolio(seed?: Partial<Portfolio>) {
		const portfolio: Portfolio = {
			id: seed?.id ?? createId('portfolio'),
			name: seed?.name ?? `Portfolio ${portfolios.length + 1}`,
			assets: seed?.assets?.length
				? seed.assets
				: [
						{ symbol: 'BTC-USD', label: 'Bitcoin', weight: '50' },
						{ symbol: 'SPY', label: 'S&P 500 ETF', weight: '50' }
					]
		};
		portfolios = [...portfolios, portfolio];
		activePortfolioIndex = portfolios.length - 1;
		portfolioId = portfolio.id;
		dataSource = 'portfolio';
		schedulePersist();
	}

	function updateActivePortfolio(next: Portfolio) {
		portfolios = portfolios.map((portfolio, index) =>
			index === activePortfolioIndex ? next : portfolio
		);
	}

	function updatePortfolioName(name: string) {
		if (!activePortfolio) return;
		updateActivePortfolio({ ...activePortfolio, name });
	}

	function editPortfolio(index: number) {
		activePortfolioIndex = index;
		portfolioModalOpen = true;
	}

	function deletePortfolio(index: number) {
		const portfolio = portfolios[index];
		if (!portfolio) return;
		portfolios = portfolios.filter((_, i) => i !== index);
		if (portfolioId === portfolio.id) {
			portfolioId = null;
			if (dataSource === 'portfolio') dataSource = 'api';
			result = null;
			runSnapshot = null;
			analytics = null;
			optimizeRuns = [];
		}
		strategyComparisons = strategyComparisons.map((comparison) =>
			comparison.portfolioId === portfolio.id
				? { ...comparison, portfolioId: null, dataSource: 'api' }
				: comparison
		);
		activePortfolioIndex = Math.min(
			Math.max(0, activePortfolioIndex),
			Math.max(portfolios.length - 1, 0)
		);
		schedulePersist();
	}

	function updatePortfolioAsset(index: number, patch: Partial<PortfolioAsset>) {
		if (!activePortfolio) return;
		const assets = activePortfolio.assets.map((asset, i) =>
			i === index ? { ...asset, ...patch } : asset
		);
		updateActivePortfolio({ ...activePortfolio, assets });
	}

	function updatePortfolioSymbol(index: number, value: string) {
		const rawValue = value.trim();
		const exact = ASSET_OPTIONS.find(
			(asset) =>
				asset.symbol.toUpperCase() === normalizeTickerSymbol(rawValue) ||
				asset.label.toLowerCase() === rawValue.toLowerCase() ||
				(asset.aliases ?? []).some((alias) => alias.toLowerCase() === rawValue.toLowerCase())
		);
		if (exact) {
			applyPortfolioAsset(index, exact);
			return;
		}
		if (!isTickerLike(rawValue)) {
			portfolioAssetSearch = { ...portfolioAssetSearch, [index]: value };
			openPortfolioAssetIndex = index;
			return;
		}
		const symbol = normalizeTickerSymbol(rawValue);
		const asset = findAssetOption(symbol);
		portfolioAssetSearch = { ...portfolioAssetSearch, [index]: value };
		openPortfolioAssetIndex = index;
		updatePortfolioAsset(index, {
			symbol,
			label: asset?.label ?? symbol
		});
	}

	function portfolioAssetSearchValue(asset: PortfolioAsset, index: number): string {
		return portfolioAssetSearch[index] ?? assetSearchLabel(asset.symbol);
	}

	function filteredPortfolioAssetOptions(index: number, asset: PortfolioAsset): AssetOption[] {
		return filterAssetOptions(portfolioAssetSearchValue(asset, index));
	}

	function applyPortfolioAsset(index: number, asset: AssetOption) {
		portfolioAssetSearch = { ...portfolioAssetSearch, [index]: assetSearchLabel(asset.symbol) };
		openPortfolioAssetIndex = null;
		updatePortfolioAsset(index, {
			symbol: asset.symbol,
			label: asset.label
		});
	}

	function applyCustomPortfolioAsset(index: number) {
		const search = portfolioAssetSearch[index] ?? '';
		if (!isTickerLike(search)) return;
		const symbol = normalizeTickerSymbol(search);
		portfolioAssetSearch = { ...portfolioAssetSearch, [index]: assetSearchLabel(symbol) };
		openPortfolioAssetIndex = null;
		updatePortfolioAsset(index, {
			symbol,
			label: findAssetOption(symbol)?.label ?? symbol
		});
	}

	function handlePortfolioAssetKeydown(e: KeyboardEvent, index: number, asset: PortfolioAsset) {
		if (e.key === 'Escape') {
			openPortfolioAssetIndex = null;
			portfolioAssetSearch = { ...portfolioAssetSearch, [index]: assetSearchLabel(asset.symbol) };
			return;
		}
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const first = filteredPortfolioAssetOptions(index, asset)[0];
		if (first) applyPortfolioAsset(index, first);
		else applyCustomPortfolioAsset(index);
	}

	function addPortfolioAsset() {
		if (!activePortfolio) return;
		updateActivePortfolio({
			...activePortfolio,
			assets: [...activePortfolio.assets, { symbol: '', label: '', weight: '0' }]
		});
	}

	function removePortfolioAsset(index: number) {
		if (!activePortfolio) return;
		updateActivePortfolio({
			...activePortfolio,
			assets: activePortfolio.assets.filter((_, i) => i !== index)
		});
	}

	function formatWeight(value: number): string {
		return value.toFixed(2).replace(/\.?0+$/, '');
	}

	function normalizePortfolioWeights() {
		if (!activePortfolio || activePortfolio.assets.length === 0) return;
		const weights = activePortfolio.assets.map((asset) =>
			Math.max(parseFloat(asset.weight) || 0, 0)
		);
		const total = weights.reduce((sum, weight) => sum + weight, 0);
		const normalized =
			total > 0
				? weights.map((weight) => (weight / total) * 100)
				: activePortfolio.assets.map(() => 100 / activePortfolio.assets.length);
		const rounded = normalized.map((weight) => Math.round(weight * 100) / 100);
		const diff = Math.round((100 - rounded.reduce((sum, weight) => sum + weight, 0)) * 100) / 100;
		let adjustIndex = -1;
		for (let i = rounded.length - 1; i >= 0; i--) {
			if (rounded[i] > 0) {
				adjustIndex = i;
				break;
			}
		}
		if (adjustIndex !== -1) rounded[adjustIndex] = Math.max(0, rounded[adjustIndex] + diff);
		updateActivePortfolio({
			...activePortfolio,
			assets: activePortfolio.assets.map((asset, index) => ({
				...asset,
				weight: formatWeight(rounded[index] ?? 0)
			}))
		});
	}

	function selectPortfolio(id: string) {
		if (portfolioId === id && dataSource === 'portfolio') {
			portfolioId = null;
			dataSource = 'api';
			if (ticker.trim().length < 2) {
				result = null;
				runSnapshot = null;
				analytics = null;
				optimizeRuns = [];
				setStatus('', 'info');
				schedulePersist();
				return;
			}
			scheduleAutoRun(TICKER_AUTORUN_MS);
			return;
		}
		portfolioId = id;
		assetDropdownOpen = false;
		dataSource = 'portfolio';
		scheduleAutoRun(TICKER_AUTORUN_MS);
	}

	function findAssetOption(symbol: string): AssetOption | undefined {
		const normalized = symbol.trim().toUpperCase();
		return ASSET_OPTIONS.find((asset) => asset.symbol.toUpperCase() === normalized);
	}

	function assetSearchLabel(symbol: string): string {
		const asset = findAssetOption(symbol);
		return asset ? `${asset.label} (${asset.symbol})` : symbol;
	}

	function normalizeTickerSymbol(value: string): string {
		return value.trim().toUpperCase();
	}

	function isTickerLike(value: string): boolean {
		return /^[A-Z0-9.^=-]{2,18}$/.test(normalizeTickerSymbol(value));
	}

	function filterAssetOptions(query: string): AssetOption[] {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return ASSET_OPTIONS;
		return ASSET_OPTIONS.filter((asset) => {
			const haystack =
				`${asset.label} ${asset.symbol} ${asset.category} ${asset.aliases?.join(' ') ?? ''}`.toLowerCase();
			return haystack.includes(normalized);
		});
	}

	async function buildPortfolioPrices(
		portfolio: Portfolio,
		selectedPeriod = period,
		selectedInterval = interval
	) {
		const assets = portfolio.assets
			.map((asset) => ({
				...asset,
				symbol: normalizeTickerSymbol(asset.symbol),
				weightValue: parseFloat(asset.weight)
			}))
			.filter((asset) => asset.symbol.length >= 2 && Number.isFinite(asset.weightValue));
		const totalWeight = assets.reduce((sum, asset) => sum + Math.max(asset.weightValue, 0), 0);
		if (assets.length === 0 || totalWeight <= 0) throw new Error(i18n.t('portfolio.error.empty'));

		const series = await Promise.all(
			assets.map(async (asset) => ({
				...asset,
				normalizedWeight: Math.max(asset.weightValue, 0) / totalWeight,
				prices: await getTickerPrices(asset.symbol, selectedPeriod, selectedInterval)
			}))
		);
		const firstDates = series[0]?.prices.map((point) => point.date) ?? [];
		const priceMaps = series.map(
			(asset) => new Map(asset.prices.map((point) => [point.date, point.close]))
		);
		const basePrices = series.map((asset) => asset.prices[0]?.close ?? 0);
		const points = firstDates.flatMap((date) => {
			if (!priceMaps.every((prices) => prices.has(date))) return [];
			const close = series.reduce((sum, asset, index) => {
				const base = basePrices[index];
				const value = priceMaps[index].get(date);
				if (!base || !value) return sum;
				return sum + asset.normalizedWeight * (value / base) * 100;
			}, 0);
			return close > 0 ? [{ date, close }] : [];
		});
		if (points.length < 2) throw new Error(i18n.t('portfolio.error.overlap'));
		return points;
	}

	function setStatus(msg: string, type: StatusType = 'info') {
		statusMessage = msg;
		statusType = type;
	}

	function statusFromError(error: unknown): string {
		return error instanceof Error ? error.message : i18n.t('error.backtest');
	}

	async function runAutoUpdate() {
		await runBacktest();
		if (autoRun && OPTIMIZER_ENABLED) await runOptimize();
	}

	function scheduleAutoRun(delayMs = DEFAULT_AUTORUN_MS) {
		if (!autoRun) return;
		clearTimeout(autoRunTimeout);
		autoRunTimeout = setTimeout(() => {
			void runAutoUpdate();
		}, delayMs);
	}

	function persistDashboard() {
		const latestSimulations = simulations.map((simulation, index) =>
			index === activeSimulationIndex ? currentSimulation() : simulation
		);
		simulations = latestSimulations;
		writeDashboardState({
			dataSource,
			ticker,
			portfolioId,
			period,
			interval,
			csvText,
			strategy,
			windowSize,
			startingCapital,
			feeRate,
			autoRun,
			result,
			runSnapshot,
			analytics,
			optimizeRuns,
			simulations: latestSimulations,
			activeSimulationIndex,
			portfolios,
			activePortfolioIndex,
			strategyComparisons,
			activeStrategyComparisonIndex
		});
	}

	function schedulePersist() {
		clearTimeout(persistTimeout);
		persistTimeout = setTimeout(persistDashboard, 300);
	}

	function resetSettings() {
		clearTickerPriceCache();
		dataSource = DEFAULT_DASHBOARD_SETTINGS.dataSource;
		ticker = DEFAULT_DASHBOARD_SETTINGS.ticker;
		portfolioId = DEFAULT_DASHBOARD_SETTINGS.portfolioId;
		assetSearch = assetSearchLabel(DEFAULT_DASHBOARD_SETTINGS.ticker);
		assetDropdownOpen = false;
		period = DEFAULT_DASHBOARD_SETTINGS.period;
		interval = DEFAULT_DASHBOARD_SETTINGS.interval;
		csvText = DEFAULT_DASHBOARD_SETTINGS.csvText;
		strategy = DEFAULT_DASHBOARD_SETTINGS.strategy;
		windowSize = DEFAULT_DASHBOARD_SETTINGS.windowSize;
		startingCapital = DEFAULT_DASHBOARD_SETTINGS.startingCapital;
		feeRate = DEFAULT_DASHBOARD_SETTINGS.feeRate;
		autoRun = DEFAULT_DASHBOARD_SETTINGS.autoRun;
		result = null;
		runSnapshot = null;
		analytics = null;
		optimizeRuns = [];
		selectedPointIndex = null;
		selectedTradeIndex = null;
		setStatus(i18n.t('settings.resetDone'), 'info');
		persistDashboard();
		scheduleAutoRun();
	}

	async function buildPayloadFromSettings(settings: {
		dataSource: DataSource;
		ticker: string;
		portfolioId: string | null;
		period: Period;
		interval: Interval;
		csvText: string;
		startingCapital: string;
		feeRate: string;
		strategy: StrategyType;
		windowSize: string;
		strategyParams?: Record<string, string>;
	}) {
		const capital = parseFloat(settings.startingCapital);
		const fee = parseFloat(settings.feeRate);
		const strategyParams = getStrategyParams(
			settings.strategy,
			settings.strategyParams ?? settings.windowSize
		);

		if (Number.isNaN(capital) || capital <= 0) throw new Error(i18n.t('error.capital'));
		if (Number.isNaN(fee) || fee < 0) throw new Error(i18n.t('error.fee'));

		const payload: BacktestRequest = {
			starting_capital: capital,
			transaction_fee_percent: fee,
			strategy_type: settings.strategy,
			strategy_params: strategyParams
		};

		if (settings.dataSource === 'api') {
			const symbol = settings.ticker.trim().toUpperCase();
			if (symbol.length < 2) return null;
			payload.prices = capPricePoints(
				await getTickerPrices(symbol, settings.period, settings.interval)
			);
		} else if (settings.dataSource === 'portfolio') {
			const portfolio = settings.portfolioId
				? portfolios.find((item) => item.id === settings.portfolioId)
				: null;
			if (!portfolio) throw new Error(i18n.t('portfolio.error.select'));
			payload.prices = capPricePoints(
				await buildPortfolioPrices(portfolio, settings.period, settings.interval)
			);
		} else {
			payload.prices = capPricePoints(parseCsvText(settings.csvText));
		}

		return { payload, strategyParams, capital, fee };
	}

	async function buildPayload() {
		return buildPayloadFromSettings({
			dataSource,
			ticker,
			portfolioId,
			period,
			interval,
			csvText,
			startingCapital,
			feeRate,
			strategy,
			windowSize
		});
	}

	async function runStrategyComparison() {
		if (!activeComparison || isComparing) return;
		const selected = STRATEGIES.filter(
			(strategyType) => activeComparison.strategies[strategyType]?.enabled
		);
		if (!selected.length) {
			setStatus(i18n.t('comparison.error.empty'), 'error');
			return;
		}

		isComparing = true;
		setStatus(i18n.t('comparison.running'), 'info');
		try {
			const runs: StrategyComparisonResult[] = [];
			for (const strategyType of selected) {
				const settings = activeComparison.strategies[strategyType];
				const params = normalizeStrategyParamValues(
					strategyType,
					settings.params,
					settings.windowSize
				);
				const built = await buildPayloadFromSettings({
					...activeComparison,
					strategy: strategyType,
					windowSize: primaryStrategyWindow(params),
					strategyParams: params
				});
				if (!built) continue;
				runs.push({
					strategy: strategyType,
					params,
					windowSize: primaryStrategyWindow(params),
					result: await postBacktest(built.payload)
				});
			}
			updateActiveComparison({ results: runs });
			setStatus(i18n.t('comparison.done'), 'success');
			schedulePersist();
		} catch (error) {
			setStatus(statusFromError(error), 'error');
		} finally {
			isComparing = false;
		}
	}

	function applyComparisonResult(run: StrategyComparisonResult) {
		if (!activeComparison) return;
		saveCurrentSimulation();
		dataSource = activeComparison.dataSource;
		ticker = activeComparison.ticker;
		portfolioId = activeComparison.portfolioId;
		assetSearch = assetSearchLabel(activeComparison.ticker);
		period = activeComparison.period;
		interval = activeComparison.interval;
		csvText = activeComparison.csvText;
		startingCapital = activeComparison.startingCapital;
		feeRate = activeComparison.feeRate;
		strategy = run.strategy;
		windowSize = run.windowSize;
		const runParams = normalizeStrategyParamValues(run.strategy, run.params, run.windowSize);
		result = run.result;
		analytics = calculateSimulationAnalytics(run.result);
		runSnapshot = {
			dataSource:
				activeComparison.dataSource === 'api'
					? i18n.t('source.yahoo')
					: activeComparison.dataSource === 'portfolio'
						? i18n.t('source.portfolio')
						: i18n.t('source.csv'),
			asset:
				activeComparison.dataSource === 'api'
					? activeComparison.ticker.trim().toUpperCase()
					: activeComparison.dataSource === 'portfolio'
						? (portfolios.find((item) => item.id === activeComparison.portfolioId)?.name ??
							i18n.t('source.portfolio'))
						: i18n.t('active.customCsv'),
			period: activeComparison.dataSource === 'csv' ? '-' : activeComparison.period,
			interval: activeComparison.dataSource === 'csv' ? '-' : activeComparison.interval,
			strategy: i18n.t(`strategy.${run.strategy}` as 'strategy.sma'),
			strategyParams: getStrategyParams(run.strategy, runParams),
			startingCapital: parseFloat(activeComparison.startingCapital),
			feePercent: parseFloat(activeComparison.feeRate),
			dateStart: run.result.series_data[0]?.date ?? '-',
			dateEnd: run.result.series_data[run.result.series_data.length - 1]?.date ?? '-',
			dataPoints: run.result.series_data.length
		};
		optimizeRuns = [];
		selectedPointIndex = null;
		selectedTradeIndex = null;
		comparisonModalOpen = false;
		setStatus(i18n.t('comparison.applied'), 'success');
		persistDashboard();
	}

	function comparisonAssetLabel(comparison: StrategyComparison): string {
		if (comparison.dataSource === 'api') return comparison.ticker.trim().toUpperCase();
		if (comparison.dataSource === 'portfolio') {
			return (
				portfolios.find((portfolio) => portfolio.id === comparison.portfolioId)?.name ??
				i18n.t('source.portfolio')
			);
		}
		return i18n.t('active.customCsv');
	}

	async function runBacktest() {
		const requestId = ++activeRequestId;
		const hadResult = result !== null;
		isRunning = true;
		optimizeRuns = [];
		if (!hadResult) setStatus(i18n.t('status.running'), 'info');

		try {
			const built = await buildPayload();
			if (!built) {
				if (requestId === activeRequestId) isRunning = false;
				return;
			}
			const { payload, strategyParams, capital, fee } = built;
			const isApi = dataSource === 'api';
			const isPortfolio = dataSource === 'portfolio';

			const response = await postBacktest(payload);
			if (requestId !== activeRequestId) return;

			result = response;
			analytics = calculateSimulationAnalytics(response);
			runSnapshot = {
				dataSource: isApi
					? i18n.t('source.yahoo')
					: isPortfolio
						? i18n.t('source.portfolio')
						: i18n.t('source.csv'),
				asset: isApi
					? ticker.trim().toUpperCase()
					: isPortfolio
						? (selectedPortfolio?.name ?? i18n.t('source.portfolio'))
						: i18n.t('active.customCsv'),
				period: isApi || isPortfolio ? period : '-',
				interval: isApi || isPortfolio ? interval : '-',
				strategy: i18n.t(`strategy.${strategy}` as 'strategy.sma'),
				strategyParams,
				startingCapital: capital,
				feePercent: fee,
				dateStart: response.series_data[0]?.date ?? '-',
				dateEnd: response.series_data[response.series_data.length - 1]?.date ?? '-',
				dataPoints: response.series_data.length
			};

			selectedPointIndex = null;
			selectedTradeIndex = null;
			setStatus(i18n.t('status.done'), 'success');
			persistDashboard();
		} catch (error) {
			if (requestId !== activeRequestId) return;
			setStatus(statusFromError(error), 'error');
		} finally {
			if (requestId === activeRequestId) isRunning = false;
		}
	}

	async function runOptimize() {
		const requestId = ++activeOptimizeRequestId;
		const hadRuns = optimizeRuns.length > 0;
		isOptimizing = true;
		if (!hadRuns) setStatus(i18n.t('optimizer.running'), 'info');

		try {
			const built = await buildPayload();
			if (!built) {
				if (requestId === activeOptimizeRequestId) isOptimizing = false;
				return;
			}
			const { payload } = built;
			const { strategy_params: _, ...optimizePayload } = payload;
			const response = await postOptimize(optimizePayload);
			if (requestId !== activeOptimizeRequestId) return;

			optimizeRuns = response.runs.slice(0, 5);
			setStatus(i18n.t('status.done'), 'success');
			persistDashboard();
		} catch (error) {
			if (requestId !== activeOptimizeRequestId) return;
			setStatus(statusFromError(error), 'error');
		} finally {
			if (requestId === activeOptimizeRequestId) isOptimizing = false;
		}
	}

	function handleCsvFile(file: File | undefined) {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			csvText = String(reader.result ?? '');
			if (autoRun) void runAutoUpdate();
			else void runBacktest();
		};
		reader.readAsText(file);
	}

	function handleCsvDrop(e: DragEvent) {
		e.preventDefault();
		csvDropActive = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) handleCsvFile(file);
	}

	function toggleTradeSort(key: TradeSortKey) {
		tradeSortDir = nextTradeSort(key, tradeSortKey, tradeSortDir);
		tradeSortKey = key;
	}

	function selectTrade(tradeIdx: number) {
		const trade = result?.trades[tradeIdx];
		if (!trade || !result) return;
		const dataIdx = result.series_data.findIndex((d) => d.date === trade.date);
		if (dataIdx !== -1) {
			selectedTradeIndex = tradeIdx;
			selectedPointIndex = dataIdx;
		}
	}

	function applyTickerSuggestion(symbol: string) {
		ticker = symbol;
		portfolioId = null;
		dataSource = 'api';
		assetSearch = assetSearchLabel(symbol);
		assetDropdownOpen = false;
		scheduleAutoRun(TICKER_AUTORUN_MS);
	}

	function applyCustomTicker() {
		if (!isTickerLike(assetSearch)) return;
		const symbol = normalizeTickerSymbol(assetSearch);
		ticker = symbol;
		portfolioId = null;
		dataSource = 'api';
		assetSearch = assetSearchLabel(symbol);
		assetDropdownOpen = false;
		scheduleAutoRun(TICKER_AUTORUN_MS);
	}

	function handleAssetSearchInput(value: string) {
		assetSearch = value;
		assetDropdownOpen = true;
		const exact = ASSET_OPTIONS.find(
			(asset) =>
				asset.symbol.toUpperCase() === normalizeTickerSymbol(value) ||
				asset.label.toLowerCase() === value.trim().toLowerCase() ||
				(asset.aliases ?? []).some((alias) => alias.toLowerCase() === value.trim().toLowerCase())
		);
		if (exact) {
			ticker = exact.symbol;
			scheduleAutoRun(TICKER_AUTORUN_MS);
		}
	}

	function handleAssetKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			assetDropdownOpen = false;
			return;
		}
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const first = filteredAssetOptions[0];
		if (first) applyTickerSuggestion(first.symbol);
		else applyCustomTicker();
	}

	$effect(() => {
		dataSource;
		ticker;
		portfolioId;
		period;
		interval;
		csvText;
		strategy;
		windowSize;
		startingCapital;
		feeRate;
		autoRun;
		result;
		runSnapshot;
		analytics;
		optimizeRuns;
		activeSimulationIndex;
		portfolios;
		activePortfolioIndex;
		strategyComparisons;
		activeStrategyComparisonIndex;
		schedulePersist();
		return () => clearTimeout(persistTimeout);
	});

	onMount(() => {
		if (result) {
			setStatus(i18n.t('status.done'), 'success');
			return;
		}
		if (autoRun) void runAutoUpdate();
	});
</script>

{#snippet hoverDescription(label: string)}
	<span
		class="tooltip-surface pointer-events-none absolute top-full left-1/2 z-50 mt-2 w-max max-w-48 -translate-x-1/2 rounded-md px-2.5 py-1.5 text-center text-xs opacity-0 shadow-lg transition-opacity delay-0 duration-150 group-focus-within:opacity-100 group-focus-within:delay-0 group-hover:opacity-100 group-hover:delay-1000"
		role="tooltip"
	>
		{label}
	</span>
{/snippet}

<Tooltip.TooltipProvider delayDuration={1000}>
	<div class="flex min-h-screen min-w-0 flex-col">
		<header class="{SURFACE_CLASS.shell} border-border/60 border-b">
			<div
				class="mx-auto flex max-w-7xl flex-col items-center gap-2 px-2 py-3 text-center sm:gap-3 sm:px-4 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:text-left"
			>
				<div class="min-w-0">
					<h1
						class="from-primary bg-gradient-to-r to-emerald-400 bg-clip-text text-xl font-extrabold tracking-tight text-transparent drop-shadow-[0_0_12px_rgba(0,230,195,0.2)]"
					>
						MacroSignal <span class="text-foreground/80 text-sm font-medium"
							>{i18n.t('header.productSuffix')}</span
						>
					</h1>
				</div>

				<div class="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
					<ExportMenu {result} snapshot={runSnapshot} onError={(msg) => setStatus(msg, 'error')} />
					<Tabs.Tabs
						value={i18n.lang}
						onValueChange={(value) => i18n.setLanguage(value as Lang)}
						aria-label={i18n.t('language.aria')}
					>
						<Tabs.TabsList class="h-8">
							<Tabs.TabsTrigger value="de" class="px-3 text-xs">DE</Tabs.TabsTrigger>
							<Tabs.TabsTrigger value="en" class="px-3 text-xs">EN</Tabs.TabsTrigger>
						</Tabs.TabsList>
					</Tabs.Tabs>
				</div>
			</div>
		</header>

		<main
			class="mx-auto grid w-full max-w-7xl flex-1 gap-2 px-2 py-3 sm:gap-4 sm:px-4 sm:py-6 lg:grid-cols-[minmax(0,24rem)_1fr] lg:gap-6 lg:px-6"
		>
			<Card.Card aria-labelledby="controls-title">
				<Card.CardHeader class="border-b [.border-b]:pb-4">
					<Card.CardTitle id="controls-title" class="text-base">
						{i18n.t('section.settings')}
					</Card.CardTitle>
					<Card.CardAction>
						<span class="group relative inline-flex">
							<Button
								variant="ghost"
								size="icon"
								class="hover:text-primary size-8 hover:rotate-[-10deg]"
								aria-label={i18n.t('settings.resetAria')}
								title={i18n.t('settings.resetTooltip')}
								onclick={resetSettings}
							>
								<RotateCcwIcon
									class="size-4 transition-transform group-hover/button:rotate-[-35deg]"
								/>
							</Button>
							{@render hoverDescription(i18n.t('settings.resetTooltip'))}
						</span>
					</Card.CardAction>
				</Card.CardHeader>
				<Card.CardContent class="space-y-5">
					<div class="border-border flex items-center gap-2 border-b pb-4">
						<div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
							{#each simulations as _, index (index)}
								<span class="group relative inline-flex">
									<Button
										variant={index === activeSimulationIndex ? 'default' : 'outline'}
										size="icon-sm"
										aria-label={i18n.t('simulation.open', { index: index + 1 })}
										title={i18n.t('simulation.open', { index: index + 1 })}
										onclick={() => switchSimulation(index)}
									>
										{index + 1}
									</Button>
									{@render hoverDescription(i18n.t('simulation.open', { index: index + 1 }))}
								</span>
							{/each}
							<span class="group relative inline-flex">
								<Button
									variant="outline"
									size="icon-sm"
									aria-label={i18n.t('simulation.add')}
									title={i18n.t('simulation.add')}
									onclick={() => addSimulation()}
								>
									<PlusIcon class="size-4 transition-transform group-hover/button:rotate-90" />
								</Button>
								{@render hoverDescription(i18n.t('simulation.add'))}
							</span>
						</div>
						<span class="group relative inline-flex">
							<Button
								variant="outline"
								size="icon-sm"
								aria-label={i18n.t('simulation.duplicate')}
								title={i18n.t('simulation.duplicate')}
								onclick={duplicateSimulation}
							>
								<CopyIcon class="size-4" />
							</Button>
							{@render hoverDescription(i18n.t('simulation.duplicate'))}
						</span>
						<span class="group relative inline-flex">
							<Button
								variant="ghost"
								size="icon-sm"
								class="hover:text-destructive"
								disabled={simulations.length <= 1}
								aria-label={i18n.t('simulation.delete')}
								title={i18n.t('simulation.delete')}
								onclick={deleteActiveSimulation}
							>
								<Trash2Icon class="size-4" />
							</Button>
							{@render hoverDescription(i18n.t('simulation.delete'))}
						</span>
					</div>
					<div class="space-y-2">
						<Label class="text-xs uppercase">{i18n.t('simulation.name')}</Label>
						<Input
							value={simulations[activeSimulationIndex]?.name ??
								`Simulation ${activeSimulationIndex + 1}`}
							oninput={(e) => updateActiveSimulationName(e.currentTarget.value)}
						/>
					</div>
					<div class="space-y-2">
						<Label class="flex items-center gap-1.5 text-xs uppercase">
							{i18n.t('source.label')}
							<Tooltip.Root>
								<Tooltip.Trigger class="inline-flex">
									<CircleHelpIcon class="text-muted-foreground size-3.5" />
								</Tooltip.Trigger>
								<Tooltip.Content>{i18n.t('source.tooltip')}</Tooltip.Content>
							</Tooltip.Root>
						</Label>
						<Tabs.Tabs
							value={sourceTab}
							onValueChange={(value) => {
								if (value === 'csv') {
									clearTickerPriceCache();
									dataSource = 'csv';
								} else if (dataSource === 'csv') {
									dataSource = portfolioId ? 'portfolio' : 'api';
								}
								scheduleAutoRun();
							}}
						>
							<Tabs.TabsList class="h-auto w-full">
								<Tabs.TabsTrigger
									value="market"
									class="min-h-10 flex-1 px-2 text-xs whitespace-nowrap"
									>{i18n.t('source.market')}</Tabs.TabsTrigger
								>
								<Tabs.TabsTrigger value="csv" class="min-h-10 flex-1 px-2 text-xs whitespace-nowrap"
									>{i18n.t('source.csv')}</Tabs.TabsTrigger
								>
							</Tabs.TabsList>

							<Tabs.TabsContent value="market" class="mt-4 space-y-4">
								<div
									class={cn(
										'space-y-2 rounded-lg transition-opacity',
										portfolioSelectionActive && 'opacity-45'
									)}
									title={portfolioSelectionActive ? i18n.t('selection.assetBlocked') : undefined}
								>
									<div class="flex items-center justify-between gap-2">
										<Label class="flex items-center gap-1.5 text-xs uppercase">
											{i18n.t('ticker.label')}
											<Tooltip.Root>
												<Tooltip.Trigger class="inline-flex">
													<CircleHelpIcon class="text-muted-foreground size-3.5" />
												</Tooltip.Trigger>
												<Tooltip.Content>{i18n.t('ticker.tooltip')}</Tooltip.Content>
											</Tooltip.Root>
										</Label>
									</div>
									<div class="flex items-stretch gap-2">
										<div
											class="relative min-w-0 flex-1"
											onfocusout={(e) => {
												const nextTarget = e.relatedTarget;
												if (
													!(nextTarget instanceof Node) ||
													!e.currentTarget.contains(nextTarget)
												) {
													assetDropdownOpen = false;
													assetSearch = assetSearchLabel(ticker);
												}
											}}
										>
											<SearchIcon
												class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
											/>
											<Input
												value={assetSearch}
												placeholder={i18n.t('ticker.placeholder')}
												class="h-10 pr-9 pl-9"
												role="combobox"
												aria-expanded={assetDropdownOpen}
												aria-controls="asset-options"
												disabled={portfolioSelectionActive}
												onfocus={() => {
													if (!portfolioSelectionActive) assetDropdownOpen = true;
												}}
												oninput={(e) => {
													if (!portfolioSelectionActive)
														handleAssetSearchInput(e.currentTarget.value);
												}}
												onkeydown={handleAssetKeydown}
											/>
											<button
												type="button"
												class="text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md disabled:pointer-events-none"
												aria-label={i18n.t('ticker.openDropdown')}
												disabled={portfolioSelectionActive}
												onclick={() => (assetDropdownOpen = !assetDropdownOpen)}
											>
												<ChevronDownIcon class="size-4" />
											</button>
											{#if assetDropdownOpen && !portfolioSelectionActive}
												<div
													id="asset-options"
													class="border-border bg-popover text-popover-foreground absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border p-1 shadow-lg"
													role="listbox"
													tabindex="-1"
												>
													{#if filteredAssetOptions.length}
														{#each filteredAssetOptions as item (item.symbol)}
															<button
																type="button"
																class={cn(
																	'hover:bg-muted focus:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none',
																	item.symbol === ticker && 'bg-muted'
																)}
																role="option"
																aria-selected={item.symbol === ticker}
																onmousedown={(e) => e.preventDefault()}
																onclick={() => applyTickerSuggestion(item.symbol)}
															>
																<span class="min-w-0 flex-1">
																	<span class="block truncate font-medium">{item.label}</span>
																	<span class="text-muted-foreground block truncate text-xs"
																		>{item.symbol} · {item.category}</span
																	>
																</span>
																{#if item.symbol === ticker}
																	<CheckIcon class="text-primary size-4" />
																{/if}
															</button>
														{/each}
													{:else}
														{#if isTickerLike(assetSearch)}
															<button
																type="button"
																class="hover:bg-muted focus:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none"
																onmousedown={(e) => e.preventDefault()}
																onclick={applyCustomTicker}
															>
																<span class="min-w-0 flex-1">
																	<span class="block truncate font-medium"
																		>{normalizeTickerSymbol(assetSearch)}</span
																	>
																	<span class="text-muted-foreground block truncate text-xs"
																		>{i18n.t('ticker.customSymbol')}</span
																	>
																</span>
															</button>
														{:else}
															<span class="text-muted-foreground block px-2 py-3 text-sm">
																{i18n.t('ticker.noResults')}
															</span>
														{/if}
													{/if}
												</div>
											{/if}
										</div>
										<Button
											variant="outline"
											class="h-10 shrink-0 px-3"
											disabled={isRunning || portfolioSelectionActive}
											onclick={runBacktest}
										>
											{#if isRunning}
												<Loader2Icon class="size-4 animate-spin" />
											{/if}
											{i18n.t('action.loadData')}
										</Button>
									</div>
									<div
										class="text-muted-foreground flex items-center justify-between gap-2 text-xs"
									>
										<span class="min-w-0 truncate"
											>{selectedAsset
												? `${selectedAsset.category}: ${selectedAsset.symbol}`
												: `${i18n.t('ticker.customSymbol')}: ${ticker}`}</span
										>
										<span class="shrink-0">{ASSET_OPTIONS.length} Presets</span>
									</div>
								</div>
								<div class="border-border space-y-2 border-t pt-4">
									<div class="flex items-center justify-between gap-2">
										<Label class="text-xs uppercase">{i18n.t('portfolio.select')}</Label>
										<div class="flex items-center gap-1.5">
											<Button
												variant="outline"
												size="sm"
												onclick={() => {
													if (portfolios.length === 0) addPortfolio();
													portfolioModalOpen = true;
												}}
											>
												{portfolios.length ? i18n.t('portfolio.edit') : i18n.t('portfolio.create')}
											</Button>
										</div>
									</div>
									{#if portfolios.length}
										<div class="grid gap-1.5">
											{#each portfolios as portfolio, index (portfolio.id)}
												<div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
													<Button
														variant={portfolio.id === portfolioId && portfolioSelectionActive
															? 'default'
															: 'outline'}
														class="h-auto min-w-0 justify-start px-3 py-2 text-left"
														title={portfolio.id === portfolioId && portfolioSelectionActive
															? i18n.t('selection.portfolioToggleOff')
															: i18n.t('selection.portfolioToggleOn')}
														onclick={() => {
															activePortfolioIndex = index;
															selectPortfolio(portfolio.id);
														}}
													>
														<span class="min-w-0">
															<span class="block truncate">{portfolio.name}</span>
															<span class="block truncate text-xs opacity-75"
																>{portfolio.assets.length} Assets</span
															>
														</span>
													</Button>
													<div class="flex items-center gap-1">
														<span class="group relative inline-flex">
															<Button
																variant="outline"
																size="icon-sm"
																aria-label={i18n.t('portfolio.editOne')}
																title={i18n.t('portfolio.editOne')}
																onclick={() => editPortfolio(index)}
															>
																<PencilIcon class="size-4" />
															</Button>
															{@render hoverDescription(i18n.t('portfolio.editOne'))}
														</span>
														<span class="group relative inline-flex">
															<Button
																variant="ghost"
																size="icon-sm"
																class="hover:text-destructive"
																aria-label={i18n.t('portfolio.delete')}
																title={i18n.t('portfolio.delete')}
																onclick={() => deletePortfolio(index)}
															>
																<Trash2Icon class="size-4" />
															</Button>
															{@render hoverDescription(i18n.t('portfolio.delete'))}
														</span>
													</div>
												</div>
											{/each}
										</div>
									{:else}
										<div
											class="border-border text-muted-foreground rounded-lg border px-3 py-4 text-sm"
										>
											{i18n.t('portfolio.empty')}
										</div>
									{/if}
								</div>
								<div class="grid grid-cols-2 gap-3">
									<div class="space-y-2">
										<Label class="text-xs uppercase">{i18n.t('period.label')}</Label>
										<PeriodSelect bind:value={period} onchange={scheduleAutoRun} />
									</div>
									<div class="space-y-2">
										<Label class="text-xs uppercase">{i18n.t('interval.label')}</Label>
										<IntervalSelect bind:value={interval} onchange={scheduleAutoRun} />
									</div>
								</div>
							</Tabs.TabsContent>

							<Tabs.TabsContent value="csv" class="mt-4 space-y-3">
								<div class="flex items-center justify-between gap-2">
									<Label class="flex items-center gap-1.5 text-xs">
										{i18n.t('csv.heading')}
										<Tooltip.Root>
											<Tooltip.Trigger class="inline-flex">
												<CircleHelpIcon class="text-muted-foreground size-3.5" />
											</Tooltip.Trigger>
											<Tooltip.Content>{i18n.t('csv.tooltip')}</Tooltip.Content>
										</Tooltip.Root>
									</Label>
									<Button
										variant="outline"
										size="sm"
										onclick={() => document.getElementById('csv-file-input')?.click()}
									>
										{i18n.t('csv.upload')}
									</Button>
									<input
										id="csv-file-input"
										type="file"
										accept=".csv,text/csv"
										class="hidden"
										onchange={(e) => handleCsvFile(e.currentTarget.files?.[0])}
									/>
								</div>
								<div
									class={cn(
										'border-border text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-center text-xs',
										csvDropActive && 'border-primary bg-primary/5 text-primary'
									)}
									role="region"
									ondragover={(e) => {
										e.preventDefault();
										csvDropActive = true;
									}}
									ondragleave={() => (csvDropActive = false)}
									ondrop={handleCsvDrop}
								>
									{i18n.t('csv.drop')}
								</div>
								<textarea
									bind:value={csvText}
									aria-label={i18n.t('csv.aria')}
									class="border-input {SURFACE_CLASS.inset} min-h-32 w-full rounded-lg border px-3 py-2 font-mono text-xs"
									oninput={() => scheduleAutoRun()}
								></textarea>
							</Tabs.TabsContent>
						</Tabs.Tabs>
					</div>

					<div class="space-y-2">
						<Label class="flex items-center gap-1.5 text-xs uppercase">
							{i18n.t('strategy.label')}
							<Tooltip.Root>
								<Tooltip.Trigger class="inline-flex">
									<CircleHelpIcon class="text-muted-foreground size-3.5" />
								</Tooltip.Trigger>
								<Tooltip.Content>{i18n.t('strategy.tooltip')}</Tooltip.Content>
							</Tooltip.Root>
						</Label>
						<StrategySelect bind:value={strategy} onchange={scheduleAutoRun} />
					</div>

					<div class="space-y-2">
						<Label class="{STABLE_CLASS.label} flex items-center gap-1.5 text-xs uppercase">
							{i18n.t(`param.${strategy}Window` as 'param.smaWindow')}
							<Tooltip.Root>
								<Tooltip.Trigger class="inline-flex">
									<CircleHelpIcon class="text-muted-foreground size-3.5" />
								</Tooltip.Trigger>
								<Tooltip.Content>
									{i18n.t(`param.${strategy}Tooltip` as 'param.smaTooltip')}
								</Tooltip.Content>
							</Tooltip.Root>
						</Label>
						<Input
							type="number"
							min="1"
							bind:value={windowSize}
							oninput={() => scheduleAutoRun()}
						/>
					</div>

					<div class="grid grid-cols-2 gap-x-3 gap-y-2">
						<Label
							class="{STABLE_CLASS.label} flex items-end gap-1.5 self-end text-xs leading-tight uppercase"
						>
							{i18n.t('capital.start')}
							<Tooltip.Root>
								<Tooltip.Trigger class="inline-flex shrink-0">
									<CircleHelpIcon class="text-muted-foreground size-3.5" />
								</Tooltip.Trigger>
								<Tooltip.Content>{i18n.t('capital.tooltip')}</Tooltip.Content>
							</Tooltip.Root>
						</Label>
						<Label
							class="{STABLE_CLASS.label} flex items-end gap-1.5 self-end text-xs leading-tight uppercase"
						>
							<span class="line-clamp-2">{i18n.t('fee.label')}</span>
							<Tooltip.Root>
								<Tooltip.Trigger class="inline-flex shrink-0">
									<CircleHelpIcon class="text-muted-foreground size-3.5" />
								</Tooltip.Trigger>
								<Tooltip.Content>{i18n.t('fee.tooltip')}</Tooltip.Content>
							</Tooltip.Root>
						</Label>
						<Input
							type="number"
							min="1"
							class="min-w-0"
							bind:value={startingCapital}
							oninput={() => scheduleAutoRun()}
						/>
						<Input
							type="number"
							min="0"
							step="0.01"
							class="min-w-0"
							bind:value={feeRate}
							oninput={() => scheduleAutoRun()}
						/>
					</div>

					<label class="flex min-h-11 items-start gap-2 pt-0.5 text-xs leading-snug">
						<Checkbox
							class="mt-0.5"
							bind:checked={autoRun}
							onCheckedChange={(checked) => {
								if (checked) scheduleAutoRun();
							}}
						/>
						{i18n.t('autorun.label')}
					</label>

					<Button class="min-h-11 w-full" onclick={runBacktest}>
						{#if isInitialLoad}
							<Loader2Icon class="size-4 animate-spin" />
						{/if}
						{i18n.t('action.run')}
					</Button>
					<Button variant="outline" class="min-h-11 w-full" onclick={openStrategyComparison}>
						<SparklesIcon class="size-4" />
						{i18n.t('comparison.open')}
					</Button>

					<!-- ponytail: archived — parameter optimizer UI; restore with OPTIMIZER_ENABLED -->
					{#if OPTIMIZER_ENABLED}
						<div class="border-border space-y-3 border-t pt-4">
							<div class="flex items-center justify-between gap-2">
								<h3
									class="text-muted-foreground flex min-h-8 items-center gap-2 text-sm leading-tight font-medium"
								>
									<SparklesIcon class="size-3.5 shrink-0" />
									<span class="line-clamp-2">{i18n.t('optimizer.title')}</span>
								</h3>
								<Button
									variant="outline"
									size="sm"
									class="shrink-0 whitespace-nowrap"
									disabled={isOptimizing && optimizeRuns.length === 0}
									onclick={runOptimize}
								>
									{#if isOptimizing}
										<Loader2Icon class="size-3.5 animate-spin" />
									{/if}
									{i18n.t('optimizer.run')}
								</Button>
							</div>
							{#if optimizeRuns.length === 0}
								{#if isOptimizing}
									<TableSkeleton columns={3} rows={5} />
								{:else}
									<div class="flex min-h-52 items-center">
										<p class="text-muted-foreground text-xs">{i18n.t('optimizer.empty')}</p>
									</div>
								{/if}
							{:else}
								<div class="relative overflow-hidden rounded-lg">
									<div class="refresh-pending overflow-x-auto" data-pending={isOptimizingRefresh}>
										<Table.Table>
											<Table.TableHeader>
												<Table.TableRow>
													<Table.TableHead class="text-xs">#</Table.TableHead>
													<Table.TableHead class="text-xs"
														>{i18n.t('optimizer.params')}</Table.TableHead
													>
													<Table.TableHead class="text-xs"
														>{i18n.t('optimizer.return')}</Table.TableHead
													>
												</Table.TableRow>
											</Table.TableHeader>
											<Table.TableBody>
												{#each optimizeRuns as run, i (i)}
													<Table.TableRow
														class="hover:bg-muted/40 cursor-pointer transition-colors"
														onclick={() => {
															if (run.params.window !== undefined) {
																windowSize = String(run.params.window);
																void runAutoUpdate();
															}
														}}
													>
														<Table.TableCell class="text-xs">{i + 1}</Table.TableCell>
														<Table.TableCell class="font-mono text-xs"
															>{formatKeyValueParams(run.params)}</Table.TableCell
														>
														<Table.TableCell
															class={cn(
																STABLE_CLASS.value,
																'text-xs whitespace-nowrap',
																pnlClass(run.profit_loss_percent)
															)}
														>
															{signedPercent(run.profit_loss_percent)}
														</Table.TableCell>
													</Table.TableRow>
												{/each}
											</Table.TableBody>
										</Table.Table>
									</div>
									<RefreshOverlay
										active={isOptimizingRefresh}
										label={i18n.t('optimizer.running')}
									/>
								</div>
							{/if}
						</div>
					{/if}

					<div class={STABLE_CLASS.status} role="status" aria-live="polite">
						{#if statusMessage}
							<div
								class={cn(
									'rounded-lg px-3 py-2 text-sm leading-snug',
									statusType === 'error' && 'bg-destructive/10 text-destructive',
									statusType === 'success' && 'bg-primary/10 text-primary',
									statusType === 'info' && 'bg-muted/50 text-muted-foreground'
								)}
							>
								{statusMessage}
							</div>
						{/if}
					</div>
				</Card.CardContent>
			</Card.Card>

			<Card.Card aria-labelledby="results-title">
				<Card.CardHeader class="flex-row items-start justify-between border-b [.border-b]:pb-4">
					<div class="space-y-1">
						<Card.CardTitle id="results-title" class="text-base"
							>{i18n.t('results.title')}</Card.CardTitle
						>
						{#if !result}
							<Card.CardDescription class={STABLE_CLASS.subtitle}>
								{isInitialLoad ? i18n.t('status.running') : i18n.t('results.empty')}
							</Card.CardDescription>
						{/if}
					</div>
					<span class={STABLE_CLASS.headerAction} role="status">
						{#if isRefreshing}
							<Loader2Icon class="size-3.5 animate-spin" />
							<span class="whitespace-nowrap">{i18n.t('status.refreshing')}</span>
						{/if}
					</span>
				</Card.CardHeader>
				<Card.CardContent class="space-y-3 px-2 sm:space-y-4 sm:px-4">
					{#if result}
						<div class="relative space-y-3 sm:space-y-4">
							<div
								class="refresh-pending grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3"
								data-pending={isRefreshing}
								aria-label={i18n.t('metrics.aria')}
							>
								<Card.Card size="sm">
									<Card.CardHeader class="pb-0">
										<Card.CardDescription class="{STABLE_CLASS.label} text-[0.7rem] uppercase"
											>{i18n.t('metric.start')}</Card.CardDescription
										>
									</Card.CardHeader>
									<Card.CardContent
										><p class="{STABLE_CLASS.value} text-lg font-semibold">
											{formatCurrency(result.start_capital)}
										</p></Card.CardContent
									>
								</Card.Card>
								<Card.Card size="sm">
									<Card.CardHeader class="pb-0">
										<Card.CardDescription class="{STABLE_CLASS.label} text-[0.7rem] uppercase"
											>{i18n.t('metric.end')}</Card.CardDescription
										>
									</Card.CardHeader>
									<Card.CardContent
										><p class="{STABLE_CLASS.value} text-lg font-semibold">
											{formatCurrency(result.end_capital)}
										</p></Card.CardContent
									>
								</Card.Card>
								<Card.Card size="sm">
									<Card.CardHeader class="pb-0">
										<Card.CardDescription class="{STABLE_CLASS.label} text-[0.7rem] uppercase"
											>{i18n.t('metric.profit')}</Card.CardDescription
										>
									</Card.CardHeader>
									<Card.CardContent>
										<p
											class={cn(
												STABLE_CLASS.value,
												'text-lg font-semibold',
												pnlClass(result.profit_loss)
											)}
										>
											{signedCurrency(result.profit_loss)}
										</p>
									</Card.CardContent>
								</Card.Card>
								<Card.Card size="sm">
									<Card.CardHeader class="pb-0">
										<Card.CardDescription
											class="{STABLE_CLASS.label} flex items-start gap-1 text-[0.7rem] uppercase"
										>
											{i18n.t('metric.strategyReturn')}
											<Tooltip.Root>
												<Tooltip.Trigger class="inline-flex">
													<CircleHelpIcon class="size-3" />
												</Tooltip.Trigger>
												<Tooltip.Content>{i18n.t('metric.strategyReturnTooltip')}</Tooltip.Content>
											</Tooltip.Root>
										</Card.CardDescription>
									</Card.CardHeader>
									<Card.CardContent>
										<p
											class={cn(
												STABLE_CLASS.value,
												'text-lg font-semibold',
												pnlClass(result.profit_loss_percent)
											)}
										>
											{signedPercent(result.profit_loss_percent)}
										</p>
									</Card.CardContent>
								</Card.Card>
								<Card.Card size="sm">
									<Card.CardHeader class="pb-0">
										<Card.CardDescription
											class="{STABLE_CLASS.label} flex items-start gap-1 text-[0.7rem] uppercase"
										>
											{i18n.t('metric.sharpe')}
											<Tooltip.Root>
												<Tooltip.Trigger class="inline-flex">
													<CircleHelpIcon class="size-3" />
												</Tooltip.Trigger>
												<Tooltip.Content>{i18n.t('metric.sharpeTooltip')}</Tooltip.Content>
											</Tooltip.Root>
										</Card.CardDescription>
									</Card.CardHeader>
									<Card.CardContent>
										<p class="{STABLE_CLASS.value} text-lg font-semibold">
											{result.sharpe_ratio.toFixed(2)}
										</p>
									</Card.CardContent>
								</Card.Card>
								<Card.Card size="sm">
									<Card.CardHeader class="pb-0">
										<Card.CardDescription
											class="{STABLE_CLASS.label} flex items-start gap-1 text-[0.7rem] uppercase"
										>
											{i18n.t('metric.drawdown')}
											<Tooltip.Root>
												<Tooltip.Trigger class="inline-flex">
													<CircleHelpIcon class="size-3" />
												</Tooltip.Trigger>
												<Tooltip.Content>{i18n.t('metric.drawdownTooltip')}</Tooltip.Content>
											</Tooltip.Root>
										</Card.CardDescription>
									</Card.CardHeader>
									<Card.CardContent>
										<p class="{STABLE_CLASS.value} text-lg font-semibold">
											{result.max_drawdown.toFixed(2)}%
										</p>
									</Card.CardContent>
								</Card.Card>
								<Card.Card size="sm">
									<Card.CardHeader class="pb-0">
										<Card.CardDescription
											class="{STABLE_CLASS.label} flex items-start gap-1 text-[0.7rem] uppercase"
										>
											{i18n.t('metric.winRate')}
											<Tooltip.Root>
												<Tooltip.Trigger class="inline-flex">
													<CircleHelpIcon class="size-3" />
												</Tooltip.Trigger>
												<Tooltip.Content>{i18n.t('metric.winRateTooltip')}</Tooltip.Content>
											</Tooltip.Root>
										</Card.CardDescription>
									</Card.CardHeader>
									<Card.CardContent>
										<p class="{STABLE_CLASS.value} text-lg font-semibold">
											{result.win_rate.toFixed(1)}%
										</p>
									</Card.CardContent>
								</Card.Card>
								<Card.Card size="sm">
									<Card.CardHeader class="pb-0">
										<Card.CardDescription
											class="{STABLE_CLASS.label} flex items-start gap-1 text-[0.7rem] uppercase"
										>
											{i18n.t('metric.buyHold')}
											<Tooltip.Root>
												<Tooltip.Trigger class="inline-flex">
													<CircleHelpIcon class="size-3" />
												</Tooltip.Trigger>
												<Tooltip.Content>{i18n.t('metric.buyHoldTooltip')}</Tooltip.Content>
											</Tooltip.Root>
										</Card.CardDescription>
									</Card.CardHeader>
									<Card.CardContent>
										<p
											class={cn(
												STABLE_CLASS.value,
												'text-lg font-semibold',
												pnlClass(result.buy_and_hold_return)
											)}
										>
											{signedPercent(result.buy_and_hold_return)}
										</p>
									</Card.CardContent>
								</Card.Card>
								<Card.Card size="sm">
									<Card.CardHeader class="pb-0">
										<Card.CardDescription class="{STABLE_CLASS.label} text-[0.7rem] uppercase"
											>{i18n.t('metric.trades')}</Card.CardDescription
										>
									</Card.CardHeader>
									<Card.CardContent>
										<p class="{STABLE_CLASS.value} text-lg font-semibold">
											{i18n.t('trade.count', {
												total: result.buy_trades + result.sell_trades,
												buy: result.buy_trades,
												sell: result.sell_trades
											})}
										</p>
									</Card.CardContent>
								</Card.Card>
							</div>

							<div
								class="{SURFACE_CLASS.inset} refresh-pending flex min-h-11 items-center justify-between rounded-lg px-4 py-2.5"
								data-pending={isRefreshing}
							>
								<span class="text-muted-foreground text-xs font-medium whitespace-nowrap">
									{i18n.t('status.position')}
								</span>
								<span
									class={cn(
										STABLE_CLASS.value,
										'text-sm font-medium whitespace-nowrap',
										holdingAsset ? TONE_CLASS.positive : 'text-primary'
									)}
								>
									{holdingAsset ? i18n.t('position.asset') : i18n.t('position.cash')}
								</span>
							</div>

							<div
								class="refresh-pending -mx-1 space-y-2 rounded-md p-1 sm:mx-0 sm:space-y-3 sm:rounded-lg sm:p-3"
								data-pending={isRefreshing}
							>
								<PriceChart
									seriesData={result.series_data}
									trades={result.trades}
									capitalHistory={result.capital_history}
									{strategy}
									{selectedPointIndex}
									{selectedTradeIndex}
									onSelectPoint={(idx) => (selectedPointIndex = idx)}
								/>
								<div
									class="text-muted-foreground flex flex-wrap justify-center gap-4 text-xs"
									aria-label={i18n.t('legend.aria')}
								>
									<span class="flex items-center gap-1.5">
										<span class="bg-foreground inline-block h-0.5 w-4"></span>
										{i18n.t('legend.price')}
									</span>
									<span class="flex items-center gap-1.5">
										<span class="bg-primary inline-block h-0.5 w-4"></span>
										{legend.label}
									</span>
									<span class="flex items-center gap-1.5">
										<span class="{SIGNAL_DOT_CLASS.buy} inline-block size-2 rounded-full"></span>
										{i18n.t('legend.buy')}
									</span>
									<span class="flex items-center gap-1.5">
										<span class="{SIGNAL_DOT_CLASS.sell} inline-block size-2 rounded-full"></span>
										{i18n.t('legend.sell')}
									</span>
								</div>
							</div>

							<div
								class="refresh-pending grid grid-cols-2 gap-px overflow-hidden rounded-lg border md:grid-cols-4"
								data-pending={isRefreshing}
								aria-label={i18n.t('inspect.aria')}
							>
								<div class="{SURFACE_CLASS.inset} flex flex-col gap-1 p-3">
									<span class="text-muted-foreground text-xs">{i18n.t('inspect.date')}</span>
									<span class="{STABLE_CLASS.value} truncate text-sm font-medium">
										{selectedPoint?.date ?? i18n.t('inspect.defaultDate')}
									</span>
								</div>
								<div class="{SURFACE_CLASS.inset} flex flex-col gap-1 p-3">
									<span class="text-muted-foreground text-xs">{i18n.t('inspect.close')}</span>
									<span class="{STABLE_CLASS.value} text-sm font-medium">
										{selectedPoint ? formatCurrency(selectedPoint.close) : '-'}
									</span>
								</div>
								<div class="{SURFACE_CLASS.inset} flex flex-col gap-1 p-3">
									<span class="text-muted-foreground text-xs">{i18n.t('inspect.indicator')}</span>
									<span class="{STABLE_CLASS.value} text-sm font-medium">
										{selectedPoint && hasNumber(selectedPoint.moving_average)
											? formatCurrency(Number(selectedPoint.moving_average))
											: '-'}
									</span>
								</div>
								<div class="{SURFACE_CLASS.inset} flex flex-col gap-1 p-3">
									<span class="text-muted-foreground text-xs">{i18n.t('inspect.signal')}</span>
									<span
										class={cn(
											STABLE_CLASS.value,
											'text-sm font-medium whitespace-nowrap',
											selectedPoint?.signal === 'buy' && SIGNAL_CLASS.buy,
											selectedPoint?.signal === 'sell' && SIGNAL_CLASS.sell
										)}
									>
										{selectedPoint
											? i18n.t(`signal.${selectedPoint.signal}` as 'signal.hold')
											: '-'}
									</span>
								</div>
							</div>

							<RefreshOverlay active={isRefreshing} label={i18n.t('status.refreshing')} />
						</div>
					{:else}
						<div class="relative">
							<ResultsSkeleton />
							{#if !isInitialLoad}
								<p
									class="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm"
								>
									{i18n.t('results.empty')}
								</p>
							{/if}
						</div>
					{/if}
				</Card.CardContent>
			</Card.Card>

			<Card.Card class="lg:col-span-2">
				<Card.CardContent class="pt-6">
					<AnalysisPanel
						{analytics}
						loading={!analytics}
						showEmpty={!analytics && !isInitialLoad && !isRunning}
					/>
				</Card.CardContent>
			</Card.Card>

			<Card.Card class="lg:col-span-2" aria-labelledby="trades-title">
				<Card.CardHeader class="flex-row items-start justify-between border-b [.border-b]:pb-4">
					<Card.CardTitle id="trades-title" class="text-base"
						>{i18n.t('trades.title')}</Card.CardTitle
					>
					<Card.CardDescription>{i18n.t('trades.subtitle')}</Card.CardDescription>
				</Card.CardHeader>
				<Card.CardContent class="space-y-4">
					{#if isInitialLoad}
						<TableSkeleton columns={6} rows={5} />
					{:else}
						<div class="{SURFACE_CLASS.table} max-h-96 overflow-auto rounded-lg border">
							<Table.Table>
								<Table.TableHeader class="bg-background/95 sticky top-0 z-10 backdrop-blur-sm">
									<Table.TableRow>
										{#each TRADE_COLUMNS as column (column.key)}
											<Table.TableHead
												aria-sort={tradeSortKey === column.key
													? tradeSortDir === 'asc'
														? 'ascending'
														: 'descending'
													: 'none'}
											>
												<button
													type="button"
													class="hover:text-primary -mx-2 inline-flex h-full w-full items-center gap-1 px-2 font-medium"
													onclick={() => toggleTradeSort(column.key)}
												>
													{i18n.t(column.label)}
													{#if tradeSortKey === column.key}
														{#if tradeSortDir === 'asc'}
															<ArrowUpIcon class="size-3.5 shrink-0 opacity-70" />
														{:else}
															<ArrowDownIcon class="size-3.5 shrink-0 opacity-70" />
														{/if}
													{/if}
												</button>
											</Table.TableHead>
										{/each}
									</Table.TableRow>
								</Table.TableHeader>
								<Table.TableBody>
									{#if !result || result.trades.length === 0}
										<Table.TableRow>
											<Table.TableCell colspan={6} class="text-muted-foreground text-center">
												{result ? i18n.t('trade.none') : i18n.t('table.empty')}
											</Table.TableCell>
										</Table.TableRow>
									{:else}
										{#each displayedTrades as { trade, index } (trade.date + trade.type + index)}
											<Table.TableRow
												class={cn(
													'cursor-pointer',
													selectedTradeIndex === index && 'surface-row-selected'
												)}
												onclick={() => selectTrade(index)}
											>
												<Table.TableCell class="font-mono">{trade.date}</Table.TableCell>
												<Table.TableCell
													class={trade.type === 'buy' ? SIGNAL_CLASS.buy : SIGNAL_CLASS.sell}
												>
													{trade.type === 'buy' ? i18n.t('trade.buy') : i18n.t('trade.sell')}
												</Table.TableCell>
												<Table.TableCell class="font-mono"
													>{formatCurrency(trade.price)}</Table.TableCell
												>
												<Table.TableCell class="font-mono">{trade.units.toFixed(6)}</Table.TableCell
												>
												<Table.TableCell class="font-mono"
													>{formatCurrency(trade.fee)}</Table.TableCell
												>
												<Table.TableCell class="font-mono"
													>{formatCurrency(trade.cashBalance)}</Table.TableCell
												>
											</Table.TableRow>
										{/each}
									{/if}
								</Table.TableBody>
							</Table.Table>
						</div>
						{#if tradesTruncated}
							<p class="text-muted-foreground text-xs">
								{i18n.t('trades.truncated', {
									shown: MAX_TRADE_TABLE_ROWS,
									total: sortedTrades.length
								})}
							</p>
						{/if}
					{/if}

					{#if result}
						<TradeInspector
							{result}
							tradeIndex={selectedTradeIndex}
							onClose={() => (selectedTradeIndex = null)}
						/>
					{/if}
				</Card.CardContent>
			</Card.Card>
		</main>

		{#if portfolioModalOpen}
			<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
				<section
					class="{SURFACE_CLASS.shell} border-border max-h-[92vh] w-full max-w-3xl overflow-hidden overscroll-contain rounded-lg border shadow-2xl"
					aria-labelledby="portfolio-title"
					onwheel={(e) => e.stopPropagation()}
					ontouchmove={(e) => e.stopPropagation()}
				>
					<header class="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
						<div class="min-w-0">
							<h2 id="portfolio-title" class="truncate text-base font-semibold">
								{i18n.t('portfolio.manager')}
							</h2>
							<p class="text-muted-foreground truncate text-xs">
								{i18n.t('portfolio.managerSubtitle')}
							</p>
						</div>
						<span class="group relative inline-flex">
							<Button
								variant="ghost"
								size="icon"
								aria-label={i18n.t('portfolio.close')}
								title={i18n.t('portfolio.close')}
								onclick={() => (portfolioModalOpen = false)}
							>
								<XIcon class="size-4 transition-transform group-hover/button:rotate-90" />
							</Button>
							{@render hoverDescription(i18n.t('portfolio.close'))}
						</span>
					</header>

					<div class="max-h-[calc(92vh-4.75rem)] space-y-4 overflow-y-auto overscroll-contain p-4">
						<div class="flex items-center gap-2">
							<div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
								{#each portfolios as portfolio, index (portfolio.id)}
									<span class="group relative inline-flex">
										<Button
											variant={index === activePortfolioIndex ? 'default' : 'outline'}
											size="icon-sm"
											aria-label={i18n.t('portfolio.open', { index: index + 1 })}
											title={i18n.t('portfolio.open', { index: index + 1 })}
											onclick={() => {
												activePortfolioIndex = index;
												portfolioId = portfolio.id;
											}}
										>
											{index + 1}
										</Button>
										{@render hoverDescription(i18n.t('portfolio.open', { index: index + 1 }))}
									</span>
								{/each}
								<span class="group relative inline-flex">
									<Button
										variant="outline"
										size="icon-sm"
										aria-label={i18n.t('portfolio.add')}
										title={i18n.t('portfolio.add')}
										onclick={() => addPortfolio()}
									>
										<PlusIcon class="size-4 transition-transform group-hover/button:rotate-90" />
									</Button>
									{@render hoverDescription(i18n.t('portfolio.add'))}
								</span>
							</div>
							<span class="group relative inline-flex">
								<Button
									variant="ghost"
									size="icon-sm"
									class="hover:text-destructive"
									disabled={!activePortfolio}
									aria-label={i18n.t('portfolio.delete')}
									title={i18n.t('portfolio.delete')}
									onclick={() => deletePortfolio(activePortfolioIndex)}
								>
									<Trash2Icon class="size-4" />
								</Button>
								{@render hoverDescription(i18n.t('portfolio.delete'))}
							</span>
						</div>

						{#if activePortfolio}
							<div class="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
								<div class="space-y-2">
									<Label class="text-xs uppercase">{i18n.t('portfolio.name')}</Label>
									<Input
										value={activePortfolio.name}
										oninput={(e) => updatePortfolioName(e.currentTarget.value)}
									/>
								</div>
								<div class="flex min-h-8 flex-wrap items-center justify-end gap-2">
									<div class="text-muted-foreground text-sm">
										{i18n.t('portfolio.weightTotal', { total: totalPortfolioWeight.toFixed(1) })}
									</div>
									<span class="group relative inline-flex">
										<Button
											variant="outline"
											size="sm"
											disabled={activePortfolio.assets.length === 0}
											aria-label={i18n.t('portfolio.normalize')}
											title={i18n.t('portfolio.normalizeTooltip')}
											onclick={normalizePortfolioWeights}
										>
											<SparklesIcon class="size-3.5" />
											{i18n.t('portfolio.normalize')}
										</Button>
										{@render hoverDescription(i18n.t('portfolio.normalizeTooltip'))}
									</span>
								</div>
							</div>

							<div class="space-y-2">
								<div
									class="text-muted-foreground grid grid-cols-[minmax(0,1fr)_minmax(8rem,14rem)_2rem] gap-2 px-1 text-xs uppercase"
								>
									<span>{i18n.t('portfolio.asset')}</span>
									<span>{i18n.t('portfolio.weight')}</span>
									<span></span>
								</div>
								{#each activePortfolio.assets as asset, index (index)}
									<div class="grid grid-cols-[minmax(0,1fr)_minmax(8rem,14rem)_2rem] gap-2">
										<div
											class="relative min-w-0"
											onfocusout={(e) => {
												const nextTarget = e.relatedTarget;
												if (
													!(nextTarget instanceof Node) ||
													!e.currentTarget.contains(nextTarget)
												) {
													openPortfolioAssetIndex = null;
													portfolioAssetSearch = {
														...portfolioAssetSearch,
														[index]: assetSearchLabel(asset.symbol)
													};
												}
											}}
										>
											<SearchIcon
												class="text-muted-foreground pointer-events-none absolute top-4 left-3 size-4 -translate-y-1/2"
											/>
											<Input
												value={portfolioAssetSearchValue(asset, index)}
												placeholder="AAPL, BTC-USD, EUNL.DE"
												class="pr-9 pl-9"
												role="combobox"
												aria-expanded={openPortfolioAssetIndex === index}
												aria-controls={`portfolio-asset-options-${index}`}
												onfocus={() => (openPortfolioAssetIndex = index)}
												oninput={(e) => updatePortfolioSymbol(index, e.currentTarget.value)}
												onkeydown={(e) => handlePortfolioAssetKeydown(e, index, asset)}
											/>
											<button
												type="button"
												class="text-muted-foreground hover:text-foreground absolute top-4 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md"
												aria-label={i18n.t('ticker.openDropdown')}
												onclick={() =>
													(openPortfolioAssetIndex =
														openPortfolioAssetIndex === index ? null : index)}
											>
												<ChevronDownIcon class="size-4" />
											</button>
											{#if openPortfolioAssetIndex === index}
												<div
													id={`portfolio-asset-options-${index}`}
													class="border-border bg-popover text-popover-foreground absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border p-1 shadow-lg"
													role="listbox"
													tabindex="-1"
												>
													{#if filteredPortfolioAssetOptions(index, asset).length}
														{#each filteredPortfolioAssetOptions(index, asset) as item (item.symbol)}
															<button
																type="button"
																class={cn(
																	'hover:bg-muted focus:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none',
																	item.symbol === asset.symbol && 'bg-muted'
																)}
																role="option"
																aria-selected={item.symbol === asset.symbol}
																onmousedown={(e) => e.preventDefault()}
																onclick={() => applyPortfolioAsset(index, item)}
															>
																<span class="min-w-0 flex-1">
																	<span class="block truncate font-medium">{item.label}</span>
																	<span class="text-muted-foreground block truncate text-xs"
																		>{item.symbol} · {item.category}</span
																	>
																</span>
																{#if item.symbol === asset.symbol}
																	<CheckIcon class="text-primary size-4" />
																{/if}
															</button>
														{/each}
													{:else}
														{#if isTickerLike(portfolioAssetSearchValue(asset, index))}
															<button
																type="button"
																class="hover:bg-muted focus:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none"
																onmousedown={(e) => e.preventDefault()}
																onclick={() => applyCustomPortfolioAsset(index)}
															>
																<span class="min-w-0 flex-1">
																	<span class="block truncate font-medium"
																		>{normalizeTickerSymbol(
																			portfolioAssetSearchValue(asset, index)
																		)}</span
																	>
																	<span class="text-muted-foreground block truncate text-xs"
																		>{i18n.t('ticker.customSymbol')}</span
																	>
																</span>
															</button>
														{:else}
															<span class="text-muted-foreground block px-2 py-3 text-sm">
																{i18n.t('ticker.noResults')}
															</span>
														{/if}
													{/if}
												</div>
											{/if}
											<div class="text-muted-foreground mt-1 truncate px-1 text-xs">
												{asset.label || i18n.t('ticker.customSymbol')}
											</div>
										</div>
										<div class="grid gap-2">
											<Input
												type="number"
												min="0"
												step="0.1"
												value={asset.weight}
												oninput={(e) =>
													updatePortfolioAsset(index, { weight: e.currentTarget.value })}
											/>
											<input
												type="range"
												min="0"
												max="100"
												step="1"
												value={asset.weight}
												aria-label={i18n.t('portfolio.weight')}
												class="accent-primary h-5 w-full cursor-pointer"
												oninput={(e) =>
													updatePortfolioAsset(index, { weight: e.currentTarget.value })}
											/>
										</div>
										<span class="group relative inline-flex">
											<Button
												variant="ghost"
												size="icon"
												class="hover:text-destructive"
												aria-label={i18n.t('portfolio.removeAsset')}
												title={i18n.t('portfolio.removeAsset')}
												onclick={() => removePortfolioAsset(index)}
											>
												<Trash2Icon class="size-4" />
											</Button>
											{@render hoverDescription(i18n.t('portfolio.removeAsset'))}
										</span>
									</div>
								{/each}
							</div>

							<div class="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
								<Button variant="outline" onclick={addPortfolioAsset}>
									<PlusIcon class="size-4" />
									{i18n.t('portfolio.addAsset')}
								</Button>
								<Button
									onclick={() => {
										selectPortfolio(activePortfolio.id);
										portfolioModalOpen = false;
									}}
								>
									<CheckIcon class="size-4" />
									{i18n.t('portfolio.use')}
								</Button>
							</div>
						{:else}
							<div
								class="border-border text-muted-foreground rounded-lg border px-4 py-8 text-center"
							>
								{i18n.t('portfolio.empty')}
							</div>
						{/if}
					</div>
				</section>
			</div>
		{/if}

		{#if comparisonModalOpen}
			<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
				<section
					class="{SURFACE_CLASS.shell} border-border flex max-h-[94vh] w-full max-w-[min(96vw,90rem)] flex-col overflow-hidden overscroll-contain rounded-lg border shadow-2xl"
					aria-labelledby="comparison-title"
					onwheel={(e) => e.stopPropagation()}
					ontouchmove={(e) => e.stopPropagation()}
				>
					<header class="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
						<div class="min-w-0">
							<h2 id="comparison-title" class="truncate text-base font-semibold">
								{i18n.t('comparison.title')}
							</h2>
							<p class="text-muted-foreground truncate text-xs">
								{activeComparison
									? `${comparisonAssetLabel(activeComparison)} · ${activeComparison.period} · ${activeComparison.interval}`
									: i18n.t('comparison.subtitle')}
							</p>
						</div>
						<span class="group relative inline-flex">
							<Button
								variant="ghost"
								size="icon"
								aria-label={i18n.t('comparison.close')}
								title={i18n.t('comparison.close')}
								onclick={() => (comparisonModalOpen = false)}
							>
								<XIcon class="size-4 transition-transform group-hover/button:rotate-90" />
							</Button>
							{@render hoverDescription(i18n.t('comparison.close'))}
						</span>
					</header>

					<div class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
						<div class="flex flex-wrap items-center gap-2">
							<div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
								{#each strategyComparisons as comparison, index (comparison.id)}
									<span class="group relative inline-flex">
										<Button
											variant={index === activeStrategyComparisonIndex ? 'default' : 'outline'}
											size="icon-sm"
											aria-label={i18n.t('comparison.openTab', { index: index + 1 })}
											title={i18n.t('comparison.openTab', { index: index + 1 })}
											onclick={() => (activeStrategyComparisonIndex = index)}
										>
											{index + 1}
										</Button>
										{@render hoverDescription(i18n.t('comparison.openTab', { index: index + 1 }))}
									</span>
								{/each}
								<span class="group relative inline-flex">
									<Button
										variant="outline"
										size="icon-sm"
										aria-label={i18n.t('comparison.add')}
										title={i18n.t('comparison.add')}
										onclick={() => addComparison()}
									>
										<PlusIcon class="size-4 transition-transform group-hover/button:rotate-90" />
									</Button>
									{@render hoverDescription(i18n.t('comparison.add'))}
								</span>
							</div>
							<span class="group relative inline-flex">
								<Button
									variant="outline"
									size="icon-sm"
									aria-label={i18n.t('comparison.duplicate')}
									title={i18n.t('comparison.duplicate')}
									onclick={duplicateComparison}
								>
									<CopyIcon class="size-4" />
								</Button>
								{@render hoverDescription(i18n.t('comparison.duplicate'))}
							</span>
							<span class="group relative inline-flex">
								<Button
									variant="ghost"
									size="icon-sm"
									class="hover:text-destructive"
									disabled={strategyComparisons.length <= 1}
									aria-label={i18n.t('comparison.delete')}
									title={i18n.t('comparison.delete')}
									onclick={deleteComparison}
								>
									<Trash2Icon class="size-4" />
								</Button>
								{@render hoverDescription(i18n.t('comparison.delete'))}
							</span>
						</div>

						{#if activeComparison}
							<div class="grid min-w-0 gap-4 xl:grid-cols-[minmax(21rem,23rem)_minmax(0,1fr)]">
								<div class="min-w-0 space-y-4">
									<div class="space-y-2">
										<Label class="text-xs uppercase">{i18n.t('comparison.name')}</Label>
										<Input
											value={activeComparison.name}
											oninput={(e) => updateActiveComparison({ name: e.currentTarget.value })}
										/>
									</div>

									<div class="{SURFACE_CLASS.inset} space-y-2 rounded-lg p-3 text-sm">
										<div class="text-muted-foreground text-xs uppercase">
											{i18n.t('comparison.context')}
										</div>
										<div class="font-medium">{comparisonAssetLabel(activeComparison)}</div>
										<div class="text-muted-foreground text-xs">
											{activeComparison.period} · {activeComparison.interval} · {formatCurrency(
												parseFloat(activeComparison.startingCapital) || 0
											)}
										</div>
										<Button
											variant="outline"
											size="sm"
											class="min-h-9 w-full text-left leading-snug whitespace-normal"
											onclick={applyCurrentSettingsToComparison}
										>
											<CheckIcon class="size-3.5 shrink-0" />
											{i18n.t('comparison.useCurrent')}
										</Button>
									</div>

									<div class="space-y-2">
										<Label class="text-xs uppercase">{i18n.t('comparison.strategies')}</Label>
										{#each STRATEGIES as strategyType}
											<div class="border-border space-y-2 rounded-lg border p-2">
												<div class="grid grid-cols-[auto_1fr] items-center gap-2">
													<Checkbox
														checked={activeComparison.strategies[strategyType].enabled}
														onCheckedChange={(checked) =>
															updateComparisonStrategy(strategyType, { enabled: checked })}
													/>
													<span class="min-w-0 truncate text-sm">
														{i18n.t(`strategy.${strategyType}` as 'strategy.sma')}
													</span>
												</div>
												<div class="grid grid-cols-2 gap-2">
													{#each getStrategyParamDefinitions(strategyType) as param}
														<label class="min-w-0 space-y-1">
															<span class="text-muted-foreground block truncate text-[11px]">
																{param.label}
															</span>
															<Input
																type="number"
																min={param.min}
																step={param.step}
																value={activeComparison.strategies[strategyType].params[param.key]}
																disabled={!activeComparison.strategies[strategyType].enabled}
																oninput={(e) =>
																	updateComparisonStrategyParam(
																		strategyType,
																		param.key,
																		e.currentTarget.value
																	)}
															/>
														</label>
													{/each}
												</div>
											</div>
										{/each}
									</div>

									<Button
										class="min-h-10 w-full"
										disabled={isComparing}
										onclick={runStrategyComparison}
									>
										{#if isComparing}
											<Loader2Icon class="size-4 animate-spin" />
										{:else}
											<SparklesIcon class="size-4" />
										{/if}
										{i18n.t('comparison.run')}
									</Button>
								</div>

								<div class="min-w-0 space-y-4">
									<StrategyComparisonChart
										series={activeComparison.results.map((run) => ({
											strategy: run.strategy,
											windowSize: run.windowSize,
											paramSummary: formatStrategyParamSummary(
												run.strategy,
												normalizeStrategyParamValues(run.strategy, run.params, run.windowSize)
											),
											capitalHistory: run.result.capital_history
										}))}
									/>

									<div class="{SURFACE_CLASS.table} min-w-0 overflow-x-auto rounded-lg border">
										<Table.Table class="min-w-[46rem]">
											<Table.TableHeader>
												<Table.TableRow>
													<Table.TableHead>{i18n.t('strategy.label')}</Table.TableHead>
													<Table.TableHead>{i18n.t('metric.end')}</Table.TableHead>
													<Table.TableHead>{i18n.t('metric.strategyReturn')}</Table.TableHead>
													<Table.TableHead>{i18n.t('metric.sharpe')}</Table.TableHead>
													<Table.TableHead>{i18n.t('metric.drawdown')}</Table.TableHead>
													<Table.TableHead>{i18n.t('metric.trades')}</Table.TableHead>
													<Table.TableHead>{i18n.t('metric.winRate')}</Table.TableHead>
												</Table.TableRow>
											</Table.TableHeader>
											<Table.TableBody>
												{#if activeComparison.results.length === 0}
													<Table.TableRow>
														<Table.TableCell colspan={7} class="text-muted-foreground text-center">
															{i18n.t('comparison.empty')}
														</Table.TableCell>
													</Table.TableRow>
												{:else}
													{#each activeComparison.results as run (`${run.strategy}-${formatStrategyParamSummary(run.strategy, normalizeStrategyParamValues(run.strategy, run.params, run.windowSize))}`)}
														<Table.TableRow
															class="hover:bg-muted/40 cursor-pointer transition-colors"
															title={i18n.t('comparison.apply')}
															onclick={() => applyComparisonResult(run)}
														>
															<Table.TableCell>
																<div class="space-y-1">
																	<div>{i18n.t(`strategy.${run.strategy}` as 'strategy.sma')}</div>
																	<div class="text-muted-foreground text-xs">
																		{formatStrategyParamSummary(
																			run.strategy,
																			normalizeStrategyParamValues(
																				run.strategy,
																				run.params,
																				run.windowSize
																			)
																		)}
																	</div>
																</div>
															</Table.TableCell>
															<Table.TableCell
																>{formatCurrency(run.result.end_capital)}</Table.TableCell
															>
															<Table.TableCell class={pnlClass(run.result.profit_loss_percent)}>
																{signedPercent(run.result.profit_loss_percent)}
															</Table.TableCell>
															<Table.TableCell>{run.result.sharpe_ratio.toFixed(2)}</Table.TableCell
															>
															<Table.TableCell
																>{run.result.max_drawdown.toFixed(2)}%</Table.TableCell
															>
															<Table.TableCell
																>{run.result.buy_trades + run.result.sell_trades}</Table.TableCell
															>
															<Table.TableCell>{run.result.win_rate.toFixed(1)}%</Table.TableCell>
														</Table.TableRow>
													{/each}
												{/if}
											</Table.TableBody>
										</Table.Table>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</section>
			</div>
		{/if}

		<footer
			class="{SURFACE_CLASS.shell} border-border/60 text-muted-foreground mt-auto space-y-2 border-t px-2 py-4 text-center text-sm sm:px-4 sm:py-6"
		>
			<p class="text-xs font-medium tracking-wide uppercase">{i18n.t('footer.eyebrow')}</p>
			<p>{i18n.t('footer.disclaimer')}</p>
			<p class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
				<a
					href={REPO_URL}
					class="text-primary hover:underline"
					target="_blank"
					rel="noopener noreferrer">{i18n.t('footer.source')}</a
				>
				<span aria-hidden="true">·</span>
				<a
					href="{REPO_URL}/blob/main/LICENSE"
					class="text-primary hover:underline"
					target="_blank"
					rel="noopener noreferrer">{i18n.t('footer.license')}</a
				>
			</p>
		</footer>
	</div>
</Tooltip.TooltipProvider>
