<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { getContext } from 'svelte';
	import { toast } from 'svelte-sonner';

	import {
		getHermesRuntime,
		getHermesWorkspaces,
		type HermesRuntime,
		type HermesWorkspacesResponse
	} from '$lib/apis/hermes';
	import {
		WEBUI_NAME,
		banners,
		chatControlsOpenTarget,
		chatId,
		config,
		mobile,
		settings,
		showArchivedChats,
		showControls,
		showSidebar,
		temporaryChatEnabled,
		user
	} from '$lib/stores';

	import { slide } from 'svelte/transition';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { founderosLaunchContext } from '$lib/founderos';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';
	import { buildFounderosRootHref } from '$lib/founderos/navigation';

	import ShareChatModal from '../chat/ShareChatModal.svelte';
	import ModelSelector from '../chat/ModelSelector.svelte';
	import Tooltip from '../common/Tooltip.svelte';
	import Menu from '$lib/components/layout/Navbar/Menu.svelte';
	import UserMenu from '$lib/components/layout/Sidebar/UserMenu.svelte';
	import AdjustmentsHorizontal from '../icons/AdjustmentsHorizontal.svelte';

	import PencilSquare from '../icons/PencilSquare.svelte';
	import Banner from '../common/Banner.svelte';
	import Sidebar from '../icons/Sidebar.svelte';

	import ChatBubbleDotted from '../icons/ChatBubbleDotted.svelte';
	import ChatBubbleDottedChecked from '../icons/ChatBubbleDottedChecked.svelte';

	import EllipsisHorizontal from '../icons/EllipsisHorizontal.svelte';
	import ChatPlus from '../icons/ChatPlus.svelte';
	import ChatCheck from '../icons/ChatCheck.svelte';
	import Knobs from '../icons/Knobs.svelte';
	import FolderOpen from '../icons/FolderOpen.svelte';
	import ClockRotateRight from '../icons/ClockRotateRight.svelte';
	import QueueList from '../icons/QueueList.svelte';
	import { WEBUI_API_BASE_URL } from '$lib/constants';
	import {
		getResolvedHermesSessionContext,
		getHermesSessionStateLabelKey,
	} from '$lib/utils/hermesSessions';

const i18n = getContext<any>('i18n');
const HERMES_ONLY_CHAT = true;

	export let initNewChat: Function;
	export let shareEnabled: boolean = false;
	export let scrollTop = 0;

	export let chat;
	export let chatHermesSession: Record<string, any> | null = null;
	export let chatMeta: Record<string, any> | null = null;
	export let history;
	export let selectedModels;
	export let showModelSelector = true;
	export let showControlsButton = true;
	void scrollTop;

	export let onSaveTempChat: () => {};
	export let archiveChatHandler: (id: string) => void;
	export let moveChatHandler: (id: string, folderId: string) => void;

	let closedBannerIds = [];

	let showShareChatModal = false;
	let showDownloadChatModal = false;
	let hermesRuntime: HermesRuntime | null = null;
	let hermesWorkspaces: HermesWorkspacesResponse | null = null;
	let hermesContextLoaded = false;
	let hermesContextLoading = false;
	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	const openControlsTo = async (target: 'workspace' | 'session' | 'tasks') => {
		chatControlsOpenTarget.set(target);
		await showControls.set(true);
	};

	const formatWorkspaceNameFromPath = (path: string | null | undefined) => {
		if (!path) {
			return '';
		}

		const normalized = path.replace(/\/+$/, '');
		if (!normalized) {
			return path;
		}

		return normalized.split('/').pop() ?? normalized;
	};

	const loadHermesContext = async (force = false) => {
		if (hermesContextLoading || (hermesContextLoaded && !force)) {
			return;
		}

		if (typeof localStorage === 'undefined') {
			return;
		}

		const token = getWorkspaceAuthToken();
		if (!token) {
			hermesContextLoaded = true;
			return;
		}

		hermesContextLoading = true;

		try {
			const [runtimeRes, workspacesRes] = await Promise.all([
				getHermesRuntime(token).catch((error) => {
					console.error(error);
					return null;
				}),
				getHermesWorkspaces(token).catch((error) => {
					console.error(error);
					return null;
				})
			]);

			hermesRuntime = runtimeRes;
			hermesWorkspaces = workspacesRes;
		} finally {
			hermesContextLoaded = true;
			hermesContextLoading = false;
		}
	};

	$: currentHermesMeta = getResolvedHermesSessionContext({
		session: chatHermesSession,
		meta: chatMeta,
		runtime: hermesRuntime
	});
	$: shouldShowHermesQuickActions = !$mobile;
	$: shouldShowTasksQuickAction = !!(chat?.id || history?.currentId);
	$: shouldShowHermesContextStrip = !$mobile && (chat?.id || history?.currentId);
	$: activeWorkspaceItem = hermesWorkspaces?.items?.find((item) => item.is_active) ?? null;
	$: activeWorkspaceLabel =
		activeWorkspaceItem?.name ??
		formatWorkspaceNameFromPath(
			hermesWorkspaces?.last_workspace ?? hermesWorkspaces?.items?.at(0)?.path ?? null
		);
	$: activeProfileLabel = currentHermesMeta?.profile ?? '';
	$: sessionStateLabelKey = getHermesSessionStateLabelKey({
		temporaryChatEnabled: $temporaryChatEnabled,
		currentHermesSessionId: currentHermesMeta?.session_id,
		currentMessageId: history?.currentId
	});
	$: sessionStateLabel = sessionStateLabelKey ? $i18n.t(sessionStateLabelKey) : '';
	$: hermesContextChips = [
		activeWorkspaceLabel ? `${$i18n.t('Workspace')}: ${activeWorkspaceLabel}` : '',
		activeProfileLabel ? `${$i18n.t('Hermes profile')}: ${activeProfileLabel}` : '',
		sessionStateLabel ? `${$i18n.t('Session')}: ${sessionStateLabel}` : ''
	].filter(Boolean);
	$: if (shouldShowHermesContextStrip && !hermesContextLoaded && !hermesContextLoading) {
		loadHermesContext();
	}
</script>

<ShareChatModal bind:show={showShareChatModal} chatId={$chatId} />

<button
	id="new-chat-button"
	class="hidden"
	on:click={() => {
		initNewChat();
	}}
	aria-label="New Chat"
></button>

<nav
	class="sticky top-0 z-30 w-full {chat?.id
		? 'pt-0.5 pb-1'
		: 'pt-1 pb-1'} -mb-12 flex flex-col items-center drag-region"
>
	<div class="flex items-center w-full pl-1.5 pr-1">
		<div
			id="navbar-bg-gradient-to-b"
			class="{chat?.id
				? 'visible'
				: 'invisible'} bg-linear-to-b via-40% to-97% from-white/90 via-white/50 to-transparent dark:from-gray-900/90 dark:via-gray-900/50 dark:to-transparent pointer-events-none absolute inset-0 -bottom-10 z-[-1]"
		></div>

		<div class=" flex max-w-full w-full mx-auto px-1.5 md:px-2 pt-0.5 bg-transparent">
			<div class="flex items-center w-full max-w-full">
				{#if $mobile && !$showSidebar}
					<div
						class="-translate-x-0.5 mr-1 mt-1 self-start flex flex-none items-center text-gray-600 dark:text-gray-400"
					>
						<Tooltip content={$showSidebar ? $i18n.t('Close Sidebar') : $i18n.t('Open Sidebar')}>
							<button
								class=" cursor-pointer flex rounded-lg hover:bg-gray-100 dark:hover:bg-gray-850 transition"
								on:click={() => {
									showSidebar.set(!$showSidebar);
								}}
							>
								<div class=" self-center p-1.5">
									<Sidebar />
								</div>
							</button>
						</Tooltip>
					</div>
				{/if}

				<div
					class="flex-1 overflow-hidden max-w-full mt-0.5 py-0.5
			{$showSidebar ? 'ml-1' : ''}
			"
				>
					{#if showModelSelector}
						<ModelSelector bind:selectedModels showSetDefault={!shareEnabled} />
					{/if}

					{#if shouldShowHermesContextStrip && hermesContextChips.length > 0}
						<div class="mt-1 flex max-w-full items-center gap-1 overflow-x-auto scrollbar-hidden">
							{#each hermesContextChips as chip}
								<div
									class="shrink-0 rounded-full bg-gray-50/80 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-gray-850/70 dark:text-gray-400"
								>
									<span class="block max-w-full truncate">{chip}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div class="self-start flex flex-none items-center text-gray-600 dark:text-gray-400">
					<!-- <div class="md:hidden flex self-center w-[1px] h-5 mx-2 bg-gray-300 dark:bg-stone-700" /> -->

					{#if !HERMES_ONLY_CHAT && ($user?.role === 'user'
						? ($user?.permissions?.chat?.temporary ?? true) &&
							!($user?.permissions?.chat?.temporary_enforced ?? false)
						: true)}
						{#if !chat?.id}
							<Tooltip content={$i18n.t(`Temporary Chat`)}>
								<button
									class="flex cursor-pointer px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 transition"
									id="temporary-chat-button"
									on:click={async () => {
										if (($settings?.temporaryChatByDefault ?? false) && $temporaryChatEnabled) {
											// for proper initNewChat handling
											await temporaryChatEnabled.set(null);
										} else {
											await temporaryChatEnabled.set(!$temporaryChatEnabled);
										}

										if ($page.url.pathname !== '/') {
											await goto(buildFounderosRootHref($founderosLaunchContext));
										}

										// add 'temporary-chat=true' to the URL
										if ($temporaryChatEnabled) {
											window.history.replaceState(null, '', '?temporary-chat=true');
										} else {
											window.history.replaceState(null, '', location.pathname);
										}
									}}
								>
									<div class=" m-auto self-center">
										{#if $temporaryChatEnabled}
											<ChatBubbleDottedChecked className=" size-4.5" strokeWidth="1.5" />
										{:else}
											<ChatBubbleDotted className=" size-4.5" strokeWidth="1.5" />
										{/if}
									</div>
								</button>
							</Tooltip>
						{:else if $temporaryChatEnabled}
							<Tooltip content={$i18n.t(`Save Chat`)}>
								<button
									class="flex cursor-pointer px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 transition"
									id="save-temporary-chat-button"
									on:click={async () => {
										onSaveTempChat();
									}}
								>
									<div class=" m-auto self-center">
										<ChatCheck className=" size-4.5" strokeWidth="1.5" />
									</div>
								</button>
							</Tooltip>
						{/if}
					{/if}

					{#if $mobile && !$temporaryChatEnabled && chat && chat.id}
						<Tooltip content={$i18n.t('New Chat')}>
							<button
								class=" flex {$showSidebar
									? 'md:hidden'
									: ''} cursor-pointer px-2 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850 transition"
								on:click={() => {
									initNewChat();
								}}
								aria-label="New Chat"
							>
								<div class=" m-auto self-center">
									<ChatPlus className=" size-4.5" strokeWidth="1.5" />
								</div>
							</button>
						</Tooltip>
					{/if}

					{#if shareEnabled && chat && (chat.id || $temporaryChatEnabled)}
						<Menu
							{chat}
							{shareEnabled}
							shareHandler={() => {
								showShareChatModal = !showShareChatModal;
							}}
							archiveChatHandler={() => {
								archiveChatHandler(chat.id);
							}}
							{moveChatHandler}
						>
							<button
								class="flex cursor-pointer px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 transition"
								id="chat-context-menu-button"
							>
								<div class=" m-auto self-center">
									<EllipsisHorizontal className=" size-5" strokeWidth="1.5" />
								</div>
							</button>
						</Menu>
					{/if}

					{#if shouldShowHermesQuickActions}
						<div
							class="flex items-center gap-0.5 mx-1 rounded-xl bg-gray-50/70 px-1 py-0.5 dark:bg-gray-850/70"
						>
							<Tooltip content={$i18n.t('Workspace')}>
								<button
									class="flex cursor-pointer px-1.5 py-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition"
									on:click={() => openControlsTo('workspace')}
									aria-label={$i18n.t('Workspace')}
								>
									<div class="m-auto self-center">
										<FolderOpen className="size-4" />
									</div>
								</button>
							</Tooltip>

							<Tooltip content={$i18n.t('Session')}>
								<button
									class="flex cursor-pointer px-1.5 py-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition"
									on:click={() => openControlsTo('session')}
									aria-label={$i18n.t('Session')}
								>
									<div class="m-auto self-center">
										<ClockRotateRight className="size-4" />
									</div>
								</button>
							</Tooltip>

							{#if shouldShowTasksQuickAction}
								<Tooltip content={$i18n.t('Tasks')}>
									<button
										class="flex cursor-pointer px-1.5 py-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition"
										on:click={() => openControlsTo('tasks')}
										aria-label={$i18n.t('Tasks')}
									>
										<div class="m-auto self-center">
											<QueueList className="size-4" />
										</div>
									</button>
								</Tooltip>
							{/if}
						</div>
					{/if}

					{#if showControlsButton && ($user?.role === 'admin' || ($user?.permissions.chat?.controls ?? true))}
						<Tooltip content={$i18n.t('Controls')}>
							<button
								class=" flex cursor-pointer px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-850 transition"
								on:click={async () => {
									await showControls.set(!$showControls);
								}}
								aria-label="Controls"
							>
								<div class=" m-auto self-center">
									<Knobs className=" size-5" strokeWidth="1" />
								</div>
							</button>
						</Tooltip>
					{/if}

					{#if $user !== undefined && $user !== null}
						<UserMenu
							className="w-[240px]"
							role={$user?.role}
							help={true}
							on:show={(e) => {
								if (e.detail === 'archived-chat') {
									showArchivedChats.set(true);
								}
							}}
						>
							<div
								class="select-none flex rounded-xl p-1.5 w-full hover:bg-gray-50 dark:hover:bg-gray-850 transition"
							>
								<div class=" self-center">
									<span class="sr-only">{$i18n.t('User menu')}</span>
									<img
										src={`${WEBUI_API_BASE_URL}/users/${$user?.id}/profile/image`}
										class="size-6 object-cover rounded-full"
										alt=""
										draggable="false"
									/>
								</div>
							</div>
						</UserMenu>
					{/if}
				</div>
			</div>
		</div>
	</div>

	{#if !HERMES_ONLY_CHAT && $temporaryChatEnabled && ($chatId ?? '').startsWith('local:')}
		<div class=" w-full z-30 text-center">
			<div class="text-xs text-gray-500">{$i18n.t('Temporary Chat')}</div>
		</div>
	{/if}

	<div class="absolute top-[100%] left-0 right-0 h-fit">
		{#if !history.currentId && !$chatId && ($banners.length > 0 || ($config?.license_metadata?.type ?? null) === 'trial' || (($config?.license_metadata?.seats ?? null) !== null && $config?.user_count > $config?.license_metadata?.seats))}
			<div class=" w-full z-30">
				<div class=" flex flex-col gap-1 w-full">
					{#if ($config?.license_metadata?.type ?? null) === 'trial'}
						<Banner
							banner={{
								type: 'info',
								title: 'Trial License',
								content: $i18n.t(
									'You are currently using a trial license. Please contact support to upgrade your license.'
								)
							}}
						/>
					{/if}

					{#if ($config?.license_metadata?.seats ?? null) !== null && $config?.user_count > $config?.license_metadata?.seats}
						<Banner
							banner={{
								type: 'error',
								title: 'License Error',
								content: $i18n.t(
									'Exceeded the number of seats in your license. Please contact support to increase the number of seats.'
								)
							}}
						/>
					{/if}

					{#each $banners.filter((b) => ![...JSON.parse(localStorage.getItem('dismissedBannerIds') ?? '[]'), ...closedBannerIds].includes(b.id)) as banner (banner.id)}
						<Banner
							{banner}
							on:dismiss={(e) => {
								const bannerId = e.detail;

								if (banner.dismissible) {
									localStorage.setItem(
										'dismissedBannerIds',
										JSON.stringify(
											[
												bannerId,
												...JSON.parse(localStorage.getItem('dismissedBannerIds') ?? '[]')
											].filter((id) => $banners.find((b) => b.id === id))
										)
									);
								} else {
									closedBannerIds = [...closedBannerIds, bannerId];
								}
							}}
						/>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</nav>
