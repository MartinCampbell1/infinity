<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	export let show = false;
</script>

{#if show}
	<div class="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 px-4">
		<div class="w-full max-w-2xl rounded-3xl border border-white/10 bg-white p-6 text-gray-900 shadow-2xl dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
			<div class="flex items-start justify-between gap-4">
				<div>
					<div class="text-xl font-medium">What's New</div>
					<div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Release notes are not wired in this bounded copy yet.
					</div>
				</div>
				<button
					type="button"
					class="rounded-full px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-900"
					on:click={() => {
						show = false;
					}}
				>
					Close
				</button>
			</div>
			<div class="mt-6 rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
				This modal is intentionally minimal so the embedded workspace can compile without
				pulling the full upstream changelog stack.
			</div>
		</div>
	</div>
{/if}
