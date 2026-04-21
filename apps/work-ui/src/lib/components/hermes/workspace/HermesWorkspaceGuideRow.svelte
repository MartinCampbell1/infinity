<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { getContext } from 'svelte';

	const i18n = getContext<any>('i18n');

	// TODO(21st): Replace this local guide row pattern with a 21st.dev-derived pattern once MCP auth is fixed.

	export let title = '';
	export let description = '';
	export let metaItems: string[] = [];

	$: visibleMetaItems = metaItems.filter(Boolean);
</script>

<div
	class="mx-2 mb-2 rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2.5"
>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<div class="text-xs font-medium text-slate-200">
				{title || $i18n.t('Workspace')}
			</div>
			{#if description}
				<div class="mt-0.5 text-[11px] leading-5 text-slate-400">
					{description}
				</div>
			{/if}
		</div>

		{#if $$slots.actions}
			<div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
				<slot name="actions" />
			</div>
		{/if}
	</div>

	{#if visibleMetaItems.length > 0}
		<div class="mt-2 flex flex-wrap gap-1.5">
			{#each visibleMetaItems as item}
				<div
					class="max-w-full rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
				>
					<span class="block max-w-full truncate">{item}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
