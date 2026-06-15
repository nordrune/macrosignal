<script lang="ts">
	import AnalysisPanel from '$lib/components/AnalysisPanel.svelte';
	import ExportMenu from '$lib/components/ExportMenu.svelte';
	import IntervalSelect from '$lib/components/IntervalSelect.svelte';
	import ResultsSkeleton from '$lib/components/ResultsSkeleton.svelte';
	import TableSkeleton from '$lib/components/TableSkeleton.svelte';
	import PeriodSelect from '$lib/components/PeriodSelect.svelte';
	import PriceChart from '$lib/components/PriceChart.svelte';
	import RefreshOverlay from '$lib/components/RefreshOverlay.svelte';
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
		writeDashboardState
	} from '$lib/dashboard-state';
	import {
		capPricePoints,
		DEFAULT_FEE_PERCENT,
		DEFAULT_STARTING_CAPITAL,
		MAX_TRADE_TABLE_ROWS,
		TICKER_SUGGESTIONS
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
		getLegendConfig,
		getStrategyParams,
		type StrategyType
	} from '$lib/strategy';
	import type { DataSource, Interval, Period, StatusType } from '$lib/types';
	import { REPO_URL } from '$lib/site';
	import { cn } from '$lib/utils';
	import { onMount } from 'svelte';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';

	const TRADE_COLUMNS: { key: TradeSortKey; label: StringKey }[] = [
		{ key: 'date', label: 'table.date' },
		{ key: 'type', label: 'table.action' },
		{ key: 'price', label: 'table.price' },
		{ key: 'units', label: 'table.units' },
		{ key: 'fee', label: 'table.fee' },
		{ key: 'cashBalance', label: 'table.cash' }
	];

	const i18n = getI18n();
	const saved = readDashboardState();

	let dataSource = $state<DataSource>(saved.dataSource ?? 'api');
	let ticker = $state(saved.ticker ?? 'BTC-USD');
	let period = $state<Period>(saved.period ?? '1y');
	let interval = $state<Interval>(saved.interval ?? '1d');
	let csvText = $state(saved.csvText ?? SAMPLE_CSV);
	let strategy = $state<StrategyType>(saved.strategy ?? 'sma');
	let windowSize = $state(saved.windowSize ?? String(DEFAULT_WINDOW));
	let startingCapital = $state(saved.startingCapital ?? String(DEFAULT_STARTING_CAPITAL));
	let feeRate = $state(saved.feeRate ?? String(DEFAULT_FEE_PERCENT));
	let autoRun = $state(saved.autoRun ?? true);
	let csvDropActive = $state(false);

	let isRunning = $state(false);
	let isOptimizing = $state(false);
	let statusMessage = $state('');
	let statusType = $state<StatusType>('info');

	let result = $state.raw<BacktestResponse | null>(saved.result ?? null);
	let runSnapshot = $state<RunSnapshot | null>(saved.runSnapshot ?? null);
	let analytics = $state.raw<SimulationAnalytics | null>(saved.analytics ?? null);
	let optimizeRuns = $state.raw<OptimizeRun[]>(saved.optimizeRuns ?? []);
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
	const OPTIMIZER_ENABLED = false;

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
		writeDashboardState({
			dataSource,
			ticker,
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

	async function buildPayload() {
		const capital = parseFloat(startingCapital);
		const fee = parseFloat(feeRate);
		const strategyParams = getStrategyParams(strategy, windowSize);

		if (Number.isNaN(capital) || capital <= 0) throw new Error(i18n.t('error.capital'));
		if (Number.isNaN(fee) || fee < 0) throw new Error(i18n.t('error.fee'));

		const payload: BacktestRequest = {
			starting_capital: capital,
			transaction_fee_percent: fee,
			strategy_type: strategy,
			strategy_params: strategyParams
		};

		if (dataSource === 'api') {
			const symbol = ticker.trim().toUpperCase();
			if (symbol.length < 2) return null;
			payload.prices = capPricePoints(await getTickerPrices(symbol, period, interval));
		} else {
			payload.prices = capPricePoints(parseCsvText(csvText));
		}

		return { payload, strategyParams, capital, fee };
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

			const response = await postBacktest(payload);
			if (requestId !== activeRequestId) return;

			result = response;
			analytics = calculateSimulationAnalytics(response);
			runSnapshot = {
				dataSource: isApi ? i18n.t('source.yahoo') : i18n.t('source.csv'),
				asset: isApi ? ticker.trim().toUpperCase() : i18n.t('active.customCsv'),
				period: isApi ? period : '-',
				interval: isApi ? interval : '-',
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
		scheduleAutoRun(TICKER_AUTORUN_MS);
	}

	$effect(() => {
		dataSource;
		ticker;
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

<Tooltip.TooltipProvider>
	<div class="flex min-h-screen min-w-0 flex-col">
		<header class="{SURFACE_CLASS.shell} border-border/60 border-b">
			<div
				class="mx-auto flex max-w-7xl flex-col items-center gap-2 px-2 py-3 text-center sm:gap-3 sm:px-4 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:text-left"
			>
				<div class="min-w-0">
					<h1 class="text-xl font-semibold tracking-tight">
						MacroSignal <span class="text-muted-foreground">{i18n.t('header.productSuffix')}</span>
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
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button
									variant="ghost"
									size="icon"
									class="size-8"
									aria-label={i18n.t('settings.resetAria')}
									onclick={resetSettings}
								>
									<RotateCcwIcon class="size-4" />
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content>{i18n.t('settings.resetTooltip')}</Tooltip.Content>
						</Tooltip.Root>
					</Card.CardAction>
				</Card.CardHeader>
				<Card.CardContent class="space-y-5">
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
							bind:value={dataSource}
							onValueChange={(value) => {
								if (value === 'csv') clearTickerPriceCache();
								scheduleAutoRun();
							}}
						>
							<Tabs.TabsList class="h-auto w-full">
								<Tabs.TabsTrigger value="api" class="min-h-10 flex-1 px-2 text-xs whitespace-nowrap"
									>{i18n.t('source.yahoo')}</Tabs.TabsTrigger
								>
								<Tabs.TabsTrigger value="csv" class="min-h-10 flex-1 px-2 text-xs whitespace-nowrap"
									>{i18n.t('source.csv')}</Tabs.TabsTrigger
								>
							</Tabs.TabsList>

							<Tabs.TabsContent value="api" class="mt-4 space-y-4">
								<div class="space-y-2">
									<Label class="flex items-center gap-1.5 text-xs uppercase">
										{i18n.t('ticker.label')}
										<Tooltip.Root>
											<Tooltip.Trigger class="inline-flex">
												<CircleHelpIcon class="text-muted-foreground size-3.5" />
											</Tooltip.Trigger>
											<Tooltip.Content>{i18n.t('ticker.tooltip')}</Tooltip.Content>
										</Tooltip.Root>
									</Label>
									<div class="flex items-stretch gap-2">
										<Input
											bind:value={ticker}
											placeholder={i18n.t('ticker.placeholder')}
											class="h-10"
											oninput={() => scheduleAutoRun(TICKER_AUTORUN_MS)}
										/>
										<Button
											variant="outline"
											class="h-10 shrink-0 px-3"
											disabled={isRunning}
											onclick={runBacktest}
										>
											{#if isRunning}
												<Loader2Icon class="size-4 animate-spin" />
											{/if}
											{i18n.t('action.loadData')}
										</Button>
									</div>
									<div class="grid grid-cols-3 gap-1.5">
										{#each TICKER_SUGGESTIONS as item (item.symbol)}
											<Button
												variant="outline"
												size="xs"
												class="h-7 min-w-0 px-2"
												onclick={() => applyTickerSuggestion(item.symbol)}
											>
												{item.label}
											</Button>
										{/each}
									</div>
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
													<Table.TableRow>
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
