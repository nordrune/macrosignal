<script lang="ts">
	import { getI18n } from '$lib/i18n';
	import type { StringKey } from '$lib/i18n';
	import type { Interval } from '$lib/types';
	import { INTERVALS } from '$lib/types';
	import { NATIVE_SELECT_CLASS } from '$lib/theme';

	let {
		value = $bindable(),
		onchange
	}: {
		value: Interval;
		onchange?: () => void;
	} = $props();

	const i18n = getI18n();
	const intervalKey = (iv: Interval): StringKey => `interval.${iv}` as StringKey;
</script>

<select class={NATIVE_SELECT_CLASS} bind:value {onchange}>
	{#each INTERVALS as iv (iv)}
		<option value={iv}>{i18n.t(intervalKey(iv))}</option>
	{/each}
</select>
