<script lang="ts">
	// ponytail: canvas charts, no chart library dependency
	import { browser } from '$app/environment';
	import type { CapitalPoint, SeriesPoint, Trade } from '$lib/api';
	import { formatCurrency } from '$lib/formatters';
	import { getI18n } from '$lib/i18n';
	import type { StrategyType } from '$lib/strategy';
	import {
		CHART_RANGE_ALPHA_FALLBACK,
		CSS_VAR,
		chartAlphaColor,
		getChartColors,
		withAlpha
	} from '$lib/theme';

	type ChartGeom = {
		xForIdx: (idx: number) => number;
		yForVal: (val: number) => number;
		margin: { top: number; right: number; bottom: number; left: number };
		width: number;
		height: number;
		rect: DOMRect;
	};

	type Props = {
		seriesData?: SeriesPoint[];
		trades?: Trade[];
		capitalHistory?: CapitalPoint[];
		strategy?: StrategyType;
		selectedPointIndex?: number | null;
		selectedTradeIndex?: number | null;
		onSelectPoint?: (index: number) => void;
	};

	let {
		seriesData = [],
		trades = [],
		capitalHistory = [],
		strategy = 'sma',
		selectedPointIndex = null,
		selectedTradeIndex = null,
		onSelectPoint
	}: Props = $props();

	const i18n = getI18n();

	let priceCanvas: HTMLCanvasElement | undefined = $state();
	let indicatorCanvas: HTMLCanvasElement | undefined = $state();
	let tooltipEl: HTMLDivElement | undefined = $state();
	let progress = 1;
	let chartGeom = $state<ChartGeom | null>(null);
	let subChartGeom = $state<ChartGeom | null>(null);
	let animationFrame: number | null = null;
	let hoverIndex = $state<number | null>(null);

	function chartMargin() {
		if (!browser) return { top: 12, right: 16, bottom: 12, left: 54 };
		const narrow = window.innerWidth < 640;
		return narrow
			? { top: 8, right: 2, bottom: 8, left: 30 }
			: { top: 12, right: 16, bottom: 12, left: 54 };
	}

	function getChartHelpers(
		canvas: HTMLCanvasElement,
		dataSize: number,
		minVal: number,
		maxVal: number
	) {
		const margin = chartMargin();
		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;

		canvas.width = Math.floor(rect.width * dpr);
		canvas.height = Math.floor(rect.height * dpr);

		const ctx = canvas.getContext('2d')!;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, rect.width, rect.height);

		const width = rect.width - margin.left - margin.right;
		const height = rect.height - margin.top - margin.bottom;
		const valRange = maxVal - minVal || 1;
		const maxIndex = Math.max(1, dataSize - 1);
		const xForIdx = (idx: number) => margin.left + (idx / maxIndex) * width;
		const yForVal = (val: number) => margin.top + ((maxVal - val) / valRange) * height;

		return { ctx, xForIdx, yForVal, margin, width, height, rect };
	}

	function drawGrid(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		minVal: number,
		maxVal: number,
		margin: { top: number; right: number; bottom: number; left: number },
		rows = 4,
		formatFn: (v: number) => string = (v) => v.toFixed(0)
	) {
		const narrow = browser && window.innerWidth < 640;
		const colors = getChartColors();
		ctx.strokeStyle = colors.grid;
		ctx.lineWidth = 1;
		ctx.fillStyle = colors.label;
		ctx.font = narrow ? '8px system-ui' : '9px system-ui';
		ctx.textAlign = 'right';

		const range = maxVal - minVal;
		for (let i = 0; i <= rows; i++) {
			const y = margin.top + (height / rows) * i;
			ctx.beginPath();
			ctx.moveTo(margin.left, y);
			ctx.lineTo(margin.left + width, y);
			ctx.stroke();

			const val = maxVal - (range / rows) * i;
			ctx.fillText(formatFn(val), margin.left - (narrow ? 4 : 8), y + 3);
		}
	}

	function drawLine(
		ctx: CanvasRenderingContext2D,
		data: { index: number; value: number | null }[],
		xForIdx: (idx: number) => number,
		yForVal: (val: number) => number,
		strokeColor: string,
		width = 2,
		lineProgress = 1
	) {
		if (data.length < 2) return;

		const limit = Math.max(1, Math.ceil(data.length * lineProgress));
		ctx.beginPath();
		ctx.lineWidth = width;
		ctx.strokeStyle = strokeColor;
		ctx.lineJoin = 'round';
		ctx.lineCap = 'round';

		let started = false;
		for (let i = 0; i < limit; i++) {
			const val = data[i].value;
			if (val === null || val === undefined) continue;

			const x = xForIdx(data[i].index);
			const y = yForVal(val);

			if (!started) {
				ctx.moveTo(x, y);
				started = true;
			} else {
				ctx.lineTo(x, y);
			}
		}
		ctx.stroke();
	}

	function drawCharts(lineProgress = 1) {
		const data = seriesData;
		if (!priceCanvas || !indicatorCanvas || !data.length) return;

		const colors = getChartColors();
		const len = data.length;
		const closeVals = data.map((d, i) => ({ index: i, value: d.close }));
		let mainVals = closeVals.map((v) => v.value);

		data.forEach((d) => {
			if (d.moving_average !== null) mainVals.push(d.moving_average);
		});

		const minPrice = Math.min(...mainVals);
		const maxPrice = Math.max(...mainVals);
		const pricePad = (maxPrice - minPrice) * 0.05 || 1;

		const priceHelpers = getChartHelpers(
			priceCanvas,
			len,
			minPrice - pricePad,
			maxPrice + pricePad
		);
		chartGeom = priceHelpers;

		drawGrid(
			priceHelpers.ctx,
			priceHelpers.width,
			priceHelpers.height,
			minPrice - pricePad,
			maxPrice + pricePad,
			priceHelpers.margin,
			4,
			formatCurrency
		);
		drawLine(
			priceHelpers.ctx,
			closeVals,
			priceHelpers.xForIdx,
			priceHelpers.yForVal,
			colors.price,
			2.2,
			lineProgress
		);

		const maVals = data.map((d, i) => ({ index: i, value: d.moving_average }));
		drawLine(
			priceHelpers.ctx,
			maVals,
			priceHelpers.xForIdx,
			priceHelpers.yForVal,
			colors.ma,
			1.8,
			lineProgress
		);

		if (selectedTradeIndex !== null && trades[selectedTradeIndex]) {
			const trade = trades[selectedTradeIndex];
			const nextTrade = trades[selectedTradeIndex + 1] ?? null;
			const entryIdx = data.findIndex((d) => d.date === trade.date);
			const exitIdx = nextTrade
				? data.findIndex((d) => d.date === nextTrade.date)
				: data.length - 1;

			if (entryIdx !== -1 && exitIdx !== -1) {
				const xStart = priceHelpers.xForIdx(entryIdx);
				const xEnd = priceHelpers.xForIdx(exitIdx);
				priceHelpers.ctx.fillStyle = chartAlphaColor(
					CSS_VAR.chartRange,
					CHART_RANGE_ALPHA_FALLBACK
				);
				priceHelpers.ctx.fillRect(
					xStart,
					priceHelpers.margin.top,
					xEnd - xStart,
					priceHelpers.height
				);
			}
		}

		trades.forEach((trade, tradeListIdx) => {
			const tradeIdx = data.findIndex((d) => d.date === trade.date);
			if (tradeIdx === -1 || tradeIdx / len > lineProgress) return;

			const x = priceHelpers.xForIdx(tradeIdx);
			const y = priceHelpers.yForVal(trade.price);
			const isSelected = tradeListIdx === selectedTradeIndex;

			priceHelpers.ctx.beginPath();
			priceHelpers.ctx.arc(x, y, isSelected ? 7 : 5, 0, 2 * Math.PI);
			priceHelpers.ctx.fillStyle = trade.type === 'buy' ? colors.buy : colors.sell;
			priceHelpers.ctx.fill();
			priceHelpers.ctx.strokeStyle = colors.markerStroke;
			priceHelpers.ctx.lineWidth = 1.5;
			priceHelpers.ctx.stroke();
		});

		const activePointIndex = hoverIndex ?? selectedPointIndex;
		if (activePointIndex !== null) {
			const hx = priceHelpers.xForIdx(activePointIndex);
			const hy = priceHelpers.yForVal(data[activePointIndex].close);

			priceHelpers.ctx.strokeStyle = withAlpha(colors.ma, 0.3);
			priceHelpers.ctx.lineWidth = 1;
			priceHelpers.ctx.beginPath();
			priceHelpers.ctx.moveTo(hx, priceHelpers.margin.top);
			priceHelpers.ctx.lineTo(hx, priceHelpers.rect.height - priceHelpers.margin.bottom);
			priceHelpers.ctx.stroke();

			priceHelpers.ctx.beginPath();
			priceHelpers.ctx.arc(hx, hy, 5, 0, 2 * Math.PI);
			priceHelpers.ctx.fillStyle = colors.ma;
			priceHelpers.ctx.fill();
			priceHelpers.ctx.strokeStyle = colors.markerStroke;
			priceHelpers.ctx.lineWidth = 1.5;
			priceHelpers.ctx.stroke();
		}

		let maxCap = 0;
		const ddVals = capitalHistory.map((h, i) => {
			if (h.capital > maxCap) maxCap = h.capital;
			return {
				index: i,
				value: maxCap === 0 ? 0 : ((h.capital - maxCap) / maxCap) * 100
			};
		});
		const subMin = Math.min(...ddVals.map((d) => d.value), -2);
		const subMax = 0.2;

		const subHelpers = getChartHelpers(indicatorCanvas, len, subMin, subMax);
		subChartGeom = subHelpers;

		drawGrid(
			subHelpers.ctx,
			subHelpers.width,
			subHelpers.height,
			subMin,
			subMax,
			subHelpers.margin,
			2,
			(v) => `${v.toFixed(1)}%`
		);

		const limit = Math.max(1, Math.ceil(len * lineProgress));
		const zeroY = subHelpers.yForVal(0);
		subHelpers.ctx.fillStyle = colors.drawdownFill;
		subHelpers.ctx.beginPath();
		subHelpers.ctx.moveTo(subHelpers.xForIdx(0), zeroY);
		for (let i = 0; i < limit; i++) {
			subHelpers.ctx.lineTo(subHelpers.xForIdx(i), subHelpers.yForVal(ddVals[i].value));
		}
		subHelpers.ctx.lineTo(subHelpers.xForIdx(limit - 1), zeroY);
		subHelpers.ctx.closePath();
		subHelpers.ctx.fill();

		drawLine(
			subHelpers.ctx,
			ddVals,
			subHelpers.xForIdx,
			subHelpers.yForVal,
			colors.sell,
			1.5,
			lineProgress
		);

		if (activePointIndex !== null) {
			const hx = subHelpers.xForIdx(activePointIndex);
			subHelpers.ctx.strokeStyle = withAlpha(colors.ma, 0.3);
			subHelpers.ctx.lineWidth = 1;
			subHelpers.ctx.beginPath();
			subHelpers.ctx.moveTo(hx, subHelpers.margin.top);
			subHelpers.ctx.lineTo(hx, subHelpers.rect.height - subHelpers.margin.bottom);
			subHelpers.ctx.stroke();
		}
	}

	function animateCharts() {
		const start = performance.now();
		const duration = 650;

		if (animationFrame) cancelAnimationFrame(animationFrame);

		const tick = (timestamp: number) => {
			const p = Math.min(1, (timestamp - start) / duration);
			progress = 1 - Math.pow(1 - p, 3);
			drawCharts(progress);

			if (p < 1) {
				animationFrame = requestAnimationFrame(tick);
			}
		};

		animationFrame = requestAnimationFrame(tick);
	}

	function findNearestIndex(clientX: number, geometry: ChartGeom | null): number | null {
		if (!geometry || !seriesData.length) return null;

		const x = clientX - geometry.rect.left;
		if (x < geometry.margin.left || x > geometry.margin.left + geometry.width) return null;

		const relativeX = (x - geometry.margin.left) / geometry.width;
		return Math.max(
			0,
			Math.min(seriesData.length - 1, Math.round(relativeX * (seriesData.length - 1)))
		);
	}

	function positionTooltip(idx: number) {
		const row = seriesData[idx];
		const geom = chartGeom;
		if (!tooltipEl || !geom || !row) {
			if (tooltipEl) tooltipEl.hidden = true;
			return;
		}

		const x = geom.xForIdx(idx);
		const y = geom.yForVal(row.close);

		tooltipEl.innerHTML = `
			<strong>${i18n.t('tooltip.date')}: ${row.date}</strong>
			<span>${i18n.t('tooltip.close')}: ${formatCurrency(row.close)}</span>
			<span>${i18n.t('tooltip.capital')}: ${formatCurrency(capitalHistory[idx]?.capital ?? 0)}</span>
		`;
		tooltipEl.style.left = `${x}px`;
		tooltipEl.style.top = `${y}px`;
		tooltipEl.hidden = false;
	}

	function handlePointerMove(e: PointerEvent, geometry: ChartGeom | null) {
		const idx = findNearestIndex(e.clientX, geometry);
		if (idx === null) return;

		if (idx !== hoverIndex) {
			hoverIndex = idx;
			onSelectPoint?.(idx);
			drawCharts(1);
		}
		positionTooltip(idx);
	}

	function handlePointerLeave() {
		hoverIndex = null;
		if (tooltipEl) tooltipEl.hidden = true;
	}

	// ponytail: animate only when chart data changes, not on hover/selection
	$effect(() => {
		if (!seriesData.length) return;
		seriesData;
		trades;
		capitalHistory;
		strategy;
		hoverIndex = null;
		animateCharts();
	});

	// ponytail: trade selection redraws instantly, like main branch drawCharts(1)
	$effect(() => {
		if (!seriesData.length) return;
		selectedTradeIndex;
		drawCharts(1);
	});

	function handleResize() {
		drawCharts(1);
		const idx = hoverIndex ?? selectedPointIndex;
		if (idx !== null) positionTooltip(idx);
	}
</script>

<svelte:window onresize={handleResize} />

<div class="relative min-w-0 space-y-2">
	<div
		class="border-border surface-card relative h-52 w-full min-w-0 overflow-hidden rounded-md border sm:h-56 sm:rounded-lg md:h-64"
	>
		<canvas
			bind:this={priceCanvas}
			class="h-full w-full cursor-crosshair touch-none"
			aria-label={i18n.t('chart.mainAria')}
			onpointermove={(e) => handlePointerMove(e, chartGeom)}
			onpointerleave={handlePointerLeave}
			onpointerdown={(e) => {
				e.currentTarget.setPointerCapture(e.pointerId);
				handlePointerMove(e, chartGeom);
			}}
		></canvas>
		<div
			bind:this={tooltipEl}
			class="tooltip-surface pointer-events-none absolute z-10 hidden max-w-[calc(100%-1rem)] min-w-28 -translate-x-1/2 -translate-y-full rounded-md px-2 py-1.5 text-xs shadow-md"
			hidden
		></div>
	</div>

	<div
		class="border-border surface-card h-24 w-full min-w-0 overflow-hidden rounded-md border sm:h-28 sm:rounded-lg"
	>
		<canvas
			bind:this={indicatorCanvas}
			class="h-full w-full cursor-crosshair touch-none"
			aria-label={i18n.t('chart.subAria')}
			onpointermove={(e) => handlePointerMove(e, subChartGeom)}
			onpointerleave={handlePointerLeave}
			onpointerdown={(e) => {
				e.currentTarget.setPointerCapture(e.pointerId);
				handlePointerMove(e, subChartGeom);
			}}
		></canvas>
	</div>
</div>
