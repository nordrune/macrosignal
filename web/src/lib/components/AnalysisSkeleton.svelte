<script lang="ts">
	import MetricSkeleton from '$lib/components/MetricSkeleton.svelte';

	const sections = [
		{ count: 9, gridClass: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' },
		{ count: 4, gridClass: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' },
		{ count: 5, gridClass: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' },
		{ count: 4, gridClass: 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' }
	] as const;
</script>

<div class="flex flex-col gap-6" aria-hidden="true">
	<div>
		<div class="skeleton h-5 w-40 rounded"></div>
		<div class="skeleton mt-2 h-3 w-64 max-w-full rounded"></div>
	</div>
	{#each sections as section, i (i)}
		<div class="flex flex-col gap-3">
			<div class="skeleton h-3 w-24 rounded"></div>
			<MetricSkeleton count={section.count} gridClass={section.gridClass} />
		</div>
	{/each}
</div>
