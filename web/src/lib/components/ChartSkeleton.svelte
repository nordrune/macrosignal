<div
	class="-mx-1 space-y-2 rounded-md p-1 sm:mx-0 sm:space-y-3 sm:rounded-lg sm:p-3"
	aria-hidden="true"
>
	<div
		class="border-border surface-card h-52 w-full min-w-0 overflow-hidden rounded-md border sm:h-56 sm:rounded-lg md:h-64"
	>
		<div class="skeleton h-full w-full rounded-[inherit]"></div>
	</div>
	<div
		class="border-border surface-card h-24 w-full min-w-0 overflow-hidden rounded-md border sm:h-28 sm:rounded-lg"
	>
		<div class="skeleton h-full w-full rounded-[inherit]"></div>
	</div>
	<div class="flex flex-wrap justify-center gap-4">
		{#each Array.from({ length: 4 }) as _, i (i)}
			<div class="skeleton h-3 w-20 rounded"></div>
		{/each}
	</div>
</div>
