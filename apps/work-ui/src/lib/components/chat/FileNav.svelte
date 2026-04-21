<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { onMount } from 'svelte';

	export let onAttach: ((blob: Blob, name: string, contentType: string) => void | Promise<void>) | null = null;
	export let onWorkspaceStatusChange: ((status: Record<string, unknown>) => void) | null = null;
	export let overlay = false;

	onMount(() => {
		onWorkspaceStatusChange?.({
			source: 'terminal',
			currentPath: null,
			itemCount: 0,
			visibleItemCount: 0,
			linkedItemCount: 0,
			selectedFile: null,
			selectedFileName: null,
			attachEnabled: !!onAttach
		});
	});
</script>

<div class="flex h-full min-h-0 items-center justify-center px-3 py-4">
	<div class="max-w-sm rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
		File navigation support is available in the local workspace shell.
		{#if overlay}
			<div class="mt-2 text-xs">Drop files to attach them to the current chat.</div>
		{/if}
	</div>
</div>

