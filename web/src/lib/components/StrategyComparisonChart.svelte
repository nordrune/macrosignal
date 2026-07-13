<script lang="ts">
	import type { CapitalPoint } from '$lib/api';
	import { formatCurrency } from '$lib/formatters';
	import { getI18n } from '$lib/i18n';
	import { getLegendConfig, type StrategyType } from '$lib/strategy';

	type Series = {
		strategy: StrategyType;
		windowSize: string;
		paramSummary?: string;
		capitalHistory: CapitalPoint[];
	};

	type Props = {
		series?: Series[];
	};

	let { series = [] }: Props = $props();

	const i18n = getI18n();
	const colors = ['#00e6c3', '#60a5fa', '#f59e0b', '#f43f5e', '#a78bfa', '#34d399'];
	const width = 900;
	const height = 320;
	const margin = { top: 18, right: 24, bottom: 30, left: 70 };

	const chartSeries = $derived(
		series
			.filter((item) => item.capitalHistory.length > 1)
			.map((item, index) => ({ ...item, color: colors[index % colors.length] }))
	);
	const allValues = $derived(
		chartSeries.flatMap((item) => item.capitalHistory.map((point) => point.capital))
	);
	const minValue = $derived(Math.min(...allValues));
	const maxValue = $derived(Math.max(...allValues));
	const valuePad = $derived(Math.max((maxValue - minValue) * 0.08, 1));
	const yMin = $derived(Number.isFinite(minValue) ? minValue - valuePad : 0);
	const yMax = $derived(Number.isFinite(maxValue) ? maxValue + valuePad : 1);
	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;

	function xFor(index: number, length: number): number {
		return margin.left + (index / Math.max(length - 1, 1)) * innerWidth;
	}

	function yFor(value: number): number {
		return margin.top + ((yMax - value) / Math.max(yMax - yMin, 1)) * innerHeight;
	}

	function pathFor(points: CapitalPoint[]): string {
		return points
			.map(
				(point, index) =>
					`${index === 0 ? 'M' : 'L'} ${xFor(index, points.length).toFixed(2)} ${yFor(point.capital).toFixed(2)}`
			)
			.join(' ');
	}

	function gridRows() {
		return Array.from({ length: 5 }, (_, index) => {
			const ratio = index / 4;
			const value = yMax - (yMax - yMin) * ratio;
			return {
				y: margin.top + innerHeight * ratio,
				value
			};
		});
	}
</script>

<div class="space-y-3">
	<div
		class="border-border bg-background/40 aspect-[16/7] min-h-72 overflow-hidden rounded-lg border"
	>
		{#if chartSeries.length}
			<svg
				viewBox={`0 0 ${width} ${height}`}
				class="h-full w-full"
				role="img"
				aria-label={i18n.t('comparison.chartAria')}
			>
				{#each gridRows() as row}
					<line
						x1={margin.left}
						x2={width - margin.right}
						y1={row.y}
						y2={row.y}
						class="stroke-border"
						stroke-width="1"
					/>
					<text
						x={margin.left - 10}
						y={row.y + 4}
						text-anchor="end"
						class="fill-muted-foreground text-[11px]"
					>
						{formatCurrency(row.value)}
					</text>
				{/each}

				{#each chartSeries as item}
					<path
						d={pathFor(item.capitalHistory)}
						fill="none"
						stroke={item.color}
						stroke-width="2.5"
						stroke-linejoin="round"
						stroke-linecap="round"
					/>
				{/each}
			</svg>
		{:else}
			<div
				class="text-muted-foreground flex h-full items-center justify-center px-4 text-center text-sm"
			>
				{i18n.t('comparison.emptyChart')}
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap gap-3 text-xs">
		{#each chartSeries as item}
			<span class="flex items-center gap-1.5">
				<span class="inline-block h-0.5 w-5 rounded-full" style={`background:${item.color}`}></span>
				{getLegendConfig(item.strategy).label} · {item.paramSummary ?? item.windowSize}
			</span>
		{/each}
	</div>
</div>
