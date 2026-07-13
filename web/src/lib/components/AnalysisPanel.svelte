<script lang="ts">
	import {
		type AnalysisCard,
		type DrawdownAnalytics,
		type FeeAnalytics,
		type PositionAnalytics,
		type SimulationAnalytics,
		type TradeAnalytics,
		type ActivityAnalytics
	} from '$lib/analytics';
	import type { Trade } from '$lib/api';
	import { formatCurrency, signedPercent, valueTone } from '$lib/formatters';
	import { STABLE_CLASS, TONE_CLASS } from '$lib/theme';
	import { getI18n } from '$lib/i18n';
	import { cn } from '$lib/utils';

	import AnalysisSkeleton from '$lib/components/AnalysisSkeleton.svelte';

	type Props = {
		analytics?: SimulationAnalytics | null;
		loading?: boolean;
		showEmpty?: boolean;
	};

	let { analytics = null, loading = false, showEmpty = false }: Props = $props();
	const i18n = getI18n();

	function formatDays(value: number): string {
		const n = Number.isFinite(value) ? value : 0;
		return `${n.toFixed(n % 1 === 0 ? 0 : 1)} ${i18n.t('analysis.dayShort')}`;
	}

	function formatPositionProfit(position: PositionAnalytics | null): string {
		if (!position) return i18n.t('analysis.noCompletedTrades');
		return formatCurrency(position.profit);
	}

	function formatPositionRange(position: PositionAnalytics | null): string {
		if (!position) return '';
		return `${position.entryDate} → ${position.exitDate}`;
	}

	function formatTradeAction(trade: Trade | null): string {
		if (!trade) return i18n.t('analysis.noTrades');
		return trade.type === 'buy' ? i18n.t('trade.buy') : i18n.t('trade.sell');
	}

	function card(
		label: string,
		value: string,
		detail = '',
		tone: AnalysisCard['tone'] = ''
	): AnalysisCard {
		return { label, value, detail, tone };
	}

	function buildTradeCards(t: TradeAnalytics): AnalysisCard[] {
		return [
			card(
				i18n.t('analysis.bestTrade'),
				formatPositionProfit(t.bestPosition),
				formatPositionRange(t.bestPosition),
				'positive'
			),
			card(
				i18n.t('analysis.worstTrade'),
				formatPositionProfit(t.worstPosition),
				formatPositionRange(t.worstPosition),
				'negative'
			),
			card(
				i18n.t('analysis.winningTrades'),
				String(t.winningPositions),
				i18n.t('analysis.positionUnit'),
				'positive'
			),
			card(
				i18n.t('analysis.losingTrades'),
				String(t.losingPositions),
				i18n.t('analysis.positionUnit'),
				t.losingPositions > 0 ? 'negative' : ''
			),
			card(
				i18n.t('analysis.avgProfit'),
				formatCurrency(t.averageProfit),
				'',
				valueTone(t.averageProfit)
			),
			card(i18n.t('analysis.avgRoi'), signedPercent(t.averageRoi), '', valueTone(t.averageRoi)),
			card(i18n.t('analysis.avgHold'), formatDays(t.averageHoldDays)),
			card(
				i18n.t('analysis.longestWinStreak'),
				String(t.longestWinStreak),
				i18n.t('analysis.positionUnit'),
				'positive'
			),
			card(
				i18n.t('analysis.longestLossStreak'),
				String(t.longestLossStreak),
				i18n.t('analysis.positionUnit'),
				t.longestLossStreak > 0 ? 'negative' : ''
			)
		];
	}

	function buildFeeCards(f: FeeAnalytics): AnalysisCard[] {
		return [
			card(
				i18n.t('analysis.totalFees'),
				formatCurrency(f.totalFees),
				'',
				f.totalFees > 0 ? 'warning' : ''
			),
			card(i18n.t('analysis.avgFee'), formatCurrency(f.averageFee)),
			card(
				i18n.t('analysis.feesStartShare'),
				signedPercent(f.feesStartShare),
				'',
				f.feesStartShare > 1 ? 'warning' : ''
			),
			card(
				i18n.t('analysis.feesEndShare'),
				signedPercent(f.feesEndShare),
				'',
				f.feesEndShare > 1 ? 'warning' : ''
			)
		];
	}

	function buildDrawdownCards(d: DrawdownAnalytics): AnalysisCard[] {
		return [
			card(
				i18n.t('analysis.deepestDrawdown'),
				signedPercent(d.deepestDrawdown),
				'',
				d.deepestDrawdown < 0 ? 'negative' : ''
			),
			card(i18n.t('analysis.drawdownDate'), d.deepestDate || '-'),
			card(
				i18n.t('analysis.longestDrawdown'),
				formatDays(d.longestDrawdownDays),
				'',
				d.longestDrawdownDays > 0 ? 'warning' : ''
			),
			card(
				i18n.t('analysis.recoveryStatus'),
				d.recovered ? i18n.t('analysis.recovered') : i18n.t('analysis.notRecovered'),
				'',
				d.recovered ? 'positive' : 'warning'
			),
			card(
				i18n.t('analysis.peakBeforeDrawdown'),
				d.peakBeforeDeepest > 0 ? formatCurrency(d.peakBeforeDeepest) : '-'
			)
		];
	}

	function buildActivityCards(a: ActivityAnalytics): AnalysisCard[] {
		const activeMonthValue = a.activeMonth
			? `${a.activeMonth.month} (${a.activeMonth.count})`
			: '-';
		return [
			card(
				i18n.t('analysis.firstTrade'),
				formatTradeAction(a.firstTrade),
				a.firstTrade?.date || ''
			),
			card(i18n.t('analysis.lastTrade'), formatTradeAction(a.lastTrade), a.lastTrade?.date || ''),
			card(i18n.t('analysis.avgTradeGap'), formatDays(a.averageTradeGap)),
			card(i18n.t('analysis.activeMonth'), activeMonthValue, i18n.t('analysis.tradeUnit'))
		];
	}

	const sections = $derived(
		analytics
			? [
					{ title: i18n.t('analysis.tradeTitle'), cards: buildTradeCards(analytics.trade) },
					{ title: i18n.t('analysis.feeTitle'), cards: buildFeeCards(analytics.fees) },
					{
						title: i18n.t('analysis.drawdownTitle'),
						cards: buildDrawdownCards(analytics.drawdown)
					},
					{
						title: i18n.t('analysis.activityTitle'),
						cards: buildActivityCards(analytics.activity)
					}
				]
			: []
	);

	const summary = $derived(
		analytics
			? i18n.t('analysis.summary', {
					positions: analytics.summary.positions,
					trades: analytics.summary.trades,
					days: analytics.summary.days
				})
			: i18n.t('analysis.empty')
	);

	const toneClass = (tone: AnalysisCard['tone']) =>
		tone === 'positive'
			? TONE_CLASS.positive
			: tone === 'negative'
				? TONE_CLASS.negative
				: tone === 'warning'
					? TONE_CLASS.warning
					: TONE_CLASS.neutral;
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-start justify-between gap-3">
		<div>
			<h2 class="text-base font-semibold">{i18n.t('analysis.title')}</h2>
			{#if loading && !analytics}
				<div class="skeleton mt-1 h-3 w-64 max-w-full rounded"></div>
			{:else if analytics}
				<p class="text-muted-foreground mt-1 text-sm">{summary}</p>
			{/if}
		</div>
	</div>

	{#if loading && !analytics}
		<div class="relative">
			<AnalysisSkeleton />
			{#if showEmpty}
				<p
					class="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm"
				>
					{i18n.t('analysis.empty')}
				</p>
			{/if}
		</div>
	{:else if sections.length === 0}
		<p class="text-muted-foreground text-sm">{i18n.t('analysis.empty')}</p>
	{:else}
		{#each sections as section (section.title)}
			<div class="flex flex-col gap-3">
				<h3 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
					{section.title}
				</h3>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{#each section.cards as item (item.label)}
						<div class="metric-cell min-h-24">
							<span class="metric-label">{item.label}</span>
							<div class="space-y-1">
								<p class={cn(STABLE_CLASS.value, 'metric-value', toneClass(item.tone))}>
									{item.value}
								</p>
								{#if item.detail}
									<p class="text-muted-foreground truncate text-xs">{item.detail}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
