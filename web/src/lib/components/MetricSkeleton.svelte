<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { STABLE_CLASS } from '$lib/theme';

	type Props = {
		count?: number;
		gridClass?: string;
	};

	let { count = 9, gridClass = 'grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3' }: Props = $props();
</script>

<div class={gridClass}>
	{#each Array.from({ length: count }) as _, i (i)}
		<Card.Card size="sm" class="overflow-hidden">
			<Card.CardHeader class="pb-0">
				<div class="skeleton {STABLE_CLASS.label} h-3 w-16 rounded"></div>
			</Card.CardHeader>
			<Card.CardContent>
				<div class="skeleton {STABLE_CLASS.value} h-6 w-24 rounded"></div>
			</Card.CardContent>
		</Card.Card>
	{/each}
</div>
