<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { SURFACE_CLASS } from '$lib/theme';

	type Props = {
		columns?: number;
		rows?: number;
	};

	let { columns = 6, rows = 5 }: Props = $props();

	const widths = ['w-10', 'w-14', 'w-16', 'w-12', 'w-10', 'w-16'] as const;
</script>

<div class="{SURFACE_CLASS.table} overflow-x-auto rounded-lg border" aria-hidden="true">
	<Table.Table>
		<Table.TableHeader>
			<Table.TableRow>
				{#each Array.from({ length: columns }) as _, i (i)}
					<Table.TableHead>
						<div class="skeleton h-3 {widths[i % widths.length]} rounded"></div>
					</Table.TableHead>
				{/each}
			</Table.TableRow>
		</Table.TableHeader>
		<Table.TableBody>
			{#each Array.from({ length: rows }) as _, row (row)}
				<Table.TableRow>
					{#each Array.from({ length: columns }) as _, col (col)}
						<Table.TableCell>
							<div class="skeleton h-3 {widths[(row + col) % widths.length]} rounded"></div>
						</Table.TableCell>
					{/each}
				</Table.TableRow>
			{/each}
		</Table.TableBody>
	</Table.Table>
</div>
