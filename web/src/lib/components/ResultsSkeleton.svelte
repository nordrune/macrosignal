<script lang="ts">
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';
	import MetricSkeleton from '$lib/components/MetricSkeleton.svelte';
	import { SURFACE_CLASS } from '$lib/theme';
</script>

<div class="space-y-3 sm:space-y-4" aria-hidden="true">
	<MetricSkeleton />
	<div
		class="{SURFACE_CLASS.inset} flex h-10 items-center justify-between rounded-lg px-4 py-2.5 sm:h-11"
	>
		<div class="skeleton h-3 w-16 rounded"></div>
		<div class="skeleton h-3 w-12 rounded"></div>
	</div>
	<ChartSkeleton />
	<div class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border md:grid-cols-4">
		{#each Array.from({ length: 4 }) as _, i (i)}
			<div class="{SURFACE_CLASS.inset} flex min-h-[4.5rem] flex-col gap-2 p-3">
				<div class="skeleton h-3 w-12 rounded"></div>
				<div class="skeleton h-4 w-20 rounded"></div>
			</div>
		{/each}
	</div>
</div>
