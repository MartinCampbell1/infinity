<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	export let page = 1;
	export let count = 0;
	export let perPage = 20;

	$: totalPages = Math.max(1, Math.ceil(count / Math.max(perPage, 1)));
	$: currentPage = Math.min(Math.max(page || 1, 1), totalPages);

	const goTo = (nextPage: number) => {
		page = Math.min(Math.max(nextPage, 1), totalPages);
	};
</script>

<div class="flex justify-center">
	<div class="my-2 flex items-center gap-2">
		<button
			class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-900"
			disabled={currentPage <= 1}
			on:click={() => goTo(currentPage - 1)}
		>
			Prev
		</button>

		<div class="flex items-center gap-1">
			{#each Array.from({ length: totalPages }, (_, index) => index + 1) as item}
				<button
					class={`min-w-8 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
						item === currentPage
							? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
							: 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-900'
					}`}
					on:click={() => goTo(item)}
				>
					{item}
				</button>
			{/each}
		</div>

		<button
			class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-900"
			disabled={currentPage >= totalPages}
			on:click={() => goTo(currentPage + 1)}
		>
			Next
		</button>
	</div>
</div>
