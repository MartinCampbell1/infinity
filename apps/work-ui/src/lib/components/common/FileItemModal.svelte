<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	export let show = false;
	export const item = null;
	export let edit = false;
</script>

{#if show}
	<div class="hidden" data-file-item-modal={edit ? 'edit' : 'view'}></div>
{/if}
