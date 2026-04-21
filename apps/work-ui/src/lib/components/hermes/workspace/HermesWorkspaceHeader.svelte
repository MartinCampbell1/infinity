<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { getContext } from 'svelte';

	const i18n = getContext<any>('i18n');

	export let label = '';
	export let title = '';
	export let subtitle = '';
	export let badge = '';
	export let metaItems: string[] = [];
	export let compact = false;

	$: visibleMetaItems = metaItems.filter(Boolean);
	$: labelText = label || $i18n.t('Workspace');
	$: titleText = title || $i18n.t('Workspace surface');
	$: badgeToneClass =
		badge === 'Ready'
			? 'border-emerald-500/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-100'
			: badge === 'Saving' || badge === 'Working' || badge === 'Verifying'
				? 'border-sky-500/20 bg-sky-500/12 text-sky-700 dark:text-sky-100'
				: 'border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-100';
</script>

<div
	class="border-b border-black/8 bg-[linear-gradient(180deg,rgba(250,247,240,0.96),rgba(250,247,240,0.84))] px-3 py-3 backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.64))]"
>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-2">
				{#if !compact}
					<div
						class="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400"
					>
						{labelText}
					</div>
				{/if}
				{#if badge}
					<div
						class={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${badgeToneClass}`}
					>
						{badge}
					</div>
				{/if}
			</div>
			<div
				class={`line-clamp-1 font-semibold tracking-[-0.02em] text-slate-100 ${compact ? 'mt-1 text-[14px]' : 'mt-2 text-[15px]'}`}
			>
				{titleText}
			</div>
			{#if subtitle}
				<div class={`text-[12px] leading-5 text-slate-500 dark:text-slate-400 ${compact ? 'mt-0.5' : 'mt-1'}`}>
					{subtitle}
				</div>
			{/if}
		</div>

		{#if $$slots.actions}
			<div class="flex shrink-0 flex-wrap justify-end gap-1.5">
				<slot name="actions" />
			</div>
		{/if}
	</div>

	{#if visibleMetaItems.length > 0}
		<div class={`flex flex-wrap gap-1.5 ${compact ? 'mt-2' : 'mt-3'}`}>
			{#each visibleMetaItems as item}
				<div
					class="max-w-full rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[10px] text-slate-400"
				>
					<span class="block max-w-full truncate">{item}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
