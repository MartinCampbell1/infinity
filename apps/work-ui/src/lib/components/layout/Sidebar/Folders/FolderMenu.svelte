<script lang="ts">
	export let align: 'start' | 'end' = 'start';
	export let onEdit: () => void = () => {};
	export let onDelete: () => void = () => {};
	export let onExport: () => void = () => {};
	export let onCreateSub: () => void = () => {};

	void onEdit;
	void onDelete;
	void onExport;
	void onCreateSub;
</script>

<div data-align={align}>
	<slot />
</div>
