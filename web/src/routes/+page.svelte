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
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import LayersIcon from '@lucide/svelte/icons/layers';
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

	type MetricItem = {
		label: string;
		value: string;
		tone?: string;
		tooltip?: string;
	};

	type AssetCategory = AssetOption['category'];
	type BrandCategory = AssetCategory | 'Custom';

	const CRYPTO_ICON_CODES: Record<string, string> = {
		'BTC-USD': 'btc',
		'ETH-USD': 'eth',
		'SOL-USD': 'sol',
		'BNB-USD': 'bnb',
		'XRP-USD': 'xrp',
		'ADA-USD': 'ada',
		'DOGE-USD': 'doge',
		'AVAX-USD': 'avax',
		'LINK-USD': 'link',
		'DOT-USD': 'dot',
		'TRX-USD': 'trx',
		'LTC-USD': 'ltc',
		'BCH-USD': 'bch',
		'MATIC-USD': 'matic',
		'UNI7083-USD': 'uni',
		'ICP-USD': 'icp',
		'APT21794-USD': 'apt',
		'ARB11841-USD': 'arb',
		'ATOM-USD': 'atom',
		'XLM-USD': 'xlm',
		'XMR-USD': 'xmr',
		'ETC-USD': 'etc',
		'FIL-USD': 'fil'
	};

	const DIRECT_ICON_URLS: Record<string, string> = {
		'TON11419-USD': 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png',
		'APT21794-USD': 'https://assets.coingecko.com/coins/images/26455/small/aptos_round.png',
		'ARB11841-USD': 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg'
	};

	const SIMPLE_ICON_SLUGS: Record<string, string> = {
		AAPL: 'apple',
		NVDA: 'nvidia',
		GOOGL: 'google',
		META: 'meta',
		TSLA: 'tesla',
		AVGO: 'broadcom',
		JPM: 'jpmorgan',
		V: 'visa',
		LLY: 'elililly',
		NVO: 'novonordisk',
		TSM: 'tsmc',
		ASML: 'asml',
		AMD: 'amd',
		INTC: 'intel',
		QCOM: 'qualcomm',
		NFLX: 'netflix',
		ADBE: 'adobe',
		CRM: 'salesforce',
		ORCL: 'oracle',
		CSCO: 'cisco',
		KO: 'cocacola',
		PEP: 'pepsi',
		MCD: 'mcdonalds',
		WMT: 'walmart',
		COST: 'costco',
		PG: 'procterandgamble',
		JNJ: 'johnsonandjohnson',
		XOM: 'exxon',
		CVX: 'chevron',
		BAC: 'bankofamerica',
		MA: 'mastercard',
		PYPL: 'paypal',
		SHOP: 'shopify',
		PLTR: 'palantir',
		ARM: 'arm',
		'SAP.DE': 'sap',
		'SIE.DE': 'siemens',
		'ALV.DE': 'allianz',
		'DTE.DE': 'deutschetelekom',
		'MBG.DE': 'mercedes',
		'BMW.DE': 'bmw',
		'VOW3.DE': 'volkswagen',
		'P911.DE': 'porsche',
		'BAS.DE': 'basf',
		'BAYN.DE': 'bayer',
		'DBK.DE': 'deutschebank',
		'CBK.DE': 'commerzbank',
		'AIR.PA': 'airbus',
		'MC.PA': 'lvmh',
		'RMS.PA': 'hermes',
		'OR.PA': 'loreal',
		'NESN.SW': 'nestle',
		'ROG.SW': 'roche',
		'NOVN.SW': 'novartis',
		'SHEL.L': 'shell',
		'AZN.L': 'astrazeneca',
		TM: 'toyota',
		SONY: 'sony'
	};

	const DOMAIN_ICON_DOMAINS: Record<string, string> = {
		MSFT: 'microsoft.com',
		AMZN: 'amazon.com',
		'BRK-B': 'berkshirehathaway.com',
		UNH: 'unitedhealthgroup.com',
		SMCI: 'supermicro.com',
		'RHM.DE': 'rheinmetall.com',
		'MUV2.DE': 'munichre.com',
		BABA: 'alibaba.com',
		'0700.HK': 'tencent.com',
		SPY: 'ssga.com',
		QQQ: 'invesco.com',
		VTI: 'vanguard.com',
		VT: 'vanguard.com',
		'EUNL.DE': 'ishares.com',
		'IWDA.AS': 'ishares.com',
		'SWDA.L': 'ishares.com',
		'XDWD.DE': 'xtrackers.com',
		'SWRD.L': 'ssga.com',
		'HMWO.L': 'hsbc.com',
		'VWCE.DE': 'vanguard.com',
		'VWRL.AS': 'vanguard.com',
		'SSAC.L': 'ishares.com',
		ACWI: 'ishares.com',
		'IS3N.DE': 'ishares.com',
		'EIMI.L': 'ishares.com',
		'SXR8.DE': 'ishares.com',
		'CSPX.L': 'ishares.com',
		'VUSA.L': 'vanguard.com',
		'VUAA.L': 'vanguard.com',
		'SXRV.DE': 'ishares.com',
		'EQQQ.L': 'invesco.com',
		'2B76.DE': 'ishares.com',
		'2B78.DE': 'ishares.com',
		'QDVE.DE': 'ishares.com',
		'IQQH.DE': 'ishares.com',
		'IH2O.L': 'ishares.com',
		'SMH.L': 'vaneck.com',
		XLF: 'ssga.com',
		XLK: 'ssga.com',
		XLV: 'ssga.com',
		XLE: 'ssga.com',
		XLY: 'ssga.com',
		XLP: 'ssga.com',
		XLI: 'ssga.com',
		XLU: 'ssga.com',
		XLRE: 'ssga.com',
		VEA: 'vanguard.com',
		VWO: 'vanguard.com',
		TLT: 'ishares.com',
		GLD: 'spdrgoldshares.com',
		SLV: 'ishares.com',
		USO: 'uscfinvestments.com',
		'^GSPC': 'spglobal.com',
		'^IXIC': 'nasdaq.com',
		'^DJI': 'spglobal.com',
		'^RUT': 'lseg.com',
		'^VIX': 'cboe.com',
		'^GDAXI': 'deutsche-boerse.com',
		'^STOXX50E': 'stoxx.com',
		'^FTSE': 'lseg.com',
		'^N225': 'nikkei.com',
		'^HSI': 'hangsengindexes.com'
	};

	const ASSET_BRAND_FALLBACKS: Record<string, string> = {
		'BTC-USD': 'BTC',
		'ETH-USD': 'ETH',
		'SOL-USD': 'SOL',
		'BNB-USD': 'BNB',
		'XRP-USD': 'XRP',
		'ADA-USD': 'ADA',
		'DOGE-USD': 'DOGE',
		'AVAX-USD': 'AVAX',
		'LINK-USD': 'LINK',
		'DOT-USD': 'DOT',
		'LTC-USD': 'LTC',
		AAPL: 'A',
		MSFT: 'MS',
		NVDA: 'NV',
		AMZN: 'AM',
		GOOGL: 'G',
		META: 'ME',
		TSLA: 'T',
		SPY: 'SPY',
		QQQ: 'QQQ',
		VTI: 'VTI',
		'^GSPC': 'S&P',
		'^IXIC': 'NDQ',
		'^DJI': 'DJ',
		'EURUSD=X': 'EUR',
		'GBPUSD=X': 'GBP',
		'JPY=X': 'JPY',
		'CHF=X': 'CHF',
		'AUDUSD=X': 'AUD',
		'CAD=X': 'CAD',
		'NZDUSD=X': 'NZD',
		'EURGBP=X': 'EUR',
		'GC=F': 'AU',
		'SI=F': 'AG',
		'CL=F': 'WTI',
		'BZ=F': 'BRN',
		'NG=F': 'NG',
		'HG=F': 'CU',
		'ZC=F': 'CORN',
		'ZS=F': 'SOY'
	};

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
	let portfolioDropdownOpen = $state(false);
	let portfolioAssetSearch = $state<Record<number, string>>({});
	let openPortfolioAssetIndex = $state<number | null>(null);
	let period = $state<Period>(initialSimulation.period);
	let interval = $state<Interval>(initialSimulation.interval);
	let csvText = $state(initialSimulation.csvText);
	let strategy = $state<StrategyType>(initialSimulation.strategy);
	let windowSize = $state(initialSimulation.windowSize);
	let startingCapital = $state(initialSimulation.startingCapital);
	let feeRate = $state(initialSimulation.feeRate);
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

	let persistTimeout: ReturnType<typeof setTimeout> | undefined;
	let activeRequestId = 0;
	let activeOptimizeRequestId = 0;

	// ponytail: feature flag for the parameter optimizer panel
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
	const assetSelectionActive = $derived(dataSource === 'api' && ticker.trim().length >= 2);
	const portfolioSelectionActive = $derived(dataSource === 'portfolio' && portfolioId !== null);
	const activePortfolio = $derived(portfolios[activePortfolioIndex] ?? null);
	const activeComparison = $derived(strategyComparisons[activeStrategyComparisonIndex] ?? null);
	const selectedPortfolio = $derived(
		portfolioId ? (portfolios.find((portfolio) => portfolio.id === portfolioId) ?? null) : null
	);
	const portfolioDropdownOptions = $derived(
		portfolios
			.map((portfolio, index) => ({ portfolio, index }))
			.filter(({ portfolio }) => !portfolioSelectionActive || portfolio.id !== portfolioId)
	);
	const activeContextLabel = $derived.by(() => {
		if (dataSource === 'csv') return i18n.t('active.customCsv');
		if (selectedPortfolio) return selectedPortfolio.name;
		if (selectedAsset) return selectedAsset.label;
		return ticker || i18n.t('results.empty');
	});
	const activeContextSummary = $derived(
		`${activeContextLabel} · ${i18n.t(`period.${period}` as 'period.1y')} · ${i18n.t(`strategy.${strategy}` as 'strategy.sma')}`
	);
	const resultContextSummary = $derived.by(() => {
		if (!result || !runSnapshot) return activeContextSummary;
		const parts = [runSnapshot.asset];
		if (runSnapshot.period !== '-') parts.push(runSnapshot.period);
		parts.push(runSnapshot.strategy);
		return parts.join(' · ');
	});
	const totalPortfolioWeight = $derived(
		activePortfolio?.assets.reduce((sum, asset) => sum + (parseFloat(asset.weight) || 0), 0) ?? 0
	);
	const primaryMetrics = $derived.by<MetricItem[]>(() =>
		result
			? [
					{
						label: i18n.t('metric.end'),
						value: formatCurrency(result.end_capital)
					},
					{
						label: i18n.t('metric.profit'),
						value: signedCurrency(result.profit_loss),
						tone: pnlClass(result.profit_loss)
					},
					{
						label: i18n.t('metric.strategyReturn'),
						value: signedPercent(result.profit_loss_percent),
						tone: pnlClass(result.profit_loss_percent),
						tooltip: i18n.t('metric.strategyReturnTooltip')
					}
				]
			: []
	);
	const secondaryMetrics = $derived.by<MetricItem[]>(() =>
		result
			? [
					{
						label: i18n.t('metric.start'),
						value: formatCurrency(result.start_capital)
					},
					{
						label: i18n.t('metric.buyHold'),
						value: signedPercent(result.buy_and_hold_return),
						tone: pnlClass(result.buy_and_hold_return),
						tooltip: i18n.t('metric.buyHoldTooltip')
					},
					{
						label: i18n.t('metric.sharpe'),
						value: result.sharpe_ratio.toFixed(2),
						tooltip: i18n.t('metric.sharpeTooltip')
					},
					{
						label: i18n.t('metric.drawdown'),
						value: `${result.max_drawdown.toFixed(2)}%`,
						tooltip: i18n.t('metric.drawdownTooltip')
					},
					{
						label: i18n.t('metric.winRate'),
						value: `${result.win_rate.toFixed(1)}%`,
						tooltip: i18n.t('metric.winRateTooltip')
					},
					{
						label: i18n.t('metric.trades'),
						value: i18n.t('trade.count', {
							total: result.buy_trades + result.sell_trades,
							buy: result.buy_trades,
							sell: result.sell_trades
						})
					}
				]
			: []
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
			autoRun: false,
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
			autoRun: false,
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
		portfolioDropdownOpen = false;
		period = simulation.period;
		interval = simulation.interval;
		csvText = simulation.csvText;
		strategy = simulation.strategy;
		windowSize = simulation.windowSize;
		startingCapital = simulation.startingCapital;
		feeRate = simulation.feeRate;
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
		ticker = '';
		assetSearch = '';
		assetDropdownOpen = false;
		portfolioDropdownOpen = false;
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

	function portfolioWeightValue(weight: string): number {
		return Math.max(parseFloat(weight) || 0, 0);
	}

	function portfolioWeightLimit(index: number): number {
		if (!activePortfolio) return 100;
		const otherTotal = activePortfolio.assets.reduce(
			(sum, asset, assetIndex) =>
				assetIndex === index ? sum : sum + portfolioWeightValue(asset.weight),
			0
		);
		return Math.max(0, 100 - otherTotal);
	}

	function clampPortfolioWeight(index: number, weight: string): string {
		const clamped = Math.min(portfolioWeightValue(weight), portfolioWeightLimit(index));
		return formatWeight(clamped);
	}

	function updatePortfolioAsset(index: number, patch: Partial<PortfolioAsset>) {
		if (!activePortfolio) return;
		const nextPatch =
			patch.weight === undefined
				? patch
				: { ...patch, weight: clampPortfolioWeight(index, patch.weight) };
		const assets = activePortfolio.assets.map((asset, i) =>
			i === index ? { ...asset, ...nextPatch } : asset
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
			return;
		}
		portfolioId = id;
		assetDropdownOpen = false;
		portfolioDropdownOpen = false;
		dataSource = 'portfolio';
	}

	function selectedPortfolioLabel(): string {
		return selectedPortfolio?.name ?? i18n.t('portfolio.noneSelected');
	}

	function selectedPortfolioAssetCount(): string {
		return selectedPortfolio
			? i18n.t('portfolio.assetCount', { count: selectedPortfolio.assets.length })
			: i18n.t('portfolio.empty');
	}

	function selectDataSource(next: 'market' | 'csv') {
		if (next === 'csv') {
			clearTickerPriceCache();
			assetDropdownOpen = false;
			dataSource = 'csv';
			return;
		}

		dataSource = portfolioId ? 'portfolio' : 'api';
	}

	function selectTickerMode() {
		portfolioId = null;
		dataSource = 'api';
		assetSearch = ticker ? assetSearchLabel(ticker) : '';
		assetDropdownOpen = false;
		portfolioDropdownOpen = false;
	}

	function selectPortfolioMode() {
		ticker = '';
		assetSearch = '';
		assetDropdownOpen = false;
		portfolioDropdownOpen = false;
		dataSource = 'portfolio';
		if (!portfolioId && portfolios[activePortfolioIndex]) {
			portfolioId = portfolios[activePortfolioIndex].id;
		}
	}

	function clearAssetSelection() {
		ticker = '';
		assetSearch = '';
		assetDropdownOpen = false;
		dataSource = 'api';
		schedulePersist();
	}

	function clearPortfolioSelection() {
		portfolioId = null;
		dataSource = 'portfolio';
		portfolioDropdownOpen = false;
		schedulePersist();
	}

	function findAssetOption(symbol: string): AssetOption | undefined {
		const normalized = symbol.trim().toUpperCase();
		return ASSET_OPTIONS.find((asset) => asset.symbol.toUpperCase() === normalized);
	}

	function assetBrandCategory(symbol: string, fallback: BrandCategory = 'Custom'): BrandCategory {
		return findAssetOption(symbol)?.category ?? fallback;
	}

	function assetBrandIconUrl(symbol: string): string | null {
		const normalized = normalizeTickerSymbol(symbol);
		const directUrl = DIRECT_ICON_URLS[normalized];
		if (directUrl) return directUrl;

		const cryptoCode = CRYPTO_ICON_CODES[normalized];
		if (cryptoCode) {
			return `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${cryptoCode}.svg`;
		}

		const simpleIconSlug = SIMPLE_ICON_SLUGS[normalized];
		if (simpleIconSlug) return `https://cdn.simpleicons.org/${simpleIconSlug}`;

		const domain = DOMAIN_ICON_DOMAINS[normalized];
		if (domain) {
			return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
		}

		return null;
	}

	function assetBrandText(symbol: string, label = ''): string {
		const normalized = normalizeTickerSymbol(symbol);
		const known = ASSET_BRAND_FALLBACKS[normalized];
		if (known) return known;
		if (normalized.startsWith('^')) return normalized.replace(/^\^/, '').slice(0, 3);
		if (normalized.endsWith('=X')) return 'FX';
		if (normalized.endsWith('=F')) return 'CMD';

		const cleanSymbol = normalized.replace(/[^A-Z0-9]/g, '');
		const source = label || cleanSymbol;
		const initials = source
			.split(/\s+/)
			.filter(Boolean)
			.map((part) => part[0])
			.join('')
			.slice(0, 3);
		return (initials || cleanSymbol.slice(0, 3) || '?').toUpperCase();
	}

	function assetOptionLabel(asset: AssetOption): string {
		return `${asset.label} (${asset.symbol})`;
	}

	function assetSearchLabel(symbol: string): string {
		const asset = findAssetOption(symbol);
		return asset ? assetOptionLabel(asset) : symbol;
	}

	function normalizeTickerSymbol(value: string): string {
		return value.trim().toUpperCase();
	}

	function isTickerLike(value: string): boolean {
		return /^[A-Z0-9.^=-]{2,18}$/.test(normalizeTickerSymbol(value));
	}

	function normalizeAssetSearchTerm(value: string): string {
		return value.trim().toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ');
	}

	function isAssetDisplayLabel(query: string): boolean {
		const normalized = normalizeAssetSearchTerm(query);
		return ASSET_OPTIONS.some(
			(asset) => normalized === normalizeAssetSearchTerm(assetOptionLabel(asset))
		);
	}

	function filterAssetOptions(query: string): AssetOption[] {
		const normalized = normalizeAssetSearchTerm(query);
		if (!normalized || isAssetDisplayLabel(query)) return ASSET_OPTIONS;
		const tokens = normalized.split(' ').filter(Boolean);
		return ASSET_OPTIONS.filter((asset) => {
			const haystack = normalizeAssetSearchTerm(
				`${asset.label} ${asset.symbol} ${asset.category} ${asset.aliases?.join(' ') ?? ''}`
			);
			return tokens.every((token) => haystack.includes(token));
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
			autoRun: false,
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
		result = null;
		runSnapshot = null;
		analytics = null;
		optimizeRuns = [];
		selectedPointIndex = null;
		selectedTradeIndex = null;
		setStatus(i18n.t('settings.resetDone'), 'info');
		persistDashboard();
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
		const runDataSource = dataSource;
		const runTicker = ticker.trim().toUpperCase();
		const runSelectedAsset = findAssetOption(runTicker);
		const runSelectedPortfolio = selectedPortfolio;
		const runPeriod = period;
		const runInterval = interval;
		const runStrategy = strategy;
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
			const isApi = runDataSource === 'api';
			const isPortfolio = runDataSource === 'portfolio';

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
					? (runSelectedAsset?.label ?? runTicker)
					: isPortfolio
						? (runSelectedPortfolio?.name ?? i18n.t('source.portfolio'))
						: i18n.t('active.customCsv'),
				period: isApi || isPortfolio ? runPeriod : '-',
				interval: isApi || isPortfolio ? runInterval : '-',
				strategy: i18n.t(`strategy.${runStrategy}` as 'strategy.sma'),
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
	}

	function applyCustomTicker() {
		if (!isTickerLike(assetSearch)) return;
		const symbol = normalizeTickerSymbol(assetSearch);
		ticker = symbol;
		portfolioId = null;
		dataSource = 'api';
		assetSearch = assetSearchLabel(symbol);
		assetDropdownOpen = false;
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
		}
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

{#snippet assetBrandMark(
	symbol: string,
	label = '',
	category: BrandCategory = 'Custom',
	size: 'xs' | 'sm' | 'md' = 'md'
)}
	{@const iconUrl = assetBrandIconUrl(symbol)}
	<span
		class={cn('brand-mark', `brand-mark-${size}`, iconUrl && 'brand-mark-has-icon')}
		data-category={category}
		aria-hidden="true"
	>
		{#if iconUrl}
			<img
				class="brand-mark-img"
				src={iconUrl}
				alt=""
				loading="lazy"
				decoding="async"
				onerror={(e) => {
					e.currentTarget.parentElement?.setAttribute('data-icon-failed', 'true');
				}}
			/>
		{/if}
		<span class="brand-mark-fallback">{assetBrandText(symbol, label)}</span>
	</span>
{/snippet}

<Tooltip.TooltipProvider delayDuration={1000}>
	<div class="flex min-h-screen min-w-0 flex-col">
		<header class="{SURFACE_CLASS.shell} border-border/60 sticky top-0 z-30 border-b">
			<div
				class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:px-6"
			>
				<div class="min-w-0">
					<h1
						class="text-primary flex min-w-0 items-baseline gap-1.5 text-lg leading-tight font-semibold tracking-normal"
					>
						<span class="shrink-0">MacroSignal</span>
						<span class="text-muted-foreground hidden truncate text-xs font-medium sm:inline"
							>{i18n.t('header.productSuffix')}</span
						>
					</h1>
				</div>

				<div class="flex shrink-0 items-center justify-end gap-2">
					<ExportMenu {result} snapshot={runSnapshot} onError={(msg) => setStatus(msg, 'error')} />
					<Tabs.Tabs
						value={i18n.lang}
						onValueChange={(value) => i18n.setLanguage(value as Lang)}
						aria-label={i18n.t('language.aria')}
					>
						<Tabs.TabsList class="language-switch h-8">
							<Tabs.TabsTrigger value="de" class="language-switch-option">DE</Tabs.TabsTrigger>
							<Tabs.TabsTrigger value="en" class="language-switch-option">EN</Tabs.TabsTrigger>
						</Tabs.TabsList>
					</Tabs.Tabs>
				</div>
			</div>
		</header>

		<main
			class="mx-auto grid w-full max-w-7xl flex-1 items-start gap-3 px-3 py-4 sm:gap-4 sm:px-4 sm:py-5 lg:grid-cols-[minmax(20rem,22rem)_minmax(0,1fr)] lg:gap-5 lg:px-6"
		>
			<Card.Card aria-labelledby="controls-title" class="settings-card">
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
				<Card.CardContent class="settings-card-body">
					<div class="run-zone border-t-0 pt-0">
						<Button class="min-h-11 w-full text-sm font-semibold" onclick={runBacktest}>
							{#if isInitialLoad}
								<Loader2Icon class="size-4 animate-spin" />
							{/if}
							{i18n.t('action.run')}
						</Button>

						{#if statusMessage}
							<div class="status-message" data-type={statusType} role="status" aria-live="polite">
								<span class="stable-icon-slot mt-0.5">
									{#if statusType === 'success'}
										<CheckIcon class="size-3.5" />
									{:else if statusType === 'error'}
										<XIcon class="size-3.5" />
									{/if}
								</span>
								<span>{statusMessage}</span>
							</div>
						{/if}
					</div>

					<div class="settings-block">
						<div class="settings-block-header">
							<span class="settings-eyebrow">
								{i18n.t('simulation.label')}
							</span>
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
						<div class="flex items-center gap-2">
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
									variant="outline"
									size="icon-sm"
									class="hover:text-destructive"
									disabled={simulations.length <= 1}
									aria-label={simulations.length > 1
										? i18n.t('simulation.delete')
										: i18n.t('simulation.deleteDisabled')}
									title={simulations.length > 1
										? i18n.t('simulation.delete')
										: i18n.t('simulation.deleteDisabled')}
									onclick={deleteActiveSimulation}
								>
									<Trash2Icon class="size-4" />
								</Button>
								{@render hoverDescription(
									simulations.length > 1
										? i18n.t('simulation.delete')
										: i18n.t('simulation.deleteDisabled')
								)}
							</span>
						</div>
					</div>
					<div class="settings-block">
						<div class="settings-block-header">
							<Label class="settings-eyebrow flex items-center gap-1.5">
								{i18n.t('source.label')}
								<Tooltip.Root>
									<Tooltip.Trigger class="inline-flex">
										<CircleHelpIcon class="text-muted-foreground size-3.5" />
									</Tooltip.Trigger>
									<Tooltip.Content>{i18n.t('source.tooltip')}</Tooltip.Content>
								</Tooltip.Root>
							</Label>
						</div>
						<Tabs.Tabs
							value={sourceTab}
							onValueChange={(value) => selectDataSource(value === 'csv' ? 'csv' : 'market')}
						>
							<Tabs.TabsList class="binary-switch h-10 w-full" aria-label={i18n.t('source.label')}>
								<Tabs.TabsTrigger value="market" class="binary-switch-option">
									<SearchIcon class="size-4" />
									<span>{i18n.t('source.market')}</span>
								</Tabs.TabsTrigger>
								<Tabs.TabsTrigger value="csv" class="binary-switch-option">
									<FileTextIcon class="size-4" />
									<span>{i18n.t('source.csv')}</span>
								</Tabs.TabsTrigger>
							</Tabs.TabsList>
							<p class="switch-context">
								{sourceTab === 'csv' ? i18n.t('source.csvHint') : i18n.t('source.marketHint')}
							</p>

							<Tabs.TabsContent value="market" class="mt-3 space-y-3">
								<div
									class="binary-switch h-10"
									role="radiogroup"
									aria-label={i18n.t('source.assetModeAria')}
								>
									<button
										type="button"
										class="binary-switch-option"
										data-active={dataSource !== 'portfolio'}
										role="radio"
										aria-checked={dataSource !== 'portfolio'}
										onclick={selectTickerMode}
									>
										<SearchIcon class="size-4" />
										<span>{i18n.t('ticker.label')}</span>
									</button>
									<button
										type="button"
										class="binary-switch-option"
										data-active={dataSource === 'portfolio'}
										role="radio"
										aria-checked={dataSource === 'portfolio'}
										onclick={selectPortfolioMode}
									>
										<LayersIcon class="size-4" />
										<span>{i18n.t('source.portfolio')}</span>
									</button>
								</div>
								<p class="switch-context">
									{dataSource === 'portfolio'
										? i18n.t('portfolio.modeHint')
										: i18n.t('ticker.modeHint')}
								</p>

								{#if dataSource !== 'portfolio'}
									<div class="mode-panel">
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
											{#if assetSelectionActive}
												<Button variant="ghost" size="sm" onclick={clearAssetSelection}>
													<XIcon class="size-3.5" />
													{i18n.t('selection.clearAsset')}
												</Button>
											{/if}
										</div>
										<div class="grid gap-2">
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
													onfocus={(e) => {
														assetDropdownOpen = true;
														e.currentTarget.select();
													}}
													oninput={(e) => {
														handleAssetSearchInput(e.currentTarget.value);
													}}
													onkeydown={handleAssetKeydown}
												/>
												<button
													type="button"
													class="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md"
													aria-label={i18n.t('ticker.openDropdown')}
													onclick={() => (assetDropdownOpen = !assetDropdownOpen)}
												>
													<ChevronDownIcon class="size-4" />
												</button>
												{#if assetDropdownOpen}
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
																	{@render assetBrandMark(item.symbol, item.label, item.category)}
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
																	{@render assetBrandMark(
																		normalizeTickerSymbol(assetSearch),
																		i18n.t('ticker.customSymbol')
																	)}
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
										</div>
										{#if assetSelectionActive}
											<div class="selected-source-summary">
												<div class="flex min-w-0 items-center gap-2">
													{@render assetBrandMark(
														ticker,
														selectedAsset?.label ?? ticker,
														assetBrandCategory(ticker, selectedAsset?.category ?? 'Custom'),
														'sm'
													)}
													<span class="min-w-0">
														<span class="block truncate text-sm font-medium">
															{selectedAsset?.label ?? ticker}
														</span>
														<span class="text-muted-foreground block truncate text-xs">
															{selectedAsset
																? `${selectedAsset.category} · ${selectedAsset.symbol}`
																: `${i18n.t('ticker.customSymbol')} · ${ticker}`}
														</span>
													</span>
												</div>
												<span class="shrink-0">{ASSET_OPTIONS.length} Presets</span>
											</div>
										{/if}
									</div>
								{:else}
									<div class="mode-panel">
										<div class="flex items-center justify-between gap-2">
											<Label class="text-xs uppercase">{i18n.t('portfolio.select')}</Label>
											<div class="flex shrink-0 items-center gap-1.5">
												{#if portfolioSelectionActive}
													<Button
														variant="ghost"
														size="icon-sm"
														aria-label={i18n.t('selection.clearPortfolio')}
														title={i18n.t('selection.clearPortfolio')}
														onclick={clearPortfolioSelection}
													>
														<XIcon class="size-3.5" />
													</Button>
												{/if}
												<Button
													variant="outline"
													size="icon-sm"
													aria-label={portfolios.length
														? i18n.t('portfolio.edit')
														: i18n.t('portfolio.create')}
													title={portfolios.length
														? i18n.t('portfolio.edit')
														: i18n.t('portfolio.create')}
													onclick={() => {
														if (portfolios.length === 0) addPortfolio();
														portfolioModalOpen = true;
													}}
												>
													{#if portfolios.length}
														<PencilIcon class="size-3.5" />
													{:else}
														<PlusIcon class="size-3.5" />
													{/if}
												</Button>
											</div>
										</div>

										<div
											class="relative min-w-0"
											onfocusout={(e) => {
												const nextTarget = e.relatedTarget;
												if (
													!(nextTarget instanceof Node) ||
													!e.currentTarget.contains(nextTarget)
												) {
													portfolioDropdownOpen = false;
												}
											}}
										>
											<button
												type="button"
												class="border-input bg-input/88 focus-visible:border-ring focus-visible:ring-ring/50 flex h-12 w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none focus-visible:ring-3"
												role="combobox"
												aria-expanded={portfolioDropdownOpen}
												aria-controls="portfolio-options"
												onclick={() => {
													portfolioDropdownOpen = !portfolioDropdownOpen;
												}}
											>
												{#if selectedPortfolio}
													<span class="portfolio-brand-stack" aria-hidden="true">
														{#each selectedPortfolio.assets.slice(0, 3) as asset, assetIndex (`selected-trigger-${asset.symbol}-${assetIndex}`)}
															{@render assetBrandMark(
																asset.symbol,
																asset.label,
																assetBrandCategory(asset.symbol),
																'xs'
															)}
														{/each}
													</span>
												{:else}
													<LayersIcon class="text-muted-foreground size-4 shrink-0" />
												{/if}
												<span class="min-w-0 flex-1">
													<span class="block truncate font-medium">{selectedPortfolioLabel()}</span>
													<span class="text-muted-foreground block truncate text-xs">
														{selectedPortfolioAssetCount()}
													</span>
												</span>
												<ChevronDownIcon class="text-muted-foreground size-4 shrink-0" />
											</button>

											{#if portfolioDropdownOpen}
												<div
													id="portfolio-options"
													class="border-border bg-popover text-popover-foreground absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border p-1 shadow-lg"
													role="listbox"
													tabindex="-1"
												>
													{#if portfolioDropdownOptions.length}
														{#each portfolioDropdownOptions as { portfolio, index } (portfolio.id)}
															<button
																type="button"
																class={cn(
																	'hover:bg-muted focus:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none',
																	portfolio.id === portfolioId &&
																		portfolioSelectionActive &&
																		'bg-muted'
																)}
																role="option"
																aria-selected={portfolio.id === portfolioId &&
																	portfolioSelectionActive}
																onmousedown={(e) => e.preventDefault()}
																onclick={() => {
																	activePortfolioIndex = index;
																	selectPortfolio(portfolio.id);
																}}
															>
																<span class="portfolio-brand-stack" aria-hidden="true">
																	{#each portfolio.assets.slice(0, 3) as asset, assetIndex (`${portfolio.id}-${asset.symbol}-${assetIndex}`)}
																		{@render assetBrandMark(
																			asset.symbol,
																			asset.label,
																			assetBrandCategory(asset.symbol),
																			'xs'
																		)}
																	{/each}
																</span>
																<span class="min-w-0 flex-1">
																	<span class="block truncate font-medium">{portfolio.name}</span>
																	<span class="text-muted-foreground block truncate text-xs">
																		{i18n.t('portfolio.assetCount', {
																			count: portfolio.assets.length
																		})}
																	</span>
																</span>
																{#if portfolio.id === portfolioId && portfolioSelectionActive}
																	<CheckIcon class="text-primary size-4 shrink-0" />
																{/if}
															</button>
														{/each}
													{:else if portfolios.length === 0}
														<button
															type="button"
															class="hover:bg-muted focus:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none"
															onmousedown={(e) => e.preventDefault()}
															onclick={() => {
																addPortfolio();
																portfolioDropdownOpen = false;
																portfolioModalOpen = true;
															}}
														>
															<PlusIcon class="text-primary size-4 shrink-0" />
															<span class="min-w-0 flex-1">
																<span class="block truncate font-medium"
																	>{i18n.t('portfolio.create')}</span
																>
																<span class="text-muted-foreground block truncate text-xs">
																	{i18n.t('portfolio.empty')}
																</span>
															</span>
														</button>
													{:else}
														<span class="text-muted-foreground block px-2 py-3 text-sm">
															{i18n.t('portfolio.noOtherOptions')}
														</span>
													{/if}
												</div>
											{/if}
										</div>
									</div>
								{/if}
								<div class="border-border/70 grid grid-cols-2 gap-3 border-t pt-3">
									<div class="space-y-2">
										<Label class="text-xs uppercase">{i18n.t('period.label')}</Label>
										<PeriodSelect bind:value={period} />
									</div>
									<div class="space-y-2">
										<Label class="text-xs uppercase">{i18n.t('interval.label')}</Label>
										<IntervalSelect bind:value={interval} />
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
								></textarea>
							</Tabs.TabsContent>
						</Tabs.Tabs>
					</div>

					<div class="settings-block space-y-3">
						<div class="space-y-2">
							<Label class="settings-eyebrow flex items-center gap-1.5">
								{i18n.t('strategy.label')}
								<Tooltip.Root>
									<Tooltip.Trigger class="inline-flex">
										<CircleHelpIcon class="text-muted-foreground size-3.5" />
									</Tooltip.Trigger>
									<Tooltip.Content>{i18n.t('strategy.tooltip')}</Tooltip.Content>
								</Tooltip.Root>
							</Label>
							<StrategySelect bind:value={strategy} />
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
							<Input type="number" min="1" bind:value={windowSize} />
						</div>
					</div>

					<!--
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
	-->
					<details class="settings-disclosure">
						<summary>
							<span>{i18n.t('settings.advanced')}</span>
							<ChevronDownIcon class="settings-disclosure-chevron size-4 shrink-0" />
						</summary>
						<div class="space-y-4 pt-3">
							<div class="settings-block">
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
									<Input type="number" min="1" class="min-w-0" bind:value={startingCapital} />
									<Input type="number" min="0" step="0.01" class="min-w-0" bind:value={feeRate} />
								</div>
							</div>

							<!-- ponytail: archived — parameter optimizer UI; restore with OPTIMIZER_ENABLED -->
							{#if OPTIMIZER_ENABLED}
								<div class="settings-block space-y-3">
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
											<div class="surface-inset flex min-h-20 items-center rounded-lg px-3">
												<p class="text-muted-foreground text-xs">{i18n.t('optimizer.empty')}</p>
											</div>
										{/if}
									{:else}
										<div class="relative overflow-hidden rounded-lg">
											<div
												class="refresh-pending overflow-x-auto"
												data-pending={isOptimizingRefresh}
											>
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
						</div>
					</details>
				</Card.CardContent>
			</Card.Card>

			<Card.Card aria-labelledby="results-title">
				<Card.CardHeader class="flex-row items-start justify-between border-b [.border-b]:pb-4">
					<div class="space-y-1">
						<Card.CardTitle id="results-title" class="text-base"
							>{i18n.t('results.title')}</Card.CardTitle
						>
						<Card.CardDescription class={STABLE_CLASS.subtitle}>
							{isInitialLoad ? i18n.t('status.running') : resultContextSummary}
						</Card.CardDescription>
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
								class="refresh-pending grid gap-2 sm:grid-cols-3"
								data-pending={isRefreshing}
								aria-label={i18n.t('metrics.aria')}
							>
								{#each primaryMetrics as metric (metric.label)}
									<div class="metric-cell metric-cell-primary">
										<span class="metric-label">
											{metric.label}
											{#if metric.tooltip}
												<Tooltip.Root>
													<Tooltip.Trigger class="inline-flex">
														<CircleHelpIcon class="size-3" />
													</Tooltip.Trigger>
													<Tooltip.Content>{metric.tooltip}</Tooltip.Content>
												</Tooltip.Root>
											{/if}
										</span>
										<span class={cn('metric-value', metric.tone)}>{metric.value}</span>
									</div>
								{/each}
							</div>

							<div
								class="refresh-pending grid grid-cols-2 gap-2 md:grid-cols-3"
								data-pending={isRefreshing}
							>
								{#each secondaryMetrics as metric (metric.label)}
									<div class="metric-cell min-h-20">
										<span class="metric-label">
											{metric.label}
											{#if metric.tooltip}
												<Tooltip.Root>
													<Tooltip.Trigger class="inline-flex">
														<CircleHelpIcon class="size-3" />
													</Tooltip.Trigger>
													<Tooltip.Content>{metric.tooltip}</Tooltip.Content>
												</Tooltip.Root>
											{/if}
										</span>
										<span class={cn('metric-value', metric.tone)}>{metric.value}</span>
									</div>
								{/each}
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
						{#if isInitialLoad}
							<ResultsSkeleton />
						{:else}
							<div class="empty-workspace">
								<SearchIcon class="text-primary mb-3 size-5" />
								<p class="text-foreground text-sm font-medium">{i18n.t('results.emptyTitle')}</p>
								<p class="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
									{i18n.t('results.emptyHint')}
								</p>
							</div>
						{/if}
					{/if}
				</Card.CardContent>
			</Card.Card>

			<Card.Card class="lg:col-span-2">
				<Card.CardContent class="pt-6">
					<AnalysisPanel
						{analytics}
						loading={!analytics && (isInitialLoad || isRunning)}
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
							<Table.Table class={result?.trades.length ? 'sm:min-w-[42rem]' : ''}>
								<Table.TableHeader class="bg-background/95 sticky top-0 z-10 backdrop-blur-sm">
									<Table.TableRow>
										{#each TRADE_COLUMNS as column (column.key)}
											<Table.TableHead
												class={cn(
													(column.key === 'fee' || column.key === 'cashBalance') &&
														'hidden sm:table-cell'
												)}
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
												<Table.TableCell class="hidden font-mono sm:table-cell"
													>{formatCurrency(trade.fee)}</Table.TableCell
												>
												<Table.TableCell class="hidden font-mono sm:table-cell"
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
				<div
					class="{SURFACE_CLASS.shell} border-border max-h-[92vh] w-full max-w-3xl overflow-hidden overscroll-contain rounded-lg border shadow-2xl"
					role="dialog"
					aria-modal="true"
					aria-labelledby="portfolio-title"
					tabindex="-1"
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
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<Button
													{...props}
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
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content
											side="top"
											sideOffset={8}
											class="max-w-72 text-left leading-snug whitespace-normal"
										>
											{i18n.t('portfolio.normalizeTooltip')}
										</Tooltip.Content>
									</Tooltip.Root>
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
												onfocus={(e) => {
													openPortfolioAssetIndex = index;
													e.currentTarget.select();
												}}
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
																{@render assetBrandMark(item.symbol, item.label, item.category)}
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
																{@render assetBrandMark(
																	normalizeTickerSymbol(portfolioAssetSearchValue(asset, index)),
																	i18n.t('ticker.customSymbol')
																)}
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
											<div
												class="text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5 px-1 text-xs"
											>
												{@render assetBrandMark(
													asset.symbol,
													asset.label,
													assetBrandCategory(asset.symbol),
													'xs'
												)}
												<span class="truncate">{asset.label || i18n.t('ticker.customSymbol')}</span>
											</div>
										</div>
										<div class="grid gap-2">
											<Input
												type="number"
												min="0"
												max={portfolioWeightLimit(index)}
												step="0.1"
												value={asset.weight}
												oninput={(e) =>
													updatePortfolioAsset(index, { weight: e.currentTarget.value })}
											/>
											<input
												type="range"
												min="0"
												max={portfolioWeightLimit(index)}
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
				</div>
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
