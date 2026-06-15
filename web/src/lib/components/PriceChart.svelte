<script lang="ts">
	// ponytail: canvas not Recharts — exact behavior parity with frontend/app.js drawCharts()
	import { browser } from '$app/environment';
	import type { CapitalPoint, SeriesPoint, Trade } from '$lib/api';
	import { formatCurrency } from '$lib/formatters';
	import { getI18n } from '$lib/i18n';
	import type { StrategyType } from '$lib/strategy';

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
	let progress = $state(1);
	let chartGeom = $state<ChartGeom | null>(null);
	let subChartGeom = $state<ChartGeom | null>(null);
	let animationFrame = $state<number | null>(null);

	const margin = { top: 12, right: 16, bottom: 12, left: 54 };

	function getChartHelpers(
		canvas: HTMLCanvasElement,
		dataSize: number,
		minVal: number,
		maxVal: number
	) {
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
		rows = 4,
		formatFn: (v: number) => string = (v) => v.toFixed(0)
	) {
		ctx.strokeStyle = '#242a3c';
		ctx.lineWidth = 1;
		ctx.fillStyle = '#9ca3af';
		ctx.font = '9px system-ui';
		ctx.textAlign = 'right';

		const range = maxVal - minVal;
		for (let i = 0; i <= rows; i++) {
			const y = margin.top + (height / rows) * i;
			ctx.beginPath();
			ctx.moveTo(margin.left, y);
			ctx.lineTo(margin.left + width, y);
			ctx.stroke();

			const val = maxVal - (range / rows) * i;
			ctx.fillText(formatFn(val), margin.left - 8, y + 3);
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

		const len = data.length;
		const closeVals = data.map((d, i) => ({ index: i, value: d.close }));
		let mainVals = closeVals.map((v) => v.value);

		if (strategy === 'sma' || strategy === 'ema') {
			data.forEach((d) => {
				if (d.moving_average !== null) mainVals.push(d.moving_average);
			});
		}

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
			4,
			formatCurrency
		);
		drawLine(
			priceHelpers.ctx,
			closeVals,
			priceHelpers.xForIdx,
			priceHelpers.yForVal,
			'#f3f4f6',
			2.2,
			lineProgress
		);

		if (strategy === 'sma' || strategy === 'ema') {
			const maVals = data.map((d, i) => ({ index: i, value: d.moving_average }));
			drawLine(
				priceHelpers.ctx,
				maVals,
				priceHelpers.xForIdx,
				priceHelpers.yForVal,
				'#00e6c3',
				1.8,
				lineProgress
			);
		}

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
				priceHelpers.ctx.fillStyle = 'rgba(124, 58, 237, 0.07)';
				priceHelpers.ctx.fillRect(xStart, margin.top, xEnd - xStart, priceHelpers.height);
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
			priceHelpers.ctx.fillStyle = trade.type === 'buy' ? '#10b981' : '#f43f5e';
			priceHelpers.ctx.fill();
			priceHelpers.ctx.strokeStyle = '#ffffff';
			priceHelpers.ctx.lineWidth = 1.5;
			priceHelpers.ctx.stroke();
		});

		if (selectedPointIndex !== null) {
			const hx = priceHelpers.xForIdx(selectedPointIndex);
			const hy = priceHelpers.yForVal(data[selectedPointIndex].close);

			priceHelpers.ctx.strokeStyle = 'rgba(0, 230, 195, 0.3)';
			priceHelpers.ctx.lineWidth = 1;
			priceHelpers.ctx.beginPath();
			priceHelpers.ctx.moveTo(hx, margin.top);
			priceHelpers.ctx.lineTo(hx, priceHelpers.rect.height - margin.bottom);
			priceHelpers.ctx.stroke();

			priceHelpers.ctx.beginPath();
			priceHelpers.ctx.arc(hx, hy, 5, 0, 2 * Math.PI);
			priceHelpers.ctx.fillStyle = '#00e6c3';
			priceHelpers.ctx.fill();
			priceHelpers.ctx.strokeStyle = '#ffffff';
			priceHelpers.ctx.lineWidth = 1.5;
			priceHelpers.ctx.stroke();
		}

		let maxCap = 0;
		const dds = capitalHistory.map((h) => {
			if (h.capital > maxCap) maxCap = h.capital;
			return maxCap === 0 ? 0 : ((h.capital - maxCap) / maxCap) * 100;
		});
		const subMin = Math.min(...dds, -2);
		const subMax = 0.2;

		const subHelpers = getChartHelpers(indicatorCanvas, len, subMin, subMax);
		subChartGeom = subHelpers;

		drawGrid(
			subHelpers.ctx,
			subHelpers.width,
			subHelpers.height,
			subMin,
			subMax,
			2,
			(v) => `${v.toFixed(1)}%`
		);

		maxCap = 0;
		const ddVals = capitalHistory.map((h, i) => {
			if (h.capital > maxCap) maxCap = h.capital;
			return {
				index: i,
				value: maxCap === 0 ? 0 : ((h.capital - maxCap) / maxCap) * 100
			};
		});

		drawLine(
			subHelpers.ctx,
			ddVals,
			subHelpers.xForIdx,
			subHelpers.yForVal,
			'#f43f5e',
			1.5,
			lineProgress
		);

		const limit = Math.max(1, Math.ceil(len * lineProgress));
		const zeroY = subHelpers.yForVal(0);
		subHelpers.ctx.fillStyle = 'rgba(244, 63, 94, 0.05)';
		subHelpers.ctx.beginPath();
		subHelpers.ctx.moveTo(subHelpers.xForIdx(0), zeroY);
		for (let i = 0; i < limit; i++) {
			subHelpers.ctx.lineTo(subHelpers.xForIdx(i), subHelpers.yForVal(ddVals[i].value));
		}
		subHelpers.ctx.lineTo(subHelpers.xForIdx(limit - 1), zeroY);
		subHelpers.ctx.closePath();
		subHelpers.ctx.fill();

		if (selectedPointIndex !== null) {
			const hx = subHelpers.xForIdx(selectedPointIndex);
			subHelpers.ctx.strokeStyle = 'rgba(0, 230, 195, 0.3)';
			subHelpers.ctx.lineWidth = 1;
			subHelpers.ctx.beginPath();
			subHelpers.ctx.moveTo(hx, margin.top);
			subHelpers.ctx.lineTo(hx, subHelpers.rect.height - margin.bottom);
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
		if (x < margin.left || x > margin.left + geometry.width) return null;

		const relativeX = (x - margin.left) / geometry.width;
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

	function handleMouseMove(e: MouseEvent, geometry: ChartGeom | null) {
		const idx = findNearestIndex(e.clientX, geometry);
		if (idx !== null) {
			onSelectPoint?.(idx);
			positionTooltip(idx);
		}
	}

	function handleMouseLeave() {
		if (tooltipEl) tooltipEl.hidden = true;
	}

	// ponytail: canvas redraw tracks props — external canvas sync, not state mutation
	$effect(() => {
		if (!seriesData.length) return;
		seriesData;
		trades;
		capitalHistory;
		strategy;
		selectedPointIndex;
		selectedTradeIndex;
		animateCharts();
	});

	function handleResize() {
		drawCharts(1);
		if (selectedPointIndex !== null) positionTooltip(selectedPointIndex);
	}
</script>

<svelte:window onresize={handleResize} />

<div class="relative space-y-2">
	<div class="border-border bg-card/50 relative h-64 w-full overflow-hidden rounded-lg border">
		<canvas
			bind:this={priceCanvas}
			class="h-full w-full cursor-crosshair"
			aria-label={i18n.t('chart.mainAria')}
			onmousemove={(e) => handleMouseMove(e, chartGeom)}
			onmouseleave={handleMouseLeave}
		></canvas>
		<div
			bind:this={tooltipEl}
			class="border-border bg-popover pointer-events-none absolute z-10 hidden min-w-32 -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1.5 text-xs shadow-md"
			hidden
		></div>
	</div>

	<div class="border-border bg-card/50 h-28 w-full overflow-hidden rounded-lg border">
		<canvas
			bind:this={indicatorCanvas}
			class="h-full w-full cursor-crosshair"
			aria-label={i18n.t('chart.subAria')}
			onmousemove={(e) => handleMouseMove(e, subChartGeom)}
			onmouseleave={handleMouseLeave}
		></canvas>
	</div>
</div>
