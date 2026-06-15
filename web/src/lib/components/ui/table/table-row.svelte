<script lang="ts">
	import { cn, type WithElementRef } from '$lib/utils.js';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLTableRowElement>> = $props();
</script>

<tr
	bind:this={ref}
	data-slot="table-row"
	class={cn(
		'border-b transition-colors hover:bg-[var(--surface-row-hover)] data-[state=selected]:bg-[var(--surface-row-selected)]',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</tr>
