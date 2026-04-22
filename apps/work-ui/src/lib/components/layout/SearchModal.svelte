<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { toast } from 'svelte-sonner';
	import { getContext, onDestroy, onMount, tick } from 'svelte';
	const i18n = getContext('i18n');

	import Modal from '$lib/components/common/Modal.svelte';
	import SearchInput from './Sidebar/SearchInput.svelte';
	import { getChatById, getChatList, getChatListBySearchText } from '$lib/apis/chats';
	import { getHermesSessions, importHermesSession } from '$lib/apis/hermes';
	import Spinner from '../common/Spinner.svelte';

	import dayjs from '$lib/dayjs';
	import localizedFormat from 'dayjs/plugin/localizedFormat';
	import calendar from 'dayjs/plugin/calendar';
	import Loader from '../common/Loader.svelte';
	import { createMessagesList } from '$lib/utils';
	import { config, hermesRecentSessions, hermesSessionsByChatId, user } from '$lib/stores';
	import Messages from '../chat/Messages.svelte';
	import { goto } from '$app/navigation';
	import { founderosLaunchContext } from '$lib/founderos';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';
	import { buildFounderosChatHref, buildFounderosRootHref } from '$lib/founderos/navigation';
	import PencilSquare from '../icons/PencilSquare.svelte';
	import PageEdit from '../icons/PageEdit.svelte';
	import HermesSessionItem from './Sidebar/HermesSessionItem.svelte';
	import {
		buildHermesSessionMapByImportedChatId,
		formatHermesChatListMetaLine,
		getSearchableHermesSessions,
		groupHermesSessionsByTimeRange,
		resolveHermesChatMeta,
		type HermesSessionListItem
	} from '$lib/utils/hermesSessions';
	dayjs.extend(calendar);
	dayjs.extend(localizedFormat);

	export let show = false;
	export let onClose = () => {};

	let actions = [
		{
			label: $i18n.t('Start a new conversation'),
			onClick: async () => {
				await goto(buildFounderosRootHref($founderosLaunchContext, query ? { q: query } : {}));
				show = false;
				onClose();
			},
			icon: PencilSquare
		}
	];

	let query = '';
	let page = 1;

	let chatList = null;

	let chatListLoading = false;
	let allChatsLoaded = false;
	let hermesSessionsLoading = false;
	let hermesSessionsRefreshQueued = false;
	let hermesSessionsLoadError = '';
	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	let searchDebounceTimeout;

	let selectedIdx = null;
	let selectedChat = null;
	let hermesSessionActionId: string | null = null;

	let selectedModels = [''];
	let history = null;
	let messages = null;

	const getChatListMetaLine = (chat) => {
		return formatHermesChatListMetaLine({
			hermesMeta: resolveHermesChatMeta(chat?.meta, chat?.chat),
			session: $hermesSessionsByChatId[chat?.id] ?? null,
			summary: chat?.session_summary,
			translate: $i18n.t
		});
	};

	$: searchableHermesSessions = getSearchableHermesSessions($hermesRecentSessions, {
		query,
		includeAuxiliary: true
	});
	$: groupedHermesSessions = groupHermesSessionsByTimeRange(searchableHermesSessions);
	$: chatResultCount = chatList?.length ?? 0;
	$: hermesResultOffset = actions.length + chatResultCount;
	$: totalSelectableItemCount = actions.length + chatResultCount + searchableHermesSessions.length;
	$: showHermesSessionsSection =
		hermesSessionsLoading || $hermesRecentSessions.length > 0 || query.trim().length > 0;

	$: if (!chatListLoading && chatList) {
		loadChatPreview(selectedIdx);
	}

	const loadChatPreview = async (selectedIdx) => {
		if (!chatList || chatList.length === 0 || selectedIdx === null) {
			selectedChat = null;
			messages = null;
			history = null;
			selectedModels = [''];
			return;
		}

		const selectedChatIdx = selectedIdx - actions.length;
		if (selectedChatIdx < 0 || selectedChatIdx >= chatList.length) {
			selectedChat = null;
			messages = null;
			history = null;
			selectedModels = [''];
			return;
		}

		const chatId = chatList[selectedChatIdx].id;

		const chat = await getChatById(getWorkspaceAuthToken(), chatId).catch(async (error) => {
			return null;
		});

		if (chat) {
			if (chat?.chat?.history) {
				selectedModels =
					(chat?.chat?.models ?? undefined) !== undefined
						? chat?.chat?.models
						: [chat?.chat?.models ?? ''];

				history = chat?.chat?.history;
				messages = createMessagesList(chat?.chat?.history, chat?.chat?.history?.currentId);

				// scroll to the bottom of the messages container
				await tick();
				const messagesContainerElement = document.getElementById('chat-preview');
				if (messagesContainerElement) {
					messagesContainerElement.scrollTop = messagesContainerElement.scrollHeight;
				}
			} else {
				messages = [];
			}
		} else {
			toast.error($i18n.t('Failed to load chat preview'));
			selectedChat = null;
			messages = null;
			history = null;
			selectedModels = [''];
			return;
		}
	};

	const searchHandler = async () => {
		if (!show) {
			return;
		}

		if (searchDebounceTimeout) {
			clearTimeout(searchDebounceTimeout);
		}

		page = 1;
		chatList = null;
		if (query === '') {
			chatList = await getChatList(getWorkspaceAuthToken(), page);
		} else {
			searchDebounceTimeout = setTimeout(async () => {
				chatList = await getChatListBySearchText(getWorkspaceAuthToken(), query, page);

				if ((chatList ?? []).length === 0) {
					allChatsLoaded = true;
				} else {
					allChatsLoaded = false;
				}
			}, 500);
		}

		selectedChat = null;
		messages = null;
		history = null;
		selectedModels = [''];

		if ((chatList ?? []).length === 0) {
			allChatsLoaded = true;
		} else {
			allChatsLoaded = false;
		}
	};

	const loadMoreChats = async () => {
		chatListLoading = true;
		page += 1;

		let newChatList = [];

		if (query) {
			newChatList = await getChatListBySearchText(getWorkspaceAuthToken(), query, page);
		} else {
			newChatList = await getChatList(getWorkspaceAuthToken(), page);
		}

		// once the bottom of the list has been reached (no results) there is no need to continue querying
		allChatsLoaded = newChatList.length === 0;

		if (newChatList.length > 0) {
			const existingIds = new Set(chatList.map((c) => c.id));
			const uniqueNewChats = newChatList.filter((c) => !existingIds.has(c.id));
			chatList = [...chatList, ...uniqueNewChats];
		}

		chatListLoading = false;
	};

	const refreshHermesSessionList = async () => {
		const token = getWorkspaceAuthToken();
		if (!show || !token) {
			return;
		}

		if (hermesSessionsLoading) {
			hermesSessionsRefreshQueued = true;
			return;
		}

		hermesSessionsLoading = true;
		hermesSessionsLoadError = '';

		try {
			const sessionsPayload = await getHermesSessions(token);
			const sessions = sessionsPayload?.items ?? [];
			hermesRecentSessions.set(sessions);
			hermesSessionsByChatId.set(buildHermesSessionMapByImportedChatId(sessions));
		} catch (error) {
			hermesSessionsLoadError = $i18n.t('Failed to load Hermes sessions.');
			console.debug('Failed to refresh Hermes sessions for search modal:', error);
		} finally {
			hermesSessionsLoading = false;

			if (hermesSessionsRefreshQueued) {
				hermesSessionsRefreshQueued = false;
				refreshHermesSessionList();
			}
		}
	};

	const refreshHermesSessionListIfVisible = () => {
		if (document.visibilityState !== 'hidden') {
			refreshHermesSessionList();
		}
	};

	const openOrImportHermesSession = async (session: HermesSessionListItem) => {
		if (!session?.session_id || hermesSessionActionId) {
			return;
		}

		hermesSessionActionId = session.imported_chat_id || session.session_id;

		try {
			const res = await importHermesSession(getWorkspaceAuthToken(), session.session_id).catch(
				(error) => {
					toast.error(`${error}`);
					return null;
				}
			);

			if (res?.chat?.id) {
				await refreshHermesSessionList();
				await goto(buildFounderosChatHref(res.chat.id, $founderosLaunchContext));
				show = false;
				onClose();
			}
		} catch (error) {
			toast.error(`${error}`);
		} finally {
			hermesSessionActionId = null;
		}
	};

	$: if (show) {
		searchHandler();
		refreshHermesSessionList();
	}

	const onKeyDown = (e) => {
		const searchOptions = document.getElementById('search-options-container');
		if (searchOptions || !show) {
			return;
		}

		if (e.code === 'Escape') {
			show = false;
			onClose();
		} else if (e.code === 'Enter') {
			const item = document.querySelector(`[data-arrow-selected="true"]`);
			if (item) {
				item?.click();
				show = false;
			}

			return;
		} else if (e.code === 'ArrowDown') {
			const searchInput = document.getElementById('search-input');

			if (searchInput) {
				// check if focused on the search input
				if (document.activeElement === searchInput) {
					searchInput.blur();
					selectedIdx = 0;
					return;
				}
			}

			selectedIdx = Math.min(selectedIdx + 1, Math.max(totalSelectableItemCount - 1, 0));
		} else if (e.code === 'ArrowUp') {
			if (selectedIdx === 0) {
				const searchInput = document.getElementById('search-input');

				if (searchInput) {
					// check if focused on the search input
					if (document.activeElement !== searchInput) {
						searchInput.focus();
						selectedIdx = 0;
						return;
					}
				}
			}

			selectedIdx = Math.max(selectedIdx - 1, 0);
		}

		const item = document.querySelector(`[data-arrow-selected="true"]`);
		item?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
	};

	onMount(() => {
		actions = [
			...actions,
			...(($config?.features?.enable_notes ?? false) &&
			($user?.role === 'admin' || ($user?.permissions?.features?.notes ?? true))
				? [
						{
							label: $i18n.t('Create a new note'),
							onClick: async () => {
								await goto(`/notes?content=${query}`);
								show = false;
								onClose();
							},
							icon: PageEdit
						}
					]
				: [])
		];

		document.addEventListener('keydown', onKeyDown);
		window.addEventListener('focus', refreshHermesSessionListIfVisible);
		document.addEventListener('visibilitychange', refreshHermesSessionListIfVisible);
	});

	onDestroy(() => {
		if (searchDebounceTimeout) {
			clearTimeout(searchDebounceTimeout);
		}
		document.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('focus', refreshHermesSessionListIfVisible);
		document.removeEventListener('visibilitychange', refreshHermesSessionListIfVisible);
	});
</script>

<Modal size="xl" bind:show>
	<div class="py-3 dark:text-gray-300 text-gray-700">
		<div class="px-4 pb-1.5">
			<SearchInput
				bind:value={query}
				on:input={searchHandler}
				placeholder={$i18n.t('Search')}
				showClearButton={true}
				onFocus={() => {
					selectedIdx = null;
					messages = null;
				}}
				onKeydown={(e) => {
					console.log('e', e);

					if (e.code === 'Enter' && totalSelectableItemCount > 0) {
						const item = document.querySelector(`[data-arrow-selected="true"]`);
						if (item) {
							item?.click();
						}

						show = false;
						return;
					} else if (e.code === 'ArrowDown') {
						selectedIdx = Math.min(selectedIdx + 1, Math.max(totalSelectableItemCount - 1, 0));
					} else if (e.code === 'ArrowUp') {
						selectedIdx = Math.max(selectedIdx - 1, 0);
					} else {
						selectedIdx = 0;
					}

					const item = document.querySelector(`[data-arrow-selected="true"]`);
					item?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
				}}
			/>
		</div>

		<!-- <hr class="border-gray-50 dark:border-gray-850/30 my-1" /> -->

		<div class="flex px-4 pb-1">
			<div
				class="flex flex-col overflow-y-auto h-96 md:h-[40rem] max-h-full scrollbar-hidden w-full flex-1 pr-2"
			>
				<div class="w-full text-xs text-gray-500 dark:text-gray-500 font-medium pb-2 px-2">
					{$i18n.t('Actions')}
				</div>

				{#each actions as action, idx (action.label)}
					<button
						class=" w-full flex items-center rounded-xl text-sm py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-850 {selectedIdx ===
						idx
							? 'bg-gray-50 dark:bg-gray-850'
							: ''}"
						data-arrow-selected={selectedIdx === idx ? 'true' : undefined}
						dragabble="false"
						on:mouseenter={() => {
							selectedIdx = idx;
						}}
						on:click={async () => {
							await action.onClick();
						}}
					>
						<div class="pr-2">
							<svelte:component this={action.icon} />
						</div>
						<div class=" flex-1 text-left">
							<div class="text-ellipsis line-clamp-1 w-full">
								{$i18n.t(action.label)}
							</div>
						</div>
					</button>
				{/each}

				{#if chatList}
					<hr class="border-gray-50 dark:border-gray-850/30 my-3" />

					{#if chatList.length === 0}
						<div class="text-xs text-gray-500 dark:text-gray-400 text-center px-5 py-4">
							{$i18n.t('No results found')}
						</div>
					{/if}

					{#each chatList as chat, idx (chat.id)}
						{#if idx === 0 || (idx > 0 && chat.time_range !== chatList[idx - 1].time_range)}
							<div
								class="w-full text-xs text-gray-500 dark:text-gray-500 font-medium {idx === 0
									? ''
									: 'pt-5'} pb-2 px-2"
							>
								{$i18n.t(chat.time_range)}
								<!-- localisation keys for time_range to be recognized from the i18next parser (so they don't get automatically removed):
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
							-->
							</div>
						{/if}

						<a
							class=" w-full flex justify-between items-center rounded-xl text-sm py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-850 {selectedIdx ===
							idx + actions.length
								? 'bg-gray-50 dark:bg-gray-850'
								: ''}"
							href="/c/{chat.id}"
							draggable="false"
							data-arrow-selected={selectedIdx === idx + actions.length ? 'true' : undefined}
							on:mouseenter={() => {
								selectedIdx = idx + actions.length;
							}}
							on:click={async () => {
								await goto(buildFounderosChatHref(chat.id, $founderosLaunchContext));
								show = false;
								onClose();
							}}
						>
							<div class=" flex-1">
								<div class="text-ellipsis line-clamp-1 w-full">
									{chat?.title}
								</div>
								{#if getChatListMetaLine(chat)}
									<div class="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
										{getChatListMetaLine(chat)}
									</div>
								{/if}
							</div>

							<div class=" pl-3 shrink-0 text-gray-500 dark:text-gray-400 text-xs">
								{$i18n.t(
									dayjs(chat?.updated_at * 1000).calendar(null, {
										sameDay: '[Today]',
										nextDay: '[Tomorrow]',
										nextWeek: 'dddd',
										lastDay: '[Yesterday]',
										lastWeek: '[Last] dddd',
										sameElse: 'L' // use localized format, otherwise dayjs.calendar() defaults to DD/MM/YYYY
									})
								)}
							</div>
						</a>
					{/each}

					{#if !allChatsLoaded}
						<Loader
							on:visible={(e) => {
								if (!chatListLoading) {
									loadMoreChats();
								}
							}}
						>
							<div class="w-full flex justify-center py-4 text-xs animate-pulse items-center gap-2">
								<Spinner className=" size-4" />
								<div class=" ">{$i18n.t('Loading...')}</div>
							</div>
						</Loader>
					{/if}
				{:else}
					<div class="w-full h-full flex justify-center items-center">
						<Spinner className="size-5" />
					</div>
				{/if}

				{#if showHermesSessionsSection}
					<hr class="border-gray-50 dark:border-gray-850/30 my-3" />

					<div class="flex items-center justify-between gap-3 px-2 pb-2">
						<div class="w-full text-xs font-medium text-gray-500 dark:text-gray-500">
							{$i18n.t('Hermes sessions')}
						</div>

						{#if hermesSessionsLoading}
							<Spinner className="size-3.5 shrink-0" />
						{/if}
					</div>

					{#if !hermesSessionsLoading && groupedHermesSessions.length === 0}
						<div class="px-5 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
							{$i18n.t(
								query.trim().length > 0
									? 'No Hermes sessions match the current search or filters.'
									: 'No Hermes sessions found.'
							)}
						</div>
					{:else}
						{#if hermesSessionsLoadError}
							<div class="px-2 pb-2 text-xs text-amber-600 dark:text-amber-400">
								{hermesSessionsLoadError}
							</div>
						{/if}

						{#each groupedHermesSessions as group}
							<div
								class="w-full px-2 pb-2 pt-3 text-xs font-medium text-gray-500 dark:text-gray-500"
							>
								{$i18n.t(group.label)}
							</div>

							<div class="space-y-0.5">
								{#each group.items as session, idx (session.session_id)}
									<!-- svelte-ignore a11y-no-static-element-interactions a11y-mouse-events-have-key-events -->
									<div
										on:mouseover={() => {
											selectedIdx = hermesResultOffset + searchableHermesSessions.indexOf(session);
										}}
									>
										<HermesSessionItem
											{session}
											selected={selectedIdx ===
												hermesResultOffset + searchableHermesSessions.indexOf(session)}
											busy={hermesSessionActionId === session.session_id ||
												(Boolean(session.imported_chat_id) &&
													hermesSessionActionId === session.imported_chat_id)}
											className="px-3"
											on:open={(e) => {
												openOrImportHermesSession(e.detail);
											}}
											on:import={(e) => {
												openOrImportHermesSession(e.detail);
											}}
										/>
									</div>
								{/each}
							</div>
						{/each}
					{/if}
				{/if}
			</div>
			<div
				id="chat-preview"
				class="hidden md:flex md:flex-1 w-full overflow-y-auto h-96 md:h-[40rem] scrollbar-hidden @container"
			>
				{#if messages === null}
					<div
						class="w-full h-full flex justify-center items-center text-gray-500 dark:text-gray-400 text-sm"
					>
						{$i18n.t('Select a conversation to preview')}
					</div>
				{:else}
					<div class="w-full h-full flex flex-col">
						<Messages
							className="h-full flex pt-4 pb-8 w-full"
							chatId={`chat-preview-${selectedChat?.id ?? ''}`}
							user={$user}
							readOnly={true}
							{selectedModels}
							bind:history
							bind:messages
							autoScroll={true}
							sendMessage={() => {}}
							continueResponse={() => {}}
							regenerateResponse={() => {}}
						/>
					</div>
				{/if}
			</div>
		</div>
	</div>
</Modal>
