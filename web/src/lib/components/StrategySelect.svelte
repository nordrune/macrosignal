<script lang="ts">
	import { getI18n } from '$lib/i18n';
	import type { StrategyType } from '$lib/strategy';
	import { NATIVE_SELECT_CLASS } from '$lib/theme';

	let {
		value = $bindable(),
		onchange
	}: {
		value: StrategyType;
		onchange?: () => void;
	} = $props();

	const i18n = getI18n();
</script>

<select class={NATIVE_SELECT_CLASS} bind:value {onchange}>
	<option value="sma">{i18n.t('strategy.sma')}</option>
	<option value="ema">{i18n.t('strategy.ema')}</option>
</select>
