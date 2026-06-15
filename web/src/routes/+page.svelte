<script lang="ts">
	import IntervalSelect from '$lib/components/IntervalSelect.svelte';
	import PeriodSelect from '$lib/components/PeriodSelect.svelte';
	import PriceChart from '$lib/components/PriceChart.svelte';
	import StrategySelect from '$lib/components/StrategySelect.svelte';
	import { Badge } from '$lib/components/ui/badge';
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
	import { SAMPLE_CSV, parseCsvText } from '$lib/csv';
	import { exportCsv, type RunSnapshot } from '$lib/export';
	import {
		formatCurrency,
		formatKeyValueParams,
		hasNumber,
		pnlClass,
		signedCurrency,
		signedPercent
	} from '$lib/formatters';
	import { getI18n } from '$lib/i18n';
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
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import PlayIcon from '@lucide/svelte/icons/play';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';

	const i18n = getI18n();

	const DEFAULT_STARTING_CAPITAL = 10000;
	const DEFAULT_FEE_PERCENT = 0.1;

	let dataSource = $state<DataSource>('api');
	let ticker = $state('BTC-USD');
	let period = $state<Period>('1y');
	let interval = $state<Interval>('1d');
	let csvText = $state(SAMPLE_CSV);
	let strategy = $state<StrategyType>('sma');
	let windowSize = $state(String(DEFAULT_WINDOW));
	let startingCapital = $state(String(DEFAULT_STARTING_CAPITAL));
	let feeRate = $state(String(DEFAULT_FEE_PERCENT));
	let autoRun = $state(true);

	let isRunning = $state(false);
	let isOptimizing = $state(false);
	let statusMessage = $state('');
	let statusType = $state<StatusType>('info');

	// ponytail: API payloads are reassigned, never mutated — $state.raw avoids proxy cost
	let result = $state.raw<BacktestResponse | null>(null);
	let runSnapshot = $state<RunSnapshot | null>(null);
	let optimizeRuns = $state.raw<OptimizeRun[]>([]);
	let selectedPointIndex = $state<number | null>(null);
	let selectedTradeIndex = $state<number | null>(null);

	let activeStrategy = $state('sma');
	let activeTicker = $state('BTC-USD');
	let activeUsesCsv = $state(false);
	let activeFee = $state(DEFAULT_FEE_PERCENT);

	let autoRunTimeout: ReturnType<typeof setTimeout> | undefined;
	let activeRequestId = 0;

	const TICKER_AUTORUN_MS = 800;
	const DEFAULT_AUTORUN_MS = 350;

	const legend = $derived(getLegendConfig(strategy));
	const selectedPoint = $derived(
		selectedPointIndex !== null ? (result?.series_data[selectedPointIndex] ?? null) : null
	);

	function setStatus(msg: string, type: StatusType = 'info') {
		statusMessage = msg;
		statusType = type;
	}

	function statusFromError(error: unknown): string {
		return error instanceof Error ? error.message : i18n.t('error.backtest');
	}

	function scheduleAutoRun(delayMs = DEFAULT_AUTORUN_MS) {
		if (!autoRun || isRunning) return;
		clearTimeout(autoRunTimeout);
		autoRunTimeout = setTimeout(() => runBacktest(), delayMs);
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
			// ponytail: cached GET /api/ticker — backtest sends prices[], not symbol
			payload.prices = await getTickerPrices(symbol, period, interval);
		} else {
			payload.prices = parseCsvText(csvText);
		}

		return { payload, strategyParams, capital, fee };
	}

	async function runBacktest() {
		const requestId = ++activeRequestId;
		isRunning = true;
		setStatus(i18n.t('status.running'), 'info');

		try {
			const built = await buildPayload();
			if (!built) {
				if (requestId === activeRequestId) isRunning = false;
				return;
			}
			const { payload, strategyParams, capital, fee } = built;
			const isApi = dataSource === 'api';

			if (isApi) {
				activeTicker = payload.symbol ?? activeTicker;
				activeUsesCsv = false;
			} else {
				activeUsesCsv = true;
			}
			activeStrategy = strategy;
			activeFee = fee;

			const response = await postBacktest(payload);
			if (requestId !== activeRequestId) return;

			result = response;
			runSnapshot = {
				dataSource: isApi ? i18n.t('source.yahoo') : i18n.t('source.csv'),
				asset: isApi ? (payload.symbol ?? '-') : i18n.t('active.customCsv'),
				period: isApi ? period : '-',
				interval: isApi ? interval : '-',
				strategy: i18n.t(`strategy.${strategy}` as 'strategy.sma'),
				strategyType: strategy,
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
		} catch (error) {
			if (requestId !== activeRequestId) return;
			setStatus(statusFromError(error), 'error');
		} finally {
			if (requestId === activeRequestId) isRunning = false;
		}
	}

	async function runOptimize() {
		isOptimizing = true;
		setStatus(i18n.t('optimizer.running'), 'info');

		try {
			const built = await buildPayload();
			if (!built) return;
			const { payload } = built;
			const { strategy_params: _, ...optimizePayload } = payload;
			const response = await postOptimize(optimizePayload);
			optimizeRuns = response.runs.slice(0, 5);
			setStatus(i18n.t('status.done'), 'success');
		} catch (error) {
			setStatus(statusFromError(error), 'error');
		} finally {
			isOptimizing = false;
		}
	}

	function handleExport() {
		if (!result || !runSnapshot) {
			setStatus(i18n.t('export.empty'), 'error');
			return;
		}
		try {
			exportCsv(result, runSnapshot);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : i18n.t('export.empty'), 'error');
		}
	}

	function handleCsvFile(file: File | undefined) {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			csvText = String(reader.result ?? '');
			runBacktest();
		};
		reader.readAsText(file);
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

	// ponytail: one-shot initial backtest; onMount is fine (not a window listener)
	onMount(() => {
		void runBacktest();
	});
</script>

<Tooltip.TooltipProvider>
	<div class="bg-background min-h-screen min-w-0">
		<header class="border-border bg-card/40 border-b">
			<div
				class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:py-5 lg:px-6"
			>
				<div class="min-w-0">
					<p class="text-primary text-xs font-medium tracking-widest uppercase">
						{i18n.t('header.eyebrow')}
					</p>
					<h1 class="text-xl font-bold tracking-tight sm:text-2xl">
						MacroSignal <span class="text-muted-foreground">{i18n.t('header.productSuffix')}</span>
					</h1>
				</div>

				<div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
					<div class="border-border flex rounded-lg border p-0.5">
						<Button
							variant={i18n.lang === 'de' ? 'default' : 'ghost'}
							size="sm"
							class="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
							onclick={() => i18n.setLanguage('de')}>DE</Button
						>
						<Button
							variant={i18n.lang === 'en' ? 'default' : 'ghost'}
							size="sm"
							class="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
							onclick={() => i18n.setLanguage('en')}>EN</Button
						>
					</div>
					<Button
						variant="outline"
						size="sm"
						class="min-h-11 flex-1 sm:min-h-0 sm:flex-none"
						disabled={!result}
						onclick={handleExport}
					>
						<DownloadIcon class="size-4" />
						{i18n.t('export.csv')}
					</Button>
				</div>
			</div>

			<div class="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 pb-4 lg:px-6">
				<Badge variant="secondary"
					>{i18n.t('active.strategy')}: {activeStrategy.toUpperCase()}</Badge
				>
				<Badge variant="secondary">
					{i18n.t('active.ticker')}: {activeUsesCsv ? i18n.t('active.customCsv') : activeTicker}
				</Badge>
				<Badge variant="secondary">{i18n.t('active.fee')}: {activeFee}%</Badge>
			</div>
		</header>

		<main class="mx-auto max-w-7xl min-w-0 space-y-6 px-4 py-6 lg:px-6">
			<Card.Card>
				<Card.CardHeader>
					<Card.CardTitle>{i18n.t('section.settings')}</Card.CardTitle>
				</Card.CardHeader>
				<Card.CardContent class="space-y-6">
					<Tabs.Tabs
						bind:value={dataSource}
						onValueChange={(value) => {
							if (value === 'csv') clearTickerPriceCache();
							scheduleAutoRun();
						}}
					>
						<Tabs.TabsList class="h-auto w-full sm:h-8 sm:w-fit">
							<Tabs.TabsTrigger value="api" class="min-h-11 flex-1 sm:min-h-0 sm:flex-none"
								>{i18n.t('source.yahoo')}</Tabs.TabsTrigger
							>
							<Tabs.TabsTrigger value="csv" class="min-h-11 flex-1 sm:min-h-0 sm:flex-none"
								>{i18n.t('source.csv')}</Tabs.TabsTrigger
							>
						</Tabs.TabsList>

						<Tabs.TabsContent value="api" class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							<div class="space-y-2 md:col-span-2">
								<Label class="flex items-center gap-1.5">
									{i18n.t('ticker.label')}
									<Tooltip.Root>
										<Tooltip.Trigger class="inline-flex">
											<CircleHelpIcon class="text-muted-foreground size-3.5" />
										</Tooltip.Trigger>
										<Tooltip.Content>{i18n.t('ticker.tooltip')}</Tooltip.Content>
									</Tooltip.Root>
								</Label>
								<Input
									bind:value={ticker}
									placeholder={i18n.t('ticker.placeholder')}
									oninput={() => scheduleAutoRun(TICKER_AUTORUN_MS)}
								/>
							</div>
							<div class="space-y-2">
								<Label>{i18n.t('period.label')}</Label>
								<PeriodSelect bind:value={period} onchange={scheduleAutoRun} />
							</div>
							<div class="space-y-2">
								<Label>{i18n.t('interval.label')}</Label>
								<IntervalSelect bind:value={interval} onchange={scheduleAutoRun} />
							</div>
						</Tabs.TabsContent>

						<Tabs.TabsContent value="csv" class="mt-4 space-y-3">
							<Label class="flex items-center gap-1.5">
								{i18n.t('csv.heading')}
								<Tooltip.Root>
									<Tooltip.Trigger class="inline-flex">
										<CircleHelpIcon class="text-muted-foreground size-3.5" />
									</Tooltip.Trigger>
									<Tooltip.Content>{i18n.t('csv.tooltip')}</Tooltip.Content>
								</Tooltip.Root>
							</Label>
							<div class="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									class="min-h-11 flex-1 sm:min-h-0 sm:flex-none"
									onclick={() => (csvText = SAMPLE_CSV)}
								>
									Sample
								</Button>
								<Button
									variant="outline"
									size="sm"
									class="min-h-11 flex-1 sm:min-h-0 sm:flex-none"
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
							<textarea
								bind:value={csvText}
								aria-label={i18n.t('csv.aria')}
								class="border-input bg-background min-h-32 w-full rounded-lg border px-3 py-2 font-mono text-xs"
								oninput={() => scheduleAutoRun()}
							></textarea>
						</Tabs.TabsContent>
					</Tabs.Tabs>

					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
						<div class="space-y-2">
							<Label class="flex items-center gap-1.5">
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
							<Label class="flex items-center gap-1.5">
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
								min="2"
								bind:value={windowSize}
								oninput={() => scheduleAutoRun()}
							/>
						</div>

						<div class="space-y-2">
							<Label class="flex items-center gap-1.5">
								{i18n.t('capital.start')}
								<Tooltip.Root>
									<Tooltip.Trigger class="inline-flex">
										<CircleHelpIcon class="text-muted-foreground size-3.5" />
									</Tooltip.Trigger>
									<Tooltip.Content>{i18n.t('capital.tooltip')}</Tooltip.Content>
								</Tooltip.Root>
							</Label>
							<Input
								type="number"
								min="1"
								bind:value={startingCapital}
								oninput={() => scheduleAutoRun()}
							/>
						</div>

						<div class="space-y-2">
							<Label class="flex items-center gap-1.5">
								{i18n.t('fee.label')}
								<Tooltip.Root>
									<Tooltip.Trigger class="inline-flex">
										<CircleHelpIcon class="text-muted-foreground size-3.5" />
									</Tooltip.Trigger>
									<Tooltip.Content>{i18n.t('fee.tooltip')}</Tooltip.Content>
								</Tooltip.Root>
							</Label>
							<Input
								type="number"
								min="0"
								step="0.01"
								bind:value={feeRate}
								oninput={() => scheduleAutoRun()}
							/>
						</div>

						<div class="flex flex-col justify-end gap-3 md:col-span-2 lg:col-span-1">
							<label class="flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
								<Checkbox bind:checked={autoRun} />
								{i18n.t('autorun.label')}
							</label>
							<Button class="min-h-11 w-full sm:min-h-0" disabled={isRunning} onclick={runBacktest}>
								<PlayIcon class="size-4" />
								{i18n.t('action.run')}
							</Button>
						</div>
					</div>
				</Card.CardContent>
			</Card.Card>

			<Card.Card>
				<Card.CardHeader class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<Card.CardTitle class="flex items-center gap-2">
						<SparklesIcon class="text-primary size-4" />
						{i18n.t('optimizer.title')}
					</Card.CardTitle>
					<Button
						variant="outline"
						size="sm"
						class="min-h-11 w-full sm:min-h-0 sm:w-auto"
						disabled={isOptimizing || isRunning}
						onclick={runOptimize}
					>
						{i18n.t('optimizer.run')}
					</Button>
				</Card.CardHeader>
				<Card.CardContent>
					{#if optimizeRuns.length === 0}
						<p class="text-muted-foreground text-sm">{i18n.t('optimizer.empty')}</p>
					{:else}
						<Table.Table>
							<Table.TableHeader>
								<Table.TableRow>
									<Table.TableHead>{i18n.t('optimizer.rank')}</Table.TableHead>
									<Table.TableHead>{i18n.t('optimizer.params')}</Table.TableHead>
									<Table.TableHead>{i18n.t('optimizer.return')}</Table.TableHead>
									<Table.TableHead>{i18n.t('metric.sharpe')}</Table.TableHead>
									<Table.TableHead>{i18n.t('metric.drawdown')}</Table.TableHead>
									<Table.TableHead>{i18n.t('metric.winRate')}</Table.TableHead>
									<Table.TableHead>{i18n.t('optimizer.endCapital')}</Table.TableHead>
								</Table.TableRow>
							</Table.TableHeader>
							<Table.TableBody>
								{#each optimizeRuns as run, i (i)}
									<Table.TableRow>
										<Table.TableCell>{i + 1}</Table.TableCell>
										<Table.TableCell
											class="max-w-48 font-mono text-xs whitespace-nowrap sm:max-w-none"
											>{formatKeyValueParams(run.params)}</Table.TableCell
										>
										<Table.TableCell class={pnlClass(run.profit_loss_percent)}>
											{signedPercent(run.profit_loss_percent)}
										</Table.TableCell>
										<Table.TableCell>{run.sharpe_ratio.toFixed(2)}</Table.TableCell>
										<Table.TableCell>{run.max_drawdown.toFixed(2)}%</Table.TableCell>
										<Table.TableCell>{run.win_rate.toFixed(1)}%</Table.TableCell>
										<Table.TableCell>{formatCurrency(run.end_capital)}</Table.TableCell>
									</Table.TableRow>
								{/each}
							</Table.TableBody>
						</Table.Table>
					{/if}
				</Card.CardContent>
			</Card.Card>

			{#if result}
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={i18n.t('metrics.aria')}>
					<Card.Card size="sm">
						<Card.CardHeader
							><Card.CardDescription>{i18n.t('metric.start')}</Card.CardDescription
							></Card.CardHeader
						>
						<Card.CardContent
							><p class="text-xl font-semibold">
								{formatCurrency(result.start_capital)}
							</p></Card.CardContent
						>
					</Card.Card>
					<Card.Card size="sm">
						<Card.CardHeader
							><Card.CardDescription>{i18n.t('metric.end')}</Card.CardDescription></Card.CardHeader
						>
						<Card.CardContent
							><p class="text-xl font-semibold">
								{formatCurrency(result.end_capital)}
							</p></Card.CardContent
						>
					</Card.Card>
					<Card.Card size="sm">
						<Card.CardHeader
							><Card.CardDescription>{i18n.t('metric.profit')}</Card.CardDescription
							></Card.CardHeader
						>
						<Card.CardContent>
							<p class={cn('text-xl font-semibold', pnlClass(result.profit_loss))}>
								{signedCurrency(result.profit_loss)}
							</p>
						</Card.CardContent>
					</Card.Card>
					<Card.Card size="sm">
						<Card.CardHeader
							><Card.CardDescription>{i18n.t('metric.strategyReturn')}</Card.CardDescription
							></Card.CardHeader
						>
						<Card.CardContent>
							<p class={cn('text-xl font-semibold', pnlClass(result.profit_loss_percent))}>
								{signedPercent(result.profit_loss_percent)}
							</p>
						</Card.CardContent>
					</Card.Card>
					<Card.Card size="sm">
						<Card.CardHeader>
							<Card.CardDescription class="flex items-center gap-1">
								{i18n.t('metric.sharpe')}
								<Tooltip.Root>
									<Tooltip.Trigger class="inline-flex"
										><CircleHelpIcon class="size-3" /></Tooltip.Trigger
									>
									<Tooltip.Content>{i18n.t('metric.sharpeTooltip')}</Tooltip.Content>
								</Tooltip.Root>
							</Card.CardDescription>
						</Card.CardHeader>
						<Card.CardContent
							><p class="text-xl font-semibold">
								{result.sharpe_ratio.toFixed(2)}
							</p></Card.CardContent
						>
					</Card.Card>
					<Card.Card size="sm">
						<Card.CardHeader>
							<Card.CardDescription class="flex items-center gap-1">
								{i18n.t('metric.drawdown')}
								<Tooltip.Root>
									<Tooltip.Trigger class="inline-flex"
										><CircleHelpIcon class="size-3" /></Tooltip.Trigger
									>
									<Tooltip.Content>{i18n.t('metric.drawdownTooltip')}</Tooltip.Content>
								</Tooltip.Root>
							</Card.CardDescription>
						</Card.CardHeader>
						<Card.CardContent
							><p class="text-xl font-semibold">
								{result.max_drawdown.toFixed(2)}%
							</p></Card.CardContent
						>
					</Card.Card>
					<Card.Card size="sm">
						<Card.CardHeader>
							<Card.CardDescription class="flex items-center gap-1">
								{i18n.t('metric.winRate')}
								<Tooltip.Root>
									<Tooltip.Trigger class="inline-flex"
										><CircleHelpIcon class="size-3" /></Tooltip.Trigger
									>
									<Tooltip.Content>{i18n.t('metric.winRateTooltip')}</Tooltip.Content>
								</Tooltip.Root>
							</Card.CardDescription>
						</Card.CardHeader>
						<Card.CardContent
							><p class="text-xl font-semibold">{result.win_rate.toFixed(1)}%</p></Card.CardContent
						>
					</Card.Card>
					<Card.Card size="sm">
						<Card.CardHeader>
							<Card.CardDescription class="flex items-center gap-1">
								{i18n.t('metric.buyHold')}
								<Tooltip.Root>
									<Tooltip.Trigger class="inline-flex"
										><CircleHelpIcon class="size-3" /></Tooltip.Trigger
									>
									<Tooltip.Content>{i18n.t('metric.buyHoldTooltip')}</Tooltip.Content>
								</Tooltip.Root>
							</Card.CardDescription>
						</Card.CardHeader>
						<Card.CardContent>
							<p class={cn('text-xl font-semibold', pnlClass(result.buy_and_hold_return))}>
								{signedPercent(result.buy_and_hold_return)}
							</p>
						</Card.CardContent>
					</Card.Card>
				</div>

				<Card.Card>
					<Card.CardHeader
						class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between"
					>
						<div class="min-w-0">
							<Card.CardTitle>{i18n.t('results.title')}</Card.CardTitle>
							<Card.CardDescription>
								{i18n.t('summary.loaded', { count: result.series_data.length })}
							</Card.CardDescription>
						</div>
						<div class="grid w-full gap-2 text-sm sm:flex sm:w-auto sm:flex-wrap sm:gap-4">
							<div>
								<span class="text-muted-foreground">{i18n.t('inspect.date')}: </span>
								<span>{selectedPoint?.date ?? i18n.t('inspect.defaultDate')}</span>
							</div>
							<div>
								<span class="text-muted-foreground">{i18n.t('inspect.close')}: </span>
								<span>{selectedPoint ? formatCurrency(selectedPoint.close) : '-'}</span>
							</div>
							<div>
								<span class="text-muted-foreground">{i18n.t('inspect.indicator')}: </span>
								<span>
									{selectedPoint && hasNumber(selectedPoint.moving_average)
										? formatCurrency(Number(selectedPoint.moving_average))
										: '-'}
								</span>
							</div>
							<div>
								<span class="text-muted-foreground">{i18n.t('inspect.signal')}: </span>
								<span
									class={cn(
										selectedPoint?.signal === 'buy' && 'text-emerald-400',
										selectedPoint?.signal === 'sell' && 'text-rose-400'
									)}
								>
									{selectedPoint ? i18n.t(`signal.${selectedPoint.signal}` as 'signal.hold') : '-'}
								</span>
							</div>
						</div>
					</Card.CardHeader>
					<Card.CardContent class="min-w-0 space-y-3">
						<div class="text-muted-foreground flex flex-wrap gap-x-3 gap-y-2 text-xs">
							<span class="flex items-center gap-1.5"
								><span class="bg-foreground inline-block h-0.5 w-4"></span>{i18n.t(
									'legend.price'
								)}</span
							>
							<span class="flex items-center gap-1.5">
								<span class="inline-block h-0.5 w-4" style="background:{legend.color}"></span>
								{legend.label}
							</span>
							<span class="flex items-center gap-1.5"
								><span class="inline-block size-2 rounded-full bg-emerald-500"></span>{i18n.t(
									'legend.buy'
								)}</span
							>
							<span class="flex items-center gap-1.5"
								><span class="inline-block size-2 rounded-full bg-rose-500"></span>{i18n.t(
									'legend.sell'
								)}</span
							>
						</div>
						<PriceChart
							seriesData={result.series_data}
							trades={result.trades}
							capitalHistory={result.capital_history}
							{strategy}
							{selectedPointIndex}
							{selectedTradeIndex}
							onSelectPoint={(idx) => (selectedPointIndex = idx)}
						/>
					</Card.CardContent>
				</Card.Card>

				<Card.Card>
					<Card.CardHeader>
						<Card.CardTitle>{i18n.t('trades.title')}</Card.CardTitle>
						<Card.CardDescription>
							{i18n.t('trade.count', {
								total: result.buy_trades + result.sell_trades,
								buy: result.buy_trades,
								sell: result.sell_trades
							})}
						</Card.CardDescription>
					</Card.CardHeader>
					<Card.CardContent>
						<Table.Table>
							<Table.TableHeader>
								<Table.TableRow>
									<Table.TableHead>{i18n.t('table.date')}</Table.TableHead>
									<Table.TableHead>{i18n.t('table.action')}</Table.TableHead>
									<Table.TableHead>{i18n.t('table.price')}</Table.TableHead>
									<Table.TableHead>{i18n.t('table.units')}</Table.TableHead>
									<Table.TableHead>{i18n.t('table.fee')}</Table.TableHead>
									<Table.TableHead>{i18n.t('table.cash')}</Table.TableHead>
								</Table.TableRow>
							</Table.TableHeader>
							<Table.TableBody>
								{#if result.trades.length === 0}
									<Table.TableRow>
										<Table.TableCell colspan={6} class="text-muted-foreground text-center">
											{i18n.t('trade.none')}
										</Table.TableCell>
									</Table.TableRow>
								{:else}
									{#each result.trades as trade, idx (trade.date + trade.type + idx)}
										<Table.TableRow
											class={cn(
												'cursor-pointer',
												'min-h-11 sm:min-h-0',
												selectedTradeIndex === idx && 'bg-muted/60'
											)}
											onclick={() => selectTrade(idx)}
										>
											<Table.TableCell class="font-mono">{trade.date}</Table.TableCell>
											<Table.TableCell
												class={trade.type === 'buy' ? 'text-emerald-400' : 'text-rose-400'}
											>
												{trade.type === 'buy' ? i18n.t('trade.buy') : i18n.t('trade.sell')}
											</Table.TableCell>
											<Table.TableCell class="font-mono"
												>{formatCurrency(trade.price)}</Table.TableCell
											>
											<Table.TableCell class="font-mono">{trade.units.toFixed(6)}</Table.TableCell>
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
					</Card.CardContent>
				</Card.Card>
			{:else}
				<Card.Card>
					<Card.CardContent class="text-muted-foreground py-10 text-center">
						{i18n.t('results.empty')}
					</Card.CardContent>
				</Card.Card>
			{/if}

			{#if statusMessage}
				<div
					class={cn(
						'rounded-lg border px-4 py-3 text-sm',
						statusType === 'error' && 'border-destructive/50 bg-destructive/10 text-destructive',
						statusType === 'success' && 'border-primary/30 bg-primary/10 text-primary',
						statusType === 'info' && 'border-border bg-muted/40 text-muted-foreground'
					)}
					role="status"
				>
					{statusMessage}
				</div>
			{/if}
		</main>

		<footer
			class="border-border text-muted-foreground space-y-2 border-t px-4 py-6 text-center text-sm sm:px-6"
		>
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
