<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { getContext } from 'svelte';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Check from '$lib/components/icons/Check.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import EllipsisHorizontal from '$lib/components/icons/EllipsisHorizontal.svelte';

	const i18n = getContext<any>('i18n');

	type ToolState = 'running' | 'done' | 'failed' | 'idle';

	export let name = '';
	export let summary = '';
	export let state: ToolState = 'idle';
	export let onClick: () => void = () => {};
	export let actionLabel = '';
	export let actionAriaLabel = '';
	export let onActionClick: () => void = () => {};
	export let meta = '';

	$: stateLabel =
		state === 'running'
			? $i18n.t('Running')
			: state === 'failed'
				? $i18n.t('Failed')
				: state === 'done'
					? $i18n.t('Done')
					: $i18n.t('Ready');
	$: statePillClass =
		state === 'running'
			? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
			: state === 'failed'
				? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
				: state === 'done'
					? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
					: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
</script>

<div
	class="flex w-full items-center gap-2 rounded-lg bg-white/75 transition hover:bg-white dark:bg-gray-950/70 dark:hover:bg-gray-950"
>
	<button
		type="button"
		class="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
		on:click={onClick}
	>
		<div
			class="flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300"
		>
			{#if state === 'running'}
				<Spinner className="size-3" />
			{:else if state === 'failed'}
				<XMark className="size-3" />
			{:else if state === 'done'}
				<Check strokeWidth="3" className="size-3" />
			{:else}
				<EllipsisHorizontal className="size-3" />
			{/if}
		</div>

		<div class="min-w-0 flex-1">
			<div class="line-clamp-1 text-sm font-medium text-gray-700 dark:text-gray-200">{name}</div>
			{#if summary}
				<div class="line-clamp-1 text-[11px] text-gray-500 dark:text-gray-400">{summary}</div>
			{/if}
			{#if meta}
				<div class="line-clamp-1 text-[11px] text-gray-400 dark:text-gray-500">{meta}</div>
			{/if}
		</div>

		<div class={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statePillClass}`}>
			{stateLabel}
		</div>
	</button>

	{#if actionLabel}
		<button
			type="button"
			class="mr-2 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			aria-label={actionAriaLabel || actionLabel}
			on:click={onActionClick}
		>
			{actionLabel}
		</button>
	{/if}
</div>
