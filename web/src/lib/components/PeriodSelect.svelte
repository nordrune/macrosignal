<script lang="ts">
	import { getI18n } from '$lib/i18n';
	import type { StringKey } from '$lib/i18n';
	import type { Period } from '$lib/types';
	import { PERIODS } from '$lib/types';
	import { cn } from '$lib/utils';

	let {
		value = $bindable(),
		onchange
	}: {
		value: Period;
		onchange?: () => void;
	} = $props();

	const i18n = getI18n();
	const periodKey = (p: Period): StringKey => `period.${p}` as StringKey;

	const selectClass = cn(
		'border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm',
		'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 outline-none'
	);
</script>

<!-- ponytail: native select — bits-ui Select child snippets fight strict TS -->
<select class={selectClass} bind:value {onchange}>
	{#each PERIODS as p (p)}
		<option value={p}>{i18n.t(periodKey(p))}</option>
	{/each}
</select>
