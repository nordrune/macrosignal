<script lang="ts">
	import { getI18n } from '$lib/i18n';
	import type { StrategyType } from '$lib/strategy';
	import { cn } from '$lib/utils';

	let {
		value = $bindable(),
		onchange
	}: {
		value: StrategyType;
		onchange?: () => void;
	} = $props();

	const i18n = getI18n();

	const selectClass = cn(
		'border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm',
		'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 outline-none'
	);
</script>

<select class={selectClass} bind:value {onchange}>
	<option value="sma">{i18n.t('strategy.sma')}</option>
	<option value="ema">{i18n.t('strategy.ema')}</option>
</select>
