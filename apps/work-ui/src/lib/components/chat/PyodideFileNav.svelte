<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import FileNav from './FileNav.svelte';

	export let onAttach: ((blob: Blob, name: string, contentType: string) => void | Promise<void>) | null = null;
	export let onWorkspaceStatusChange: ((status: Record<string, unknown>) => void) | null = null;
	export let overlay = false;
</script>

<FileNav {onAttach} {onWorkspaceStatusChange} {overlay} />
