<script lang="ts">
	import { cn } from '$lib/utils';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';

	type Props = {
		active?: boolean;
		label?: string;
		class?: string;
	};

	let { active = false, label = '', class: className }: Props = $props();
</script>

{#if active}
	<div
		class={cn(
			'from-background/5 via-background/15 to-background/5 pointer-events-none absolute inset-0 z-10 flex items-start justify-end rounded-[inherit] bg-linear-to-br p-3',
			className
		)}
		aria-hidden={!label}
	>
		{#if label}
			<span
				class="border-border/60 bg-card/55 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs backdrop-blur-sm"
				role="status"
			>
				<Loader2Icon class="size-3 animate-spin" />
				{label}
			</span>
		{/if}
	</div>
{/if}
