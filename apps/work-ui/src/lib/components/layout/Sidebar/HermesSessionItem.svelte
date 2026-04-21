<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { createEventDispatcher, getContext } from 'svelte';

	import {
		getHermesSessionActivityLabel,
		formatHermesSessionSourceLine,
		getHermesSessionOrganizationBadges,
		type HermesSessionListItem
	} from '$lib/utils/hermesSessions';

	const i18n = getContext<any>('i18n');
	const dispatch = createEventDispatcher<{
		open: HermesSessionListItem;
		import: HermesSessionListItem;
	}>();

	export let session: HermesSessionListItem;
	export let busy = false;
	export let selected = false;
	export let className = '';

	$: activityLabel = getHermesSessionActivityLabel(session.updated_at);
	$: activityText = $i18n.t(activityLabel.key, activityLabel.values ?? {});
	$: sourceLine = formatHermesSessionSourceLine(session);
	$: organizationBadges = getHermesSessionOrganizationBadges(session, { maxTags: 1 });
	$: actionLabel = busy
		? session.imported_chat_id
			? `${$i18n.t('Opening')}...`
			: `${$i18n.t('Importing')}...`
		: session.imported_chat_id
			? $i18n.t('Open existing')
			: $i18n.t('Import and open');

	const handleActivate = () => {
		if (busy) {
			return;
		}

		if (session.imported_chat_id) {
			dispatch('open', session);
			return;
		}

		dispatch('import', session);
	};
</script>

<button
	type="button"
	class="group flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-gray-900/70 {selected ? 'bg-gray-50 dark:bg-gray-850' : ''} {className}"
	on:click={handleActivate}
	disabled={busy}
	aria-label={session.title}
	data-arrow-selected={selected ? 'true' : undefined}
>
	<div
		class="mt-1 size-2.5 shrink-0 rounded-full transition group-hover:bg-gray-400 dark:group-hover:bg-gray-500 {session.pinned || session.imported_chat_pinned
			? 'bg-amber-400 dark:bg-amber-300'
			: 'bg-gray-300 dark:bg-gray-700'}"
	></div>

	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			<div class="line-clamp-1 text-sm font-medium text-gray-800 dark:text-gray-100">
				{session.title}
			</div>

			{#if session.imported_chat_archived}
				<div
					class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
				>
					{$i18n.t('Archived')}
				</div>
			{/if}
		</div>

		<div class="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
			{activityText} · {session.message_count}
			{$i18n.t('Messages')}
		</div>

		{#if session.last_user_content}
			<div class="mt-0.5 line-clamp-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
				{session.last_user_content}
			</div>
		{/if}

		{#if sourceLine}
			<div class="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{sourceLine}</div>
		{/if}

		{#if organizationBadges.length > 0}
			<div class="mt-1 flex flex-wrap gap-1">
				{#each organizationBadges as badge}
					<div
						class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-300"
					>
						{badge}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="shrink-0 pt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
		{actionLabel}
	</div>
</button>
