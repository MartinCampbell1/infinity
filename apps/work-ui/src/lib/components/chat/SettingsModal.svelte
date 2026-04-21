<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	export let show = false;

	const sections = [
		'General',
		'Interface',
		'Connections',
		'Audio',
		'Data Controls',
		'Personalization'
	];
</script>

{#if show}
	<div class="fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 px-4">
		<div class="w-full max-w-3xl rounded-3xl border border-white/10 bg-white p-6 text-gray-900 shadow-2xl dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100">
			<div class="flex items-start justify-between gap-4">
				<div>
					<div class="text-xl font-medium">Settings</div>
					<div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Minimal bounded settings shell for workspace boot.
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

			<div class="mt-6 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
				<div class="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-900/60">
					{#each sections as section}
						<div class="rounded-xl px-3 py-2 text-gray-600 dark:text-gray-300">
							{section}
						</div>
					{/each}
				</div>
				<div class="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
					This bounded copy intentionally omits the upstream settings tree and keeps only the
					layout contract expected by <code>+layout.svelte</code>.
				</div>
			</div>
		</div>
	</div>
{/if}
