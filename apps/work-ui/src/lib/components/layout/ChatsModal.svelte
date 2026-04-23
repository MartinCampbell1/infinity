<script lang="ts">
	// @ts-nocheck
	// @ts-ignore
	import fileSaver from 'file-saver';
	import type { Writable } from 'svelte/store';
	const { saveAs } = fileSaver;

	import { toast } from 'svelte-sonner';
	import { getContext } from 'svelte';
	import {
		archiveChatById,
		getAllArchivedChats,
		getArchivedChatList,
		unarchiveAllChats
	} from '$lib/apis/chats';

	import Modal from '$lib/components/common/Modal.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import { hermesRecentSessions, hermesSessionsByChatId } from '$lib/stores';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';

	import Spinner from '../common/Spinner.svelte';
	import Loader from '../common/Loader.svelte';
	import XMark from '../icons/XMark.svelte';
	import ChevronUp from '../icons/ChevronUp.svelte';
	import ChevronDown from '../icons/ChevronDown.svelte';
	import Link from '../icons/Link.svelte';
	import LinkSlash from '../icons/LinkSlash.svelte';
	import Clipboard from '../icons/Clipboard.svelte';
	import {
		buildHermesAwareChatList,
		buildHermesSessionMapByImportedChatId,
		formatHermesChatListMetaLine,
		getResolvedHermesSessionContext
	} from '$lib/utils/hermesSessions';

	const i18n: Writable<any> = getContext('i18n');

	type ChatListItem = {
		id: string;
		title?: string | null;
		updated_at?: number | null;
		effective_updated_at?: number | null;
		meta?: Record<string, unknown> | null;
		[key: string]: unknown;
	};

	export let show = false;

	export let title = 'Chats';
	export let emptyPlaceholder = '';
	export let shareUrl = false;
	export let showUserInfo = false;
	export let showSearch = true;
	export let readOnly = false;

	export let query = '';

	export let orderBy = 'updated_at';
	export let direction = 'desc'; // 'asc' or 'desc'

	export let chatList: ChatListItem[] | null = null;
	export let allChatsLoaded = false;
	export let chatListLoading = false;

	let selectedChatId: string | null = null;
	let selectedIdx = 0;
	let showDeleteConfirmDialog = false;
	let orderedChatList: ChatListItem[] | null = null;
	let hermesRefreshLoading = false;
	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	export let onUpdate = () => {};
	export let onDelete: (id: string) => void = () => {};

	export let loadHandler: null | (() => void | Promise<void>) = null;
	export let unarchiveHandler: null | ((id: string) => void | Promise<void>) = null;
	export let unshareHandler: null | ((id: string) => void | Promise<void>) = null;

	void shareUrl;
	void readOnly;
	void allChatsLoaded;
	void chatListLoading;
	void loadHandler;
	void unarchiveHandler;
	void unshareHandler;

	const getChatListMetaLine = (chat: ChatListItem) => {
		return formatHermesChatListMetaLine({
			hermesMeta: getResolvedHermesSessionContext({
				session: $hermesSessionsByChatId[chat?.id] ?? null,
				meta: chat?.meta ?? null,
				chatPayload: chat?.chat ?? null
			}),
			session: $hermesSessionsByChatId[chat?.id] ?? null,
			summary: chat?.session_summary,
			translate: $i18n.t
		});
	};

	const setSortKey = (key) => {
		if (orderBy === key) {
			direction = direction === 'asc' ? 'desc' : 'asc';
		} else {
			orderBy = key;
			direction = 'asc';
		}
	};

	const deleteHandler = async (chatId) => {
		const res = await deleteChatById(getWorkspaceAuthToken(), chatId).catch((error) => {
			toast.error(`${error}`);
		});

		if (res) {
			onDelete(chatId);
		}
		onUpdate();
	};

	const refreshHermesSessions = async () => {
		const token = getWorkspaceAuthToken();
		if (!show || hermesRefreshLoading || !token) {
			return;
		}

		hermesRefreshLoading = true;

		try {
			const sessionsPayload = await getHermesSessions(token);
			const sessions = sessionsPayload?.items ?? [];
			hermesRecentSessions.set(sessions);
			hermesSessionsByChatId.set(buildHermesSessionMapByImportedChatId(sessions));
		} catch (error) {
			console.debug('Failed to refresh Hermes sessions for chats modal:', error);
		} finally {
			hermesRefreshLoading = false;
		}
	};

	$: orderedChatList =
		chatList === null
			? null
			: buildHermesAwareChatList(chatList, $hermesSessionsByChatId, {
					orderBy,
					direction
				});
	$: if (show) {
		refreshHermesSessions();
	}
</script>

<ConfirmDialog
	bind:show={showDeleteConfirmDialog}
	on:confirm={() => {
		if (selectedChatId) {
			deleteHandler(selectedChatId);
			selectedChatId = null;
		}
	}}
/>

<Modal size="lg" bind:show>
	<div>
		<div class=" flex justify-between dark:text-gray-300 px-5 pt-4 pb-1">
			<div class=" text-lg font-medium self-center">{title}</div>
			<button
				class="self-center"
				type="button"
				aria-label={$i18n.t('Close chats dialog')}
				on:click={() => {
					show = false;
				}}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					class="w-5 h-5"
				>
					<path
						fill-rule="evenodd"
						d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		</div>

		<div class="flex flex-col w-full px-5 pb-4 dark:text-gray-200">
			{#if showSearch}
				<div class=" flex w-full space-x-2 mt-0.5 mb-1.5">
					<div class="flex flex-1">
						<div class=" self-center ml-1 mr-3">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								class="w-4 h-4"
							>
								<path
									fill-rule="evenodd"
									d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
						<input
							class=" w-full text-sm pr-4 py-1 rounded-r-xl outline-hidden bg-transparent"
							bind:value={query}
							placeholder={$i18n.t('Search Chats')}
							maxlength="500"
						/>

						{#if query}
							<div class="self-center pl-1.5 pr-1 translate-y-[0.5px] rounded-l-xl bg-transparent">
								<button
									class="p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition"
									on:click={() => {
										query = '';
										selectedIdx = 0;
									}}
								>
									<XMark className="size-3" strokeWidth="2" />
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<div class=" flex flex-col w-full sm:flex-row sm:justify-center sm:space-x-6">
				{#if orderedChatList}
					<div class="w-full">
						{#if orderedChatList.length > 0}
							<div class="flex text-xs font-medium mb-1.5">
								{#if showUserInfo}
									<div class="px-1.5 py-1 w-32">
										{$i18n.t('User')}
									</div>
								{/if}
								<button
									class="px-1.5 py-1 cursor-pointer select-none {showUserInfo
										? 'flex-1'
										: 'basis-3/5'}"
									on:click={() => setSortKey('title')}
								>
									<div class="flex gap-1.5 items-center">
										{$i18n.t('Title')}

										{#if orderBy === 'title'}
											<span class="font-normal"
												>{#if direction === 'asc'}
													<ChevronUp className="size-2" />
												{:else}
													<ChevronDown className="size-2" />
												{/if}
											</span>
										{:else}
											<span class="invisible">
												<ChevronUp className="size-2" />
											</span>
										{/if}
									</div>
								</button>
								<button
									class="px-1.5 py-1 cursor-pointer select-none hidden sm:flex {showUserInfo
										? 'w-28'
										: 'sm:basis-2/5'} justify-end"
									on:click={() => setSortKey('updated_at')}
								>
									<div class="flex gap-1.5 items-center">
										{$i18n.t('Updated at')}

										{#if orderBy === 'updated_at'}
											<span class="font-normal"
												>{#if direction === 'asc'}
													<ChevronUp className="size-2" />
												{:else}
													<ChevronDown className="size-2" />
												{/if}
											</span>
										{:else}
											<span class="invisible">
												<ChevronUp className="size-2" />
											</span>
										{/if}
									</div>
								</button>
							</div>
						{:else}
							<div class="font-medium text-gray-600 dark:text-gray-400 text-sm py-1">
								{emptyPlaceholder}
							</div>
						{/if}
					</div>
				{:else}
					<div class="flex justify-center w-full pt-8 pb-8">
						<Loader className="size-6" />
					</div>
				{/if}
			</div>
		</div>
	</div>
</Modal>
