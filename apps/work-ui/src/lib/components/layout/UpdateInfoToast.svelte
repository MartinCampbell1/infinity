<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let version: { current: string; latest: string } = {
		current: '',
		latest: ''
	};
</script>

<div class="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-lg dark:border-blue-900/50 dark:bg-blue-950/70 dark:text-blue-100">
	<div class="flex-1">
		<div class="font-medium">
			A new version is available.
		</div>
		<div class="mt-1 text-xs opacity-80">
			Current: {version.current} · Latest: {version.latest}
		</div>
	</div>
	<button
		type="button"
		class="rounded-full px-2 py-1 text-xs font-medium transition hover:bg-blue-100 dark:hover:bg-blue-900/50"
		on:click={() => dispatch('close')}
	>
		Close
	</button>
</div>
