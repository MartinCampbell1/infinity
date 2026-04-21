<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	export let type: 'default' | 'muted' | 'success' | 'warning' | 'danger' = 'default';
	export let content = '';
	export let className = '';

	$: toneClass =
		type === 'muted'
			? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
			: type === 'success'
				? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
				: type === 'warning'
					? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
					: type === 'danger'
						? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
						: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-100';
</script>

<span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClass} ${className}`}>
	{#if content}
		{content}
	{:else}
		<slot />
	{/if}
</span>
