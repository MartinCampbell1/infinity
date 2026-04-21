<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { founderosLaunchContext } from '$lib/founderos';
	import { buildFounderosChatHref } from '$lib/founderos/navigation';

	import { getChatList, getPinnedChatList } from '$lib/apis/chats';
	import {
		getHermesRuntime,
		getHermesSessions,
		importHermesSession,
		type HermesRuntime,
		type HermesSession
	} from '$lib/apis/hermes';
	import Search from '$lib/components/icons/Search.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import {
		chats,
		currentChatPage,
		hermesRecentSessions,
		hermesSessionsByChatId,
		pinnedChats
	} from '$lib/stores';
	import {
		buildHermesSessionMapByImportedChatId,
		buildHermesSessionSummaryFromMessages,
		countHermesSessionsByScope,
		filterHermesSessions,
		formatHermesSessionSourceLine,
		formatHermesSessionMetaLine,
		getHermesChatMeta,
		getHermesContextBadges,
		getHermesSessionOrganizationBadges,
		getHiddenAuxiliaryHermesSessions,
		getPersistedHermesSessionContext,
		isCurrentHermesSession,
		getHermesSessionActivityLabel,
		groupHermesSessionsByTimeRange,
		type HermesSessionListItem,
		type HermesSessionScope
	} from '$lib/utils/hermesSessions';

	const i18n = getContext<any>('i18n');

	// TODO(21st): Replace this stopgap local panel pattern with a 21st.dev-derived micro-surface once MCP auth is fixed.

	export let active = false;
	export let chatId: string | null = null;
	export let chatHermesSession: Record<string, any> | null = null;
	export let chatMeta: Record<string, any> | null = null;
	export let history = {};
	export let models: any[] = [];
	export let taskIds: string[] | null = null;
	export let chatFiles: any[] = [];

	const getMessages = (history: any) => Object.values(history?.messages ?? {});

	let messages: any[] = [];
	let assistantCount = 0;
	let userCount = 0;
	let operationalTurns = 0;
	let loaded = false;
	let loading = false;
	let runtime: HermesRuntime | null = null;
	let sessions: HermesSession[] = [];
	let loadError = '';
	let importInFlightId: string | null = null;
	let openingChatId: string | null = null;
	let showAuxiliarySessions = false;
	let sessionQuery = '';
	let activeFilter: HermesSessionScope = 'all';
	let wasActive = false;
	let lastLoadedAt = 0;
	let showInspector = false;
	let sessionFilters: { id: HermesSessionScope; label: string }[] = [];

	const HERMES_SESSION_PANEL_REFRESH_TTL_MS = 10_000;

	$: messages = getMessages(history);
	$: assistantCount = messages.filter((message) => message?.role === 'assistant').length;
	$: userCount = messages.filter((message) => message?.role === 'user').length;
	$: operationalTurns = messages.filter(
		(message) =>
			message?.role === 'assistant' &&
			(!!message?.hermesApproval ||
				(message?.statusHistory?.length ?? 0) > 0 ||
				(message?.code_executions?.length ?? 0) > 0)
	).length;
	$: modelLabels = (models ?? []).map((model) => model?.name ?? model?.id).filter(Boolean);
	$: runtimeWarnings = runtime?.warnings ?? [];
	$: currentHermesMeta = getPersistedHermesSessionContext({
		chatHermesSession,
		chatMeta: getHermesChatMeta(chatMeta),
		runtime
	});
	$: currentHermesSessionId = currentHermesMeta?.session_id ?? null;
	$: auxiliarySessions = getHiddenAuxiliaryHermesSessions(sessions, {
		currentChatId: chatId,
		currentSessionId: currentHermesSessionId
	});
	$: baseVisibleSessions = showAuxiliarySessions
		? sessions
		: sessions.filter((session) => !auxiliarySessions.includes(session));
	$: sessionCounts = countHermesSessionsByScope(baseVisibleSessions, {
		currentChatId: chatId,
		currentSessionId: currentHermesSessionId
	});
	$: sessionFilters = [
		{ id: 'all', label: $i18n.t('All') },
		...(sessionCounts.imported > 0 ? [{ id: 'imported', label: $i18n.t('Imported') }] : []),
		...(sessionCounts.current > 0 ? [{ id: 'current', label: $i18n.t('Current chat') }] : [])
	] as { id: HermesSessionScope; label: string }[];
	$: if (!sessionFilters.some((filter) => filter.id === activeFilter)) {
		activeFilter = 'all';
	}
	$: hasSessionNarrowing = activeFilter !== 'all' || sessionQuery.trim().length > 0;
	$: visibleSessions = filterHermesSessions(baseVisibleSessions, {
		query: sessionQuery,
		scope: activeFilter,
		currentChatId: chatId,
		currentSessionId: currentHermesSessionId
	});
	$: groupedVisibleSessions = groupHermesSessionsByTimeRange(visibleSessions);
	$: currentHermesBadges = getHermesContextBadges(currentHermesMeta, { includeCliSource: true });
	$: currentHermesSummary = buildHermesSessionSummaryFromMessages(messages);
	$: currentHermesSummaryLine = formatHermesSessionMetaLine(currentHermesSummary, $i18n.t);
	$: currentHermesContextItems = [...currentHermesBadges, currentHermesSummaryLine].filter(Boolean);
	$: currentHermesModelLabel =
		formatModelLabel(currentHermesMeta?.model) ||
		formatModelLabel(currentHermesSummary?.latest_assistant_model);
	$: browserFallbackModelLabel = modelLabels.at(0) ?? '';
	$: runtimeDiffersFromSession =
		!!currentHermesMeta?.profile &&
		!!runtime?.active_profile &&
		currentHermesMeta.profile !== runtime.active_profile;

	const formatModelLabel = (modelId: string | null | undefined) => {
		if (!modelId) return '';
		return modelId.split('/').pop() ?? modelId;
	};

	const isCurrentSession = (session: HermesSessionListItem) =>
		isCurrentHermesSession(session, {
			currentChatId: chatId,
			currentSessionId: currentHermesSessionId
		});

	const getSessionStatusLabel = (session: HermesSessionListItem) => {
		if (isCurrentSession(session)) {
			return $i18n.t('Current');
		}

		if (session.imported_chat_archived) {
			return $i18n.t('Archived');
		}

		if (session.imported_chat_id) {
			return $i18n.t('Imported');
		}

		return '';
	};

	const getSessionActionLabel = (session: HermesSessionListItem) => {
		if (importInFlightId === session.session_id) {
			return `${$i18n.t('Importing')}...`;
		}

		if (session.imported_chat_id && openingChatId === session.imported_chat_id) {
			return `${$i18n.t('Opening')}...`;
		}

		if (isCurrentSession(session)) {
			return $i18n.t('Current');
		}

		if (session.imported_chat_archived) {
			return $i18n.t('Open archived');
		}

		if (session.imported_chat_id) {
			return $i18n.t('Open existing');
		}

		return $i18n.t('Import and open');
	};

	const formatSessionActivityLabel = (session: HermesSessionListItem) => {
		const activityLabel = getHermesSessionActivityLabel(session.updated_at);

		return $i18n.t(activityLabel.key, activityLabel.values ?? {});
	};

	const getSessionContextBadges = (session: HermesSessionListItem) => {
		return getHermesContextBadges(
			{
				session_id: session.session_id,
				profile: session.profile,
				source_tag: null
			},
			{ includeBaseLabel: false }
		);
	};

	const getSessionSourceLine = (session: HermesSessionListItem) =>
		formatHermesSessionSourceLine(session);

	const getSessionOrganizationBadges = (session: HermesSessionListItem) =>
		getHermesSessionOrganizationBadges(session, { maxTags: 2 });

	const refreshChatStores = async () => {
		currentChatPage.set(1);
		await chats.set(await getChatList(localStorage.token, 1));
		await pinnedChats.set(await getPinnedChatList(localStorage.token));
	};

	const getErrorMessage = (error: any, fallback: string) => {
		if (typeof error === 'string') {
			return error;
		}

		return error?.detail ?? error?.message ?? fallback;
	};

	const openChat = async (nextChatId: string) => {
		await refreshChatStores();
		await goto(buildFounderosChatHref(nextChatId, $founderosLaunchContext));
	};

	const handleOpenExisting = async (session: HermesSessionListItem) => {
		if (!session.imported_chat_id || openingChatId || importInFlightId) {
			return;
		}

		openingChatId = session.imported_chat_id;

		try {
			await openChat(session.imported_chat_id);
			toast.success(
				session.imported_chat_archived
					? $i18n.t('Opened archived Hermes session.')
					: $i18n.t('Opened existing Hermes session.')
			);
		} catch (error) {
			toast.error(getErrorMessage(error, $i18n.t('Failed to open Hermes session.')));
		} finally {
			openingChatId = null;
		}
	};

	const loadSessions = async (force = false) => {
		if (loading || (loaded && !force)) {
			return;
		}

		loading = true;
		loadError = '';

		const [runtimeRes, sessionsRes] = await Promise.all([
			getHermesRuntime(localStorage.token).catch((error) => {
				console.error(error);
				return null;
			}),
			getHermesSessions(localStorage.token).catch((error) => {
				console.error(error);
				return null;
			})
		]);

		runtime = runtimeRes;
		sessions = sessionsRes?.items ?? [];
		if (sessionsRes) {
			hermesRecentSessions.set(sessions);
			hermesSessionsByChatId.set(buildHermesSessionMapByImportedChatId(sessions));
		} else {
			loadError = $i18n.t('Failed to load Hermes sessions.');
		}

		if (!runtimeRes && !sessionsRes) {
			loadError = $i18n.t('Failed to load Hermes sessions.');
		}

		loaded = true;
		lastLoadedAt = Date.now();
		loading = false;
	};

	const handleImport = async (sessionId: string) => {
		if (importInFlightId) {
			return;
		}

		importInFlightId = sessionId;

		try {
			const res = await importHermesSession(localStorage.token, sessionId).catch((error) => {
				toast.error(getErrorMessage(error, $i18n.t('Failed to import Hermes session.')));
				return null;
			});

			if (res?.chat?.id) {
				await loadSessions(true);
				await openChat(res.chat.id);
				toast.success(
					res.already_imported
						? $i18n.t('Opened existing Hermes session.')
						: $i18n.t('Hermes session imported.')
				);
			}
		} catch (error) {
			toast.error(getErrorMessage(error, $i18n.t('Failed to open Hermes session.')));
		} finally {
			importInFlightId = null;
		}
	};

	$: if (active && !wasActive) {
		const shouldRefresh =
			!loaded || Date.now() - lastLoadedAt > HERMES_SESSION_PANEL_REFRESH_TTL_MS;
		wasActive = true;
		if (shouldRefresh && !loading) {
			loadSessions(true);
		}
	}

	$: if (!active && wasActive) {
		wasActive = false;
	}

	$: if (
		active &&
		loaded &&
		!loading &&
		($hermesRecentSessions.length > 0 || sessions.length > 0)
	) {
		sessions = $hermesRecentSessions;
	}
</script>

<div class="flex h-full min-h-0 flex-col px-2 py-2">
	<div
		class="rounded-xl border border-white/8 bg-slate-900/70 px-4 py-4"
	>
		<div class="text-sm font-medium text-slate-100">{$i18n.t('Session')}</div>
		<div class="mt-1 text-xs leading-5 text-slate-400">
			{$i18n.t('Current chat')} · {messages.length}
			{$i18n.t('Messages')}
		</div>
		{#if currentHermesContextItems.length > 0}
			<div class="mt-2 flex flex-wrap gap-1.5">
				{#each currentHermesContextItems as item}
					<div
						class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-300"
					>
						{item}
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-3 grid grid-cols-2 gap-2">
			<div class="rounded-xl border border-white/8 bg-white/5 px-3 py-2">
				<div class="text-[11px] uppercase tracking-[0.08em] text-slate-400">
					{$i18n.t('Assistant')}
				</div>
				<div class="mt-1 text-sm font-medium text-slate-200">
					{assistantCount}
				</div>
			</div>

			<div class="rounded-xl border border-white/8 bg-white/5 px-3 py-2">
				<div class="text-[11px] uppercase tracking-[0.08em] text-slate-400">
					{$i18n.t('User')}
				</div>
				<div class="mt-1 text-sm font-medium text-slate-200">{userCount}</div>
			</div>

			<div class="rounded-xl border border-white/8 bg-white/5 px-3 py-2">
				<div class="text-[11px] uppercase tracking-[0.08em] text-slate-400">
					{$i18n.t('Activity')}
				</div>
				<div class="mt-1 text-sm font-medium text-slate-200">
					{operationalTurns}
				</div>
			</div>

			<div class="rounded-xl border border-white/8 bg-white/5 px-3 py-2">
				<div class="text-[11px] uppercase tracking-[0.08em] text-slate-400">
					{$i18n.t('Files')}
				</div>
				<div class="mt-1 text-sm font-medium text-slate-200">
					{chatFiles.length}
				</div>
			</div>
		</div>
	</div>

	<div class="mt-2 flex flex-col gap-1.5 px-1 pb-2">
		<div
			class="rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2.5"
		>
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<div
						class="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400"
					>
						{$i18n.t('Hermes runtime model')}
					</div>
					<div class="mt-2 flex flex-wrap gap-1.5">
						<div
							class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-300"
						>
							Hermes
						</div>
						{#if currentHermesModelLabel}
							<div
								class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-300"
							>
								{$i18n.t('Inherited model')}: {currentHermesModelLabel}
							</div>
						{:else}
							<div
								class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-300"
							>
								{$i18n.t('Inherited from active Hermes profile')}
							</div>
						{/if}
					</div>
					<div class="mt-1 text-[11px] text-slate-400">
						{$i18n.t('Configured by Hermes profile, not the Open WebUI model selector.')}
						{#if browserFallbackModelLabel}
							<span class="ml-1">
								{$i18n.t('Browser fallback')}: {browserFallbackModelLabel}
							</span>
						{/if}
					</div>
				</div>

				<div
					class="shrink-0 rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
				>
					{$i18n.t('Tasks')} · {taskIds?.length ?? 0}
				</div>
			</div>
		</div>

		<div
			class="rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2.5"
		>
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<div
						class="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400"
					>
						{$i18n.t('Current runtime')}
					</div>
					<div class="mt-1 text-sm text-slate-200">
						{runtime?.active_profile ?? $i18n.t('Default profile')}
					</div>
					{#if runtimeDiffersFromSession}
						<div class="mt-1 text-[11px] text-slate-400">
							{$i18n.t('May differ from imported session context.')}
						</div>
					{/if}
				</div>
				<div class="flex items-center gap-1.5">
					<button
						type="button"
						class="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/12"
						on:click={() => {
							showInspector = !showInspector;
						}}
					>
						{$i18n.t(showInspector ? 'Hide inspector' : 'Show inspector')}
					</button>
					<button
						type="button"
						class="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/12"
						on:click={() => {
							loaded = false;
							loadSessions(true);
						}}
					>
						{$i18n.t('Refresh')}
					</button>
				</div>
			</div>

			{#if showInspector}
				{#if loading && !loaded}
					<div class="mt-3 flex h-10 items-center justify-center">
						<Spinner className="size-4" />
					</div>
				{:else if runtime}
					<div class="mt-2 flex flex-col gap-1.5 text-xs text-slate-400">
						<div class="line-clamp-1">{$i18n.t('Home directory')}: {runtime.active_home}</div>
						<div class="line-clamp-1">
							{$i18n.t('Agent')}: {runtime.agent_dir ?? $i18n.t('Not found')}
						</div>
						<div class="line-clamp-1">{$i18n.t('Python')}: {runtime.python_path}</div>
					</div>
				{:else}
					<div class="mt-2 text-sm text-slate-400">
						{$i18n.t('Hermes runtime is unavailable.')}
					</div>
				{/if}

				{#if runtimeWarnings.length > 0}
					<div
						class="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
					>
						{#each runtimeWarnings as warning}
							<div>{warning}</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<div
		class="mt-2 flex min-h-0 flex-1 flex-col rounded-xl border border-white/8 bg-slate-900/70"
	>
		<div class="flex items-center justify-between gap-3 px-3 py-3">
			<div>
				<div class="text-sm font-medium text-slate-100">
					{$i18n.t('Hermes sessions')}
				</div>
				<div class="text-[11px] text-slate-400">
					{$i18n.t('Hermes session history')} · {visibleSessions.length}
					{#if hasSessionNarrowing}
						/ {baseVisibleSessions.length}
					{:else if auxiliarySessions.length > 0 && !showAuxiliarySessions}
						/ {sessions.length}
					{/if}
				</div>
			</div>

			{#if chatId}
				<div
					class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
				>
					{$i18n.t('Current chat')}
				</div>
			{/if}
		</div>

		{#if showInspector && auxiliarySessions.length > 0}
			<div
				class="mx-3 mb-1 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-[11px] text-slate-400"
			>
				<div class="min-w-0">
					{#if showAuxiliarySessions}
						{$i18n.t('Showing auxiliary and system sessions alongside main history.')}
					{:else}
						{auxiliarySessions.length} {$i18n.t('auxiliary or system sessions hidden by default.')}
					{/if}
				</div>

				<button
					type="button"
					class="shrink-0 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 font-medium text-slate-300 transition hover:bg-white/12"
					on:click={() => {
						showAuxiliarySessions = !showAuxiliarySessions;
					}}
				>
					{#if showAuxiliarySessions}
						{$i18n.t('Hide auxiliary and system sessions')}
					{:else}
						{$i18n.t('Show hidden')} · {auxiliarySessions.length}
					{/if}
				</button>
			</div>
		{/if}

		<div class="px-3 pb-2">
			<div class="flex items-center gap-2">
				<div class="flex flex-1 items-center rounded-xl border border-white/8 bg-white/5 px-3 py-2">
					<div class="mr-2 text-slate-400">
						<Search className="size-3.5" />
					</div>
					<input
						class="w-full bg-transparent text-sm outline-hidden"
						bind:value={sessionQuery}
						placeholder={$i18n.t('Search Sessions')}
					/>
				</div>
			</div>

			{#if sessionFilters.length > 1}
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each sessionFilters as filter}
						<button
							type="button"
							class="{activeFilter === filter.id
								? 'border border-white/10 bg-white/12 text-white'
								: 'border border-white/8 bg-white/6 text-slate-300'} rounded-full px-2.5 py-1 text-[11px] font-medium transition hover:bg-white/10"
							on:click={() => {
								activeFilter = filter.id;
							}}
						>
							{#if filter.id === 'all'}
								{filter.label} · {sessionCounts.all}
							{:else if filter.id === 'imported'}
								{filter.label} · {sessionCounts.imported}
							{:else if filter.id === 'current'}
								{filter.label} · {sessionCounts.current}
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="flex-1 min-h-0 overflow-y-auto px-1 pb-2">
			{#if loading && !loaded}
				<div class="flex h-24 items-center justify-center">
					<Spinner className="size-4" />
				</div>
			{:else if loadError}
				<div class="px-3 py-8 text-center text-sm text-slate-400">
					{loadError}
				</div>
			{:else if sessions.length === 0}
				<div class="px-3 py-8 text-center text-sm text-slate-400">
					{$i18n.t('No Hermes sessions found.')}
				</div>
			{:else if visibleSessions.length === 0}
				<div class="px-3 py-8 text-center text-sm text-slate-400">
					{#if hasSessionNarrowing}
						{$i18n.t('No Hermes sessions match the current search or filters.')}
					{:else}
						{$i18n.t('Only auxiliary or system sessions are available right now.')}
					{/if}
				</div>
			{:else}
				<div class="flex flex-col gap-1.5">
					{#each groupedVisibleSessions as group, groupIndex (group.label)}
						<div
							class="px-2 pb-1 text-xs font-medium text-slate-400 {groupIndex ===
							0
								? ''
								: 'pt-4'}"
						>
							{$i18n.t(group.label)}
							<!-- localisation keys for time_range to be recognized from the i18next parser:
								{$i18n.t('Today')}
								{$i18n.t('Yesterday')}
								{$i18n.t('Previous 7 days')}
								{$i18n.t('Previous 30 days')}
								{$i18n.t('January')}
								{$i18n.t('February')}
								{$i18n.t('March')}
								{$i18n.t('April')}
								{$i18n.t('May')}
								{$i18n.t('June')}
								{$i18n.t('July')}
								{$i18n.t('August')}
								{$i18n.t('September')}
								{$i18n.t('October')}
								{$i18n.t('November')}
								{$i18n.t('December')}
								{$i18n.t('Earlier')}
							-->
						</div>

						{#each group.items as session (session.session_id)}
							<div
								class="rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2.5"
							>
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<div
												class="line-clamp-1 text-sm font-medium text-slate-100"
											>
												{session.title}
											</div>
											{#if getSessionStatusLabel(session)}
												<div
													class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] font-medium text-slate-300"
												>
													{getSessionStatusLabel(session)}
												</div>
											{/if}
											{#if session.is_auxiliary_cli_session}
												<div
													class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
												>
													{$i18n.t('Auxiliary')}
												</div>
											{/if}
											<div
												class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
											>
												{formatModelLabel(session.model) || $i18n.t('Unknown')}
											</div>
										</div>

										<div class="mt-1 text-[11px] text-slate-400">
											{formatSessionActivityLabel(session)} · {session.message_count}
											{$i18n.t('Messages')}
										</div>

										{#if session.last_user_content}
											<div
												class="mt-1 line-clamp-2 text-xs leading-5 text-slate-400"
											>
												{session.last_user_content}
											</div>
										{/if}

										{#if getSessionSourceLine(session)}
											<div class="mt-2 text-[11px] text-slate-400">
												{getSessionSourceLine(session)}
											</div>
										{/if}

										{#if getSessionContextBadges(session).length > 0}
											<div class="mt-2 flex flex-wrap gap-1.5">
												{#each getSessionContextBadges(session) as badge}
													<div
														class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
													>
														{badge}
													</div>
												{/each}
											</div>
										{/if}

										{#if getSessionOrganizationBadges(session).length > 0}
											<div class="mt-2 flex flex-wrap gap-1.5">
												{#each getSessionOrganizationBadges(session) as badge}
													<div
														class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
													>
														{badge}
													</div>
												{/each}
											</div>
										{/if}
									</div>

									<div class="shrink-0">
										<button
											type="button"
											class="rounded-full border border-sky-500/20 bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
											on:click={async () => {
												if (isCurrentSession(session)) {
													return;
												}

												if (session.imported_chat_id) {
													await handleOpenExisting(session);
													return;
												}

												handleImport(session.session_id);
											}}
											disabled={importInFlightId !== null ||
												openingChatId !== null ||
												isCurrentSession(session)}
										>
											{getSessionActionLabel(session)}
										</button>
									</div>
								</div>
							</div>
						{/each}
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
