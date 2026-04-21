<!-- @ts-nocheck -->
<script>
	// @ts-nocheck
	export let model = null;
	export let shiftKey = false;
	export let onClick = () => {};
	export let onUnpin = null;
	void shiftKey;
	void onUnpin;
</script>

<button type="button" data-id={model?.id ?? ''} on:click={onClick}>
	{model?.name ?? model?.id ?? 'Pinned model'}
</button>
