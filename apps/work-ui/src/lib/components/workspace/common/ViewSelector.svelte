<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	export let value = '';
	export let onChange: (value: string) => void = () => {};

	const options = [
		{ value: '', label: 'All' },
		{ value: 'created', label: 'Created by you' },
		{ value: 'shared', label: 'Shared with you' }
	];
</script>

<select
	class="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 outline-none transition focus:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
	bind:value
	on:change={(event) => onChange((event.currentTarget as HTMLSelectElement).value)}
>
	{#each options as option}
		<option value={option.value}>{option.label}</option>
	{/each}
</select>

