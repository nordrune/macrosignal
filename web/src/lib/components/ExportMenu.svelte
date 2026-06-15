<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import type { BacktestResponse } from '$lib/api';
	import { exportRun, EXPORT_FORMATS, type ExportFormat, type RunSnapshot } from '$lib/export';
	import { getI18n } from '$lib/i18n';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	type Props = {
		result: BacktestResponse | null;
		snapshot: RunSnapshot | null;
		onError?: (message: string) => void;
	};

	let { result, snapshot, onError }: Props = $props();
	const i18n = getI18n();

	function handleExport(format: ExportFormat) {
		if (!result || !snapshot) {
			onError?.(i18n.t('export.empty'));
			return;
		}
		try {
			exportRun(result, snapshot, format, i18n);
		} catch (error) {
			onError?.(error instanceof Error ? error.message : i18n.t('export.empty'));
		}
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" disabled={!result}>
				{i18n.t('export.button')}
				<ChevronDownIcon />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		{#each EXPORT_FORMATS as format (format)}
			<DropdownMenu.Item onclick={() => handleExport(format as ExportFormat)}>
				{i18n.t(`export.${format}` as 'export.csv')}
			</DropdownMenu.Item>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>
