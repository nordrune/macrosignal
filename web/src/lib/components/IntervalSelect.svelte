<script lang="ts">
	import { getI18n } from '$lib/i18n';
	import type { StringKey } from '$lib/i18n';
	import type { Interval } from '$lib/types';
	import { INTERVALS } from '$lib/types';
	import { cn } from '$lib/utils';

	let {
		value = $bindable(),
		onchange
	}: {
		value: Interval;
		onchange?: () => void;
	} = $props();

	const i18n = getI18n();
	const intervalKey = (iv: Interval): StringKey => `interval.${iv}` as StringKey;

	const selectClass = cn(
		'border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm',
		'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 outline-none'
	);
</script>

<select class={selectClass} bind:value {onchange}>
	{#each INTERVALS as iv (iv)}
		<option value={iv}>{i18n.t(intervalKey(iv))}</option>
	{/each}
</select>
