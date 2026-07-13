<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { getTradeInspectorDetails } from '$lib/analytics';
	import type { BacktestResponse } from '$lib/api';
	import { formatCurrency, signedCurrency } from '$lib/formatters';
	import { pnlClass } from '$lib/theme';
	import { getI18n } from '$lib/i18n';
	import { cn } from '$lib/utils';
	import CircleHelpIcon from '@lucide/svelte/icons/circle-help';
	import XIcon from '@lucide/svelte/icons/x';
	import { slide } from 'svelte/transition';

	type Props = {
		result: BacktestResponse;
		tradeIndex: number | null;
		onClose?: () => void;
	};

	let { result, tradeIndex, onClose }: Props = $props();
	const i18n = getI18n();

	const details = $derived.by(() => {
		if (tradeIndex === null) return null;
		const trade = result.trades[tradeIndex];
		if (!trade) return null;
		return getTradeInspectorDetails(
			trade,
			result.trades[tradeIndex + 1] ?? null,
			result.series_data
		);
	});

	const visible = $derived(tradeIndex !== null && details !== null);
</script>

{#if visible && details}
	<div transition:slide={{ duration: 220 }} class="mt-4">
		<section class="border-border/70 bg-background/25 overflow-hidden rounded-lg border">
			<header class="border-border/70 flex items-center justify-between gap-3 border-b px-3 py-2">
				<h3 class="text-sm font-medium">{i18n.t('trade.details')}</h3>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={i18n.t('trade.closeAria')}
					onclick={() => onClose?.()}
				>
					<XIcon class="size-4" />
				</Button>
			</header>
			<div class="p-3">
				<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
					<div class="surface-inset flex flex-col gap-1 rounded-lg px-3 py-2.5">
						<span class="text-muted-foreground text-xs">{i18n.t('trade.hold')}</span>
						<span class="text-sm font-medium"
							>{i18n.t('trade.days', { count: details.holdDays })}</span
						>
					</div>
					<div class="surface-inset flex flex-col gap-1 rounded-lg px-3 py-2.5">
						<span class="text-muted-foreground text-xs">{i18n.t('trade.profit')}</span>
						<span class={cn('text-sm font-medium', pnlClass(details.profit))}>
							{signedCurrency(details.profit)}
						</span>
					</div>
					<div class="surface-inset flex flex-col gap-1 rounded-lg px-3 py-2.5">
						<span class="text-muted-foreground flex items-center gap-1 text-xs">
							{i18n.t('trade.roi')}
							<Tooltip.Root>
								<Tooltip.Trigger class="inline-flex">
									<CircleHelpIcon class="size-3" />
								</Tooltip.Trigger>
								<Tooltip.Content>{i18n.t('trade.roiTooltip')}</Tooltip.Content>
							</Tooltip.Root>
						</span>
						<span class={cn('text-sm font-medium', pnlClass(details.roi))}>
							{details.profit > 0 ? '+' : ''}{details.roi.toFixed(2)}%
						</span>
					</div>
					<div class="surface-inset flex flex-col gap-1 rounded-lg px-3 py-2.5">
						<span class="text-muted-foreground text-xs">{i18n.t('trade.fees')}</span>
						<span class="text-sm font-medium">{formatCurrency(details.fees)}</span>
					</div>
				</div>
			</div>
		</section>
	</div>
{/if}
