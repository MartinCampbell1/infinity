<script lang="ts">
	export let selected: string | null = null;
	export let onClose: () => void = () => {};
	export let onSubmit: (value: string) => void = () => {};
</script>

{#if false}
	{selected}
	{onClose}
	{onSubmit}
{/if}

<div>
	<slot />
</div>
