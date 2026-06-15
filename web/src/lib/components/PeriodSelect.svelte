<script lang="ts">
	import { getI18n } from '$lib/i18n';
	import type { StringKey } from '$lib/i18n';
	import type { Period } from '$lib/types';
	import { PERIODS } from '$lib/types';
	import { NATIVE_SELECT_CLASS } from '$lib/theme';

	let {
		value = $bindable(),
		onchange
	}: {
		value: Period;
		onchange?: () => void;
	} = $props();

	const i18n = getI18n();
	const periodKey = (p: Period): StringKey => `period.${p}` as StringKey;
</script>

<!-- ponytail: native select; bits-ui Select child snippets fight strict TS -->
<select class={NATIVE_SELECT_CLASS} bind:value {onchange}>
	{#each PERIODS as p (p)}
		<option value={p}>{i18n.t(periodKey(p))}</option>
	{/each}
</select>
