<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { v4 as uuidv4 } from 'uuid';

	import { goto } from '$app/navigation';
	import { founderosLaunchContext } from '$lib/founderos';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';
	import { buildFounderosChatHref, buildFounderosRootHref } from '$lib/founderos/navigation';
	import {
		user,
		chats,
		settings,
		showSettings,
		chatId,
		tags,
		folders as _folders,
		showSidebar,
		showSearch,
		mobile,
		showArchivedChats,
		pinnedChats,
		scrollPaginationEnabled,
		currentChatPage,
		temporaryChatEnabled,
		channels,
		socket,
		config,
		isApp,
		models,
		selectedFolder,
		WEBUI_NAME,
		sidebarWidth,
		activeChatIds,
		chatControlsOpenTarget,
		hermesRecentSessions,
		hermesSessionsByChatId,
		showControls
	} from '$lib/stores';
	import { onMount, getContext, tick, onDestroy } from 'svelte';
	import type { I18nStore } from '$lib/i18n';

	const i18n = getContext<I18nStore>('i18n');

	import {
		getChatList,
		getAllTags,
		getPinnedChatList,
		toggleChatPinnedStatusById,
		getChatById,
		updateChatFolderIdById,
		importChats
	} from '$lib/apis/chats';
	import { getHermesSessions } from '$lib/apis/hermes';
	import { createNewFolder, getFolders, updateFolderParentIdById } from '$lib/apis/folders';
	import { checkActiveChats } from '$lib/apis/tasks';
	import { WEBUI_API_BASE_URL, WEBUI_BASE_URL } from '$lib/constants';

	import ArchivedChatsModal from './ArchivedChatsModal.svelte';
	import UserMenu from './Sidebar/UserMenu.svelte';
	import ChatItem from './Sidebar/ChatItem.svelte';
	import Spinner from '../common/Spinner.svelte';
	import Loader from '../common/Loader.svelte';
	import Folder from '../common/Folder.svelte';
	import Tooltip from '../common/Tooltip.svelte';
	import Folders from './Sidebar/Folders.svelte';
	import { getChannels, createNewChannel } from '$lib/apis/channels';
	import ChannelModal from './Sidebar/ChannelModal.svelte';
	import ChannelItem from './Sidebar/ChannelItem.svelte';
	import HermesSessionItem from './Sidebar/HermesSessionItem.svelte';
	import PencilSquare from '../icons/PencilSquare.svelte';
	import Search from '../icons/Search.svelte';
	import SearchModal from './SearchModal.svelte';
	import FolderModal from './Sidebar/Folders/FolderModal.svelte';
	import Sidebar from '../icons/Sidebar.svelte';
	import PinnedModelList from './Sidebar/PinnedModelList.svelte';
	import Note from '../icons/Note.svelte';
	import { slide } from 'svelte/transition';
	import HotkeyHint from '../common/HotkeyHint.svelte';
	import {
		buildHermesAwareChatList,
		buildHermesImportedSessionsRefreshSignature,
		buildHermesSessionMapByImportedChatId,
		getRecentVisibleHermesSessions,
		shouldRefreshLoadedChatsForHermesSessions
	} from '$lib/utils/hermesSessions';
	import type {
		HermesAwareChatListItem,
		HermesSessionListItem
	} from '$lib/utils/hermesSessions';
	import { importHermesSession } from '$lib/apis/hermes';
	type ChannelForm = Parameters<typeof createNewChannel>[1];

	type SidebarFolder = {
		id: string;
		name?: string;
		parent_id?: string | null;
		created_at?: number;
		updated_at?: number;
		childrenIds?: string[];
		new?: boolean;
		[key: string]: unknown;
	};

	type SidebarFolderRegistryEntry = {
		setFolderItems?: () => void;
	};

	type SidebarChatImportItem = {
		chat?: unknown;
		meta?: Record<string, unknown>;
		created_at?: number | null;
		updated_at?: number | null;
	};

	type SidebarDropDetail = {
		type: 'chat' | 'folder';
		id: string;
		item?: SidebarChatImportItem;
	};

	type SidebarTouchPoint = Pick<Touch, 'clientX' | 'screenX'>;
	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	const BREAKPOINT = 768;
	const SIDEBAR_CHAT_PAGE_SIZE = 60;
	const HERMES_SIDEBAR_RECENT_LIMIT = 10;
	const HERMES_IMPORTED_SESSION_REFRESH_LIMIT = SIDEBAR_CHAT_PAGE_SIZE;
	const HERMES_SIDEBAR_REFRESH_INTERVAL_MS = 45_000;
	const HERMES_ONLY_SIDEBAR = true;
	const HERMES_SHOW_SEARCH = false;
	const HERMES_SHELL_LABEL = 'Hermes';

	let scrollTop = 0;

	let navElement: HTMLElement | null = null;
	let shiftKey = false;

	let selectedChatId: string | null = null;
	let showCreateChannel = false;

	// Pagination variables
	let chatListLoading = false;
	let allChatsLoaded = false;

	let showCreateFolderModal = false;
	let hermesSessionActionId: string | null = null;
	let hermesSidebarSessionsLoading = false;
	let hermesSidebarSessionsRefreshQueued = false;
	let hermesSidebarChatRefreshLoading = false;
	let hermesObservedImportedSessionSignature = '';
	let hermesPendingImportedSessionRefreshSignature = '';
	let hermesAppliedImportedSessionRefreshSignature = '';
	let recentHermesSessions: HermesSessionListItem[] = [];
	let orderedPinnedChats: HermesAwareChatListItem[] = [];
	let orderedChats: HermesAwareChatListItem[] = [];

	let pinnedModels: string[] = [];

	let showPinnedModels = false;
	let showChannels = false;
	let showFolders = false;

	let folders: Record<string, SidebarFolder> = {};
	let folderRegistry: Record<string, SidebarFolderRegistryEntry> = {};

	let newFolderId: string | null = null;

	$: if ($selectedFolder) {
		initFolders();
	}

	const initFolders = async () => {
		if ($config?.features?.enable_folders === false) {
			return;
		}

		const folderList = ((await getFolders(getWorkspaceAuthToken()).catch((error) => {
			return [];
		})) ?? []) as SidebarFolder[];
		_folders.set(
			[...folderList].sort(
				(a: SidebarFolder, b: SidebarFolder) => (b.updated_at ?? 0) - (a.updated_at ?? 0)
			)
		);

		folders = {};

		// First pass: Initialize all folder entries
		for (const folder of folderList) {
			// Ensure folder is added to folders with its data
			folders[folder.id] = { ...(folders[folder.id] || {}), ...folder };

			if (newFolderId && folder.id === newFolderId) {
				folders[folder.id].new = true;
				newFolderId = null;
			}
		}

		// Second pass: Tie child folders to their parents
		for (const folder of folderList) {
			if (folder.parent_id) {
				// Ensure the parent folder is initialized if it doesn't exist
				if (!folders[folder.parent_id]) {
					folders[folder.parent_id] = {
						id: folder.parent_id,
						parent_id: null,
						childrenIds: [],
						updated_at: 0
					};
				}

				const parentFolder = folders[folder.parent_id];

				// Initialize childrenIds array if it doesn't exist and add the current folder id
				parentFolder.childrenIds = [...(parentFolder.childrenIds ?? []), folder.id];

				// Sort the children by updated_at field
				parentFolder.childrenIds.sort((a, b) => {
					return (folders[b]?.updated_at ?? 0) - (folders[a]?.updated_at ?? 0);
				});
			}
		}
	};

	const setHermesSidebarSessions = (sessions: HermesSessionListItem[]) => {
		recentHermesSessions = getRecentVisibleHermesSessions(sessions, {
			limit: HERMES_SIDEBAR_RECENT_LIMIT,
			includeImported: false
		});
		hermesRecentSessions.set(sessions);
		hermesSessionsByChatId.set(buildHermesSessionMapByImportedChatId(sessions));
	};

	const loadHermesSidebarSessions = async () => {
		const token = getWorkspaceAuthToken();
		if (!token) {
			return;
		}

		if (hermesSidebarSessionsLoading) {
			hermesSidebarSessionsRefreshQueued = true;
			return;
		}

		hermesSidebarSessionsLoading = true;

		try {
			const sessionsPayload = await getHermesSessions(token);
			const sessions = sessionsPayload?.items ?? [];
			setHermesSidebarSessions(sessions);
		} catch (error) {
			console.debug('Failed to refresh Hermes sidebar sessions:', error);
		} finally {
			hermesSidebarSessionsLoading = false;

			if (hermesSidebarSessionsRefreshQueued) {
				hermesSidebarSessionsRefreshQueued = false;
				loadHermesSidebarSessions();
			}
		}
	};

	const refreshSidebarChatListsFromHermesSessions = async () => {
		if (
			hermesSidebarChatRefreshLoading ||
			!hermesPendingImportedSessionRefreshSignature ||
			!localStorage?.token
		) {
			return;
		}

		hermesSidebarChatRefreshLoading = true;
		const refreshSignature = hermesPendingImportedSessionRefreshSignature;
		hermesPendingImportedSessionRefreshSignature = '';

		try {
			const [nextPinnedChats, nextChatsPageOne] = await Promise.all([
				getPinnedChatList(getWorkspaceAuthToken()),
				getChatList(getWorkspaceAuthToken(), 1)
			]);
			const nextPageOneIds = new Set(
				((nextChatsPageOne ?? []) as HermesAwareChatListItem[]).map((chat) => chat.id)
			);

			pinnedChats.set(nextPinnedChats ?? []);
			chats.update((currentChats) => {
				const preservedChats = (currentChats ?? []).filter(
					(chat, index) => index >= SIDEBAR_CHAT_PAGE_SIZE && !nextPageOneIds.has(chat.id)
				);

				return [...(nextChatsPageOne ?? []), ...preservedChats];
			});

			hermesAppliedImportedSessionRefreshSignature = refreshSignature;
		} catch (error) {
			console.debug('Failed to refresh sidebar chats from Hermes sessions:', error);
		} finally {
			hermesSidebarChatRefreshLoading = false;

			if (
				hermesPendingImportedSessionRefreshSignature &&
				hermesPendingImportedSessionRefreshSignature !==
					hermesAppliedImportedSessionRefreshSignature
			) {
				refreshSidebarChatListsFromHermesSessions();
			}
		}
	};

	const createFolder = async ({
		name,
		data,
		parent_id
	}: {
		name?: string;
		data?: Record<string, unknown>;
		parent_id?: string | null;
	}) => {
		const trimmedName = name?.trim();
		if (!trimmedName) {
			toast.error($i18n.t('Folder name cannot be empty.'));
			return;
		}
		let normalizedName = trimmedName;
		const duplicateBaseName = normalizedName;

		// Check for duplicate names in the same parent
		const siblings = Object.values(folders).filter((folder) => folder.parent_id === parent_id);
		if (
			siblings.find(
				(folder) => (folder.name ?? '').toLowerCase() === duplicateBaseName.toLowerCase()
			)
		) {
			// If a folder with the same name already exists, append a number to the name
			let i = 1;
			while (
				siblings.find(
					(folder) =>
						(folder.name ?? '').toLowerCase() === `${duplicateBaseName} ${i}`.toLowerCase()
				)
			) {
				i++;
			}

			normalizedName = `${duplicateBaseName} ${i}`;
		}

		// Add a dummy folder to the list to show the user that the folder is being created
		const tempId = uuidv4();
		folders = {
			...folders,
			[tempId]: {
				id: tempId,
				name: normalizedName,
				parent_id: parent_id,
				created_at: Date.now(),
				updated_at: Date.now()
			}
		};

		const res = await createNewFolder(getWorkspaceAuthToken(), {
			name: normalizedName,
			data,
			parent_id
		}).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			// newFolderId = res.id;
			await initFolders();
			showFolders = true;
		}
	};

	const initChannels = async () => {
		// default (none), group, dm type
		const channelTypeOrder: Array<string | null> = ['', null, 'group', 'dm'];
		const res = await getChannels(getWorkspaceAuthToken()).catch((error) => {
			return null;
		});

		if (res) {
			const normalizedChannels = (
				[...res] as Array<{ id?: string | number | null; type?: string | null }>
			)
				.filter((channel): channel is { id: string | number; type?: string | null } => {
					return channel.id !== undefined && channel.id !== null;
				})
				.map((channel) => ({
					...channel,
					id: String(channel.id),
					type: channel.type ?? null
				}))
				.sort(
					(a, b) =>
						channelTypeOrder.indexOf(a.type ?? null) - channelTypeOrder.indexOf(b.type ?? null)
				);

			await channels.set(normalizedChannels);
		}
	};

	const initChatList = async () => {
		// Reset pagination variables
		console.log('initChatList');
		currentChatPage.set(1);
		allChatsLoaded = false;
		scrollPaginationEnabled.set(false);

		initFolders();
		await Promise.all([
			await (async () => {
				console.log('Init tags');
				const _tags = await getAllTags(getWorkspaceAuthToken());
				tags.set(_tags);
			})(),
			await (async () => {
				console.log('Init pinned chats');
				const _pinnedChats = await getPinnedChatList(getWorkspaceAuthToken());
				pinnedChats.set(_pinnedChats);
			})(),
			await (async () => {
				console.log('Init chat list');
				const _chats = await getChatList(getWorkspaceAuthToken(), $currentChatPage);
				await chats.set(_chats);
			})()
		]);

		await loadHermesSidebarSessions();

		// Enable pagination
		scrollPaginationEnabled.set(true);
	};

	const openHermesSessionPanel = async () => {
		chatControlsOpenTarget.set('session');
		await showControls.set(true);
	};

	const openImportedHermesSession = async (session: HermesSessionListItem) => {
		if (!session?.imported_chat_id || hermesSessionActionId) {
			return;
		}

		hermesSessionActionId = session.imported_chat_id;

		try {
			await initChatList();
			await goto(buildFounderosChatHref(session.imported_chat_id, $founderosLaunchContext));
		} catch (error) {
			toast.error(`${error}`);
		} finally {
			hermesSessionActionId = null;
		}
	};

	const importHermesSidebarSession = async (session: HermesSessionListItem) => {
		if (!session?.session_id || hermesSessionActionId) {
			return;
		}

		hermesSessionActionId = session.session_id;

		try {
			const res = await importHermesSession(getWorkspaceAuthToken(), session.session_id).catch(
				(error) => {
					toast.error(`${error}`);
					return null;
				}
			);

			if (res?.chat?.id) {
				await initChatList();
				await loadHermesSidebarSessions();
				await goto(buildFounderosChatHref(res.chat.id, $founderosLaunchContext));
				toast.success(
					res.already_imported
						? $i18n.t('Opened existing Hermes session.')
						: $i18n.t('Hermes session imported.')
				);
			}
		} catch (error) {
			toast.error(`${error}`);
		} finally {
			hermesSessionActionId = null;
		}
	};

	const loadMoreChats = async () => {
		chatListLoading = true;

		currentChatPage.set($currentChatPage + 1);

		let newChatList: HermesAwareChatListItem[] = [];

		newChatList = await getChatList(getWorkspaceAuthToken(), $currentChatPage);

		// once the bottom of the list has been reached (no results) there is no need to continue querying
		allChatsLoaded = newChatList.length === 0;
		const existingIds = new Set((($chats ?? []) as HermesAwareChatListItem[]).map((c) => c.id));
		const uniqueNewChats = newChatList.filter((c: HermesAwareChatListItem) => !existingIds.has(c.id));
		await chats.set([...($chats ? $chats : []), ...uniqueNewChats]);

		chatListLoading = false;
	};

	$: {
		recentHermesSessions = getRecentVisibleHermesSessions($hermesRecentSessions, {
			limit: HERMES_SIDEBAR_RECENT_LIMIT,
			includeImported: false
		});
	}

	$: orderedPinnedChats = buildHermesAwareChatList($pinnedChats ?? [], $hermesSessionsByChatId);
	$: orderedChats = buildHermesAwareChatList($chats ?? [], $hermesSessionsByChatId);
	$: showSidebarNotes =
		!HERMES_ONLY_SIDEBAR &&
		($config?.features?.enable_notes ?? false) &&
		($user?.role === 'admin' || ($user?.permissions?.features?.notes ?? true));
	$: showSidebarWorkspace =
		!HERMES_ONLY_SIDEBAR &&
		($user?.role === 'admin' ||
			$user?.permissions?.workspace?.models ||
			$user?.permissions?.workspace?.knowledge ||
			$user?.permissions?.workspace?.prompts ||
			$user?.permissions?.workspace?.tools);
	$: showSidebarModels =
		!HERMES_ONLY_SIDEBAR &&
		($models ?? []).length > 0 &&
		(($settings?.pinnedModels ?? []).length > 0 ||
			($config?.default_pinned_models ?? []).length > 0);
	$: showSidebarChannels =
		!HERMES_ONLY_SIDEBAR &&
		$config?.features?.enable_channels &&
		($user?.role === 'admin' || ($user?.permissions?.features?.channels ?? true));
	$: {
		const importedSessionSignature = buildHermesImportedSessionsRefreshSignature(
			$hermesRecentSessions,
			{
				importedSessionLimit: HERMES_IMPORTED_SESSION_REFRESH_LIMIT
			}
		);

		if (importedSessionSignature !== hermesObservedImportedSessionSignature) {
			hermesObservedImportedSessionSignature = importedSessionSignature;

			if (
				importedSessionSignature &&
				shouldRefreshLoadedChatsForHermesSessions(
					$hermesRecentSessions,
					$chats ?? [],
					$pinnedChats ?? [],
					{
						pageSize: SIDEBAR_CHAT_PAGE_SIZE,
						importedSessionLimit: HERMES_IMPORTED_SESSION_REFRESH_LIMIT
					}
				)
			) {
				hermesPendingImportedSessionRefreshSignature = importedSessionSignature;
				refreshSidebarChatListsFromHermesSessions();
			}
		}
	}

	const importChatHandler = async (
		items: SidebarChatImportItem[],
		pinned = false,
		folderId: string | null = null
	) => {
		console.log('importChatHandler', items, pinned, folderId);
		for (const item of items) {
			console.log(item);
			if (item.chat) {
				await importChats(getWorkspaceAuthToken(), [
					{
						chat: item.chat,
						meta: item?.meta ?? {},
						pinned: pinned,
						folder_id: folderId,
						created_at: item?.created_at ?? null,
						updated_at: item?.updated_at ?? null
					}
				]);
			}
		}

		initChatList();
	};

	const inputFilesHandler = async (files: File[]) => {
		console.log(files);

		for (const file of files) {
			const reader = new FileReader();
			reader.onload = async () => {
				const content = typeof reader.result === 'string' ? reader.result : '';

				try {
					const chatItems = JSON.parse(content);
					importChatHandler(chatItems);
				} catch {
					toast.error($i18n.t(`Invalid file format.`));
				}
			};

			reader.readAsText(file);
		}
	};

	const tagEventHandler = async (type: 'delete' | 'add', tagName: string, chatId: string) => {
		console.log(type, tagName, chatId);
		if (type === 'delete') {
			initChatList();
		} else if (type === 'add') {
			initChatList();
		}
	};

	let draggedOver = false;

	const onDragOver = (e: DragEvent) => {
		e.preventDefault();

		// Check if a file is being draggedOver.
		if (e.dataTransfer?.types?.includes('Files')) {
			draggedOver = true;
		} else {
			draggedOver = false;
		}
	};

	const onDragLeave = () => {
		draggedOver = false;
	};

	const onDrop = async (e: DragEvent) => {
		e.preventDefault();
		console.log(e); // Log the drop event

		// Perform file drop check and handle it accordingly
		if (e.dataTransfer?.files) {
			const inputFiles = Array.from(e.dataTransfer?.files);

			if (inputFiles && inputFiles.length > 0) {
				console.log(inputFiles); // Log the dropped files
				inputFilesHandler(inputFiles); // Handle the dropped files
			}
		}

		draggedOver = false; // Reset draggedOver status after drop
	};

	let touchstart: SidebarTouchPoint | null = null;
	let touchend: SidebarTouchPoint | null = null;

	function checkDirection() {
		if (!touchstart || !touchend) {
			return;
		}

		const screenWidth = window.innerWidth;
		const swipeDistance = Math.abs(touchend.screenX - touchstart.screenX);
		if (touchstart.clientX < 40 && swipeDistance >= screenWidth / 8) {
			if (touchend.screenX < touchstart.screenX) {
				showSidebar.set(false);
			}
			if (touchend.screenX > touchstart.screenX) {
				showSidebar.set(true);
			}
		}
	}

	const onTouchStart = (e: TouchEvent) => {
		touchstart = e.changedTouches[0] ?? null;
		if (touchstart) {
			console.log(touchstart.clientX);
		}
	};

	const onTouchEnd = (e: TouchEvent) => {
		touchend = e.changedTouches[0] ?? null;
		checkDirection();
	};

	const onKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Shift') {
			shiftKey = true;
		}
	};

	const onKeyUp = (e: KeyboardEvent) => {
		if (e.key === 'Shift') {
			shiftKey = false;
		}
	};

	const onFocus = () => {
		loadHermesSidebarSessions();
	};

	const onVisibilityChange = () => {
		if (document.visibilityState === 'visible') {
			loadHermesSidebarSessions();
		}
	};

	const onBlur = () => {
		shiftKey = false;
		selectedChatId = null;
	};

	const MIN_WIDTH = 220;
	const MAX_WIDTH = 480;

	let isResizing = false;

	let startWidth = 0;
	let startClientX = 0;

	const resizeStartHandler = (e: MouseEvent) => {
		if ($mobile) return;
		isResizing = true;

		startClientX = e.clientX;
		startWidth = $sidebarWidth ?? 260;

		document.body.style.userSelect = 'none';
	};

	const resizeEndHandler = () => {
		if (!isResizing) return;
		isResizing = false;

		document.body.style.userSelect = '';
		localStorage.setItem('sidebarWidth', String($sidebarWidth));
	};

	const resizeSidebarHandler = (endClientX: number) => {
		const dx = endClientX - startClientX;
		const newSidebarWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + dx));

		sidebarWidth.set(newSidebarWidth);
		document.documentElement.style.setProperty('--sidebar-width', `${newSidebarWidth}px`);
	};

	onMount(() => {
		try {
			const width = Number(localStorage.getItem('sidebarWidth'));
			if (!Number.isNaN(width) && width >= MIN_WIDTH && width <= MAX_WIDTH) {
				sidebarWidth.set(width);
			}
		} catch {}

		document.documentElement.style.setProperty('--sidebar-width', `${$sidebarWidth}px`);
		const unsubscribeSidebarWidth = sidebarWidth.subscribe((w) => {
			document.documentElement.style.setProperty('--sidebar-width', `${w}px`);
		});

		showSidebar.set(!$mobile ? localStorage.sidebar === 'true' : false);

		const unsubscribers = [
			mobile.subscribe((value) => {
				if ($showSidebar && value) {
					showSidebar.set(false);
				}

				if ($showSidebar && !value) {
					const navElement = document.getElementsByTagName('nav')[0];
					if (navElement) {
						navElement.style.setProperty('-webkit-app-region', 'drag');
					}
				}
			}),
			showSidebar.subscribe(async (value) => {
				localStorage.sidebar = value;

				// nav element is not available on the first render
				const navElement = document.getElementsByTagName('nav')[0];

				if (navElement) {
					if ($mobile) {
						if (!value) {
							navElement.style.setProperty('-webkit-app-region', 'drag');
						} else {
							navElement.style.setProperty('-webkit-app-region', 'no-drag');
						}
					} else {
						navElement.style.setProperty('-webkit-app-region', 'drag');
					}
				}

				if (value) {
					// Only fetch channels if the feature is enabled and user has permission
					if (
						$config?.features?.enable_channels &&
						($user?.role === 'admin' || ($user?.permissions?.features?.channels ?? true))
					) {
						await initChannels();
					}
					await initChatList();

					// Check which chats have active tasks
					const allChatIds = [
						...(($chats ?? []) as { id: string }[]).map((c) => c.id),
						...(($pinnedChats ?? []) as { id: string }[]).map((c) => c.id)
					];
					if (allChatIds.length > 0) {
						try {
							const res = await checkActiveChats(getWorkspaceAuthToken(), allChatIds);
							activeChatIds.set(new Set(res.active_chat_ids || []));
						} catch (e) {
							console.debug('Failed to check active chats:', e);
						}
					}
				}
			}),
			settings.subscribe((value) => {
				const nextPinnedModels = value?.pinnedModels ?? [];
				if (pinnedModels !== nextPinnedModels) {
					pinnedModels = nextPinnedModels;
					showPinnedModels = pinnedModels.length > 0;
				}
			})
		];

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);

		window.addEventListener('touchstart', onTouchStart);
		window.addEventListener('touchend', onTouchEnd);

		window.addEventListener('focus', onFocus);
		document.addEventListener('visibilitychange', onVisibilityChange);
		window.addEventListener('blur', onBlur);

		loadHermesSidebarSessions();

		const hermesSidebarRefreshInterval = window.setInterval(() => {
			if (document.visibilityState !== 'hidden') {
				loadHermesSidebarSessions();
			}
		}, HERMES_SIDEBAR_REFRESH_INTERVAL_MS);

		const dropZone = document.getElementById('sidebar');
		if (dropZone) {
			dropZone.addEventListener('dragover', onDragOver);
			dropZone.addEventListener('drop', onDrop);
			dropZone.addEventListener('dragleave', onDragLeave);
		}

		const socketInstance = $socket;
		socketInstance?.on('events', chatActiveEventHandler);

		return () => {
			unsubscribers.forEach((unsubscriber) => unsubscriber());

			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);

			window.removeEventListener('touchstart', onTouchStart);
			window.removeEventListener('touchend', onTouchEnd);

			window.removeEventListener('focus', onFocus);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('blur', onBlur);

			window.clearInterval(hermesSidebarRefreshInterval);
			unsubscribeSidebarWidth();

			if (dropZone) {
				dropZone.removeEventListener('dragover', onDragOver);
				dropZone.removeEventListener('drop', onDrop);
				dropZone.removeEventListener('dragleave', onDragLeave);
			}

			socketInstance?.off('events', chatActiveEventHandler);
		};
	});

	// Handler for chat:active events (defined outside onMount for proper cleanup)
	const chatActiveEventHandler = (event: {
		chat_id: string;
		message_id: string;
		data?: { type?: string; data?: { active?: boolean } };
	}) => {
		if (event.data?.type === 'chat:active') {
			const active = event.data.data?.active ?? false;
			activeChatIds.update((ids) => {
				const newSet = new Set(ids);
				if (active) {
					newSet.add(event.chat_id);
				} else {
					newSet.delete(event.chat_id);
				}
				return newSet;
			});
		}
	};

	const newChatHandler = async () => {
		selectedChatId = null;
		selectedFolder.set(null);

		if ($user?.role !== 'admin' && $user?.permissions?.chat?.temporary_enforced) {
			await temporaryChatEnabled.set(true);
		} else {
			await temporaryChatEnabled.set(false);
		}

		setTimeout(() => {
			if ($mobile) {
				showSidebar.set(false);
			}
		}, 0);
	};

	const itemClickHandler = async () => {
		selectedChatId = null;
		chatId.set('');

		if ($mobile) {
			showSidebar.set(false);
		}

		await tick();
	};

	const isWindows = /Windows/i.test(navigator.userAgent);
</script>

<ArchivedChatsModal
	bind:show={$showArchivedChats}
	onUpdate={async () => {
		await initChatList();
	}}
			onDelete={(id: string) => {
				if ($chatId === id) {
					goto(buildFounderosRootHref($founderosLaunchContext));
					chatId.set('');
				}
			}}
/>

	<ChannelModal
		bind:show={showCreateChannel}
		onSubmit={async (payload: ChannelForm) => {
			let { type, name, is_private, access_grants, group_ids, user_ids } = payload ?? {};
			name = name?.trim();

		if (type === 'dm') {
			if (!user_ids || user_ids.length === 0) {
				toast.error($i18n.t('Please select at least one user for Direct Message channel.'));
				return;
			}
		} else {
			if (!name) {
				toast.error($i18n.t('Channel name cannot be empty.'));
				return;
			}
		}

		const res = await createNewChannel(getWorkspaceAuthToken(), {
			type: type,
			name: name,
			is_private: is_private,
			access_grants: access_grants,
			group_ids: group_ids,
			user_ids: user_ids
		}).catch((error) => {
			toast.error(`${error}`);
			return null;
		});

		if (res) {
			if ($socket) {
				$socket.emit('join-channels', { auth: { token: $user?.token } });
			}
			await initChannels();
			showCreateChannel = false;
			showChannels = true;
			goto(`/channels/${res.id}`);
		}
	}}
/>

	<FolderModal
		bind:show={showCreateFolderModal}
		onSubmit={async (folder: {
			name?: string;
			data?: Record<string, unknown>;
			parent_id?: string | null;
		}) => {
			await createFolder(folder);
			showCreateFolderModal = false;
		}}
	></FolderModal>

<!-- svelte-ignore a11y-no-static-element-interactions -->

{#if $showSidebar}
	<div
		class=" {$isApp
			? ' ml-[4.5rem] md:ml-0'
			: ''} fixed md:hidden z-40 top-0 right-0 left-0 bottom-0 bg-black/60 w-full min-h-screen h-screen flex justify-center overflow-hidden overscroll-contain"
		on:mousedown={() => {
			showSidebar.set(!$showSidebar);
		}}
	></div>
{/if}

{#if HERMES_SHOW_SEARCH}
	<SearchModal
		bind:show={$showSearch}
		onClose={() => {
			if ($mobile) {
				showSidebar.set(false);
			}
		}}
	/>
{/if}

<button
	id="sidebar-new-chat-button"
	class="hidden"
	type="button"
	aria-label={$i18n.t('Start new chat')}
	on:click={() => {
		goto(buildFounderosRootHref($founderosLaunchContext));
		newChatHandler();
	}}
></button>

<svelte:window
	on:mousemove={(e) => {
		if (!isResizing) return;
		resizeSidebarHandler(e.clientX);
	}}
	on:mouseup={() => {
		resizeEndHandler();
	}}
/>

{#if !$mobile && !$showSidebar}
	<div
		class=" pt-[7px] pb-2 px-2 flex flex-col justify-between text-black dark:text-white hover:bg-gray-50/30 dark:hover:bg-gray-950/30 h-full z-10 transition-all border-e-[0.5px] border-gray-50 dark:border-gray-850/30"
		id="sidebar"
	>
		<button
			class="flex flex-col flex-1 {isWindows ? 'cursor-pointer' : 'cursor-[e-resize]'}"
			on:click={async () => {
				showSidebar.set(!$showSidebar);
			}}
		>
			<div class="pb-1.5">
				<Tooltip
					content={$showSidebar ? $i18n.t('Close Sidebar') : $i18n.t('Open Sidebar')}
					placement="right"
				>
					<button
						class="flex rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 transition group {isWindows
							? 'cursor-pointer'
							: 'cursor-[e-resize]'}"
						aria-label={$showSidebar ? $i18n.t('Close Sidebar') : $i18n.t('Open Sidebar')}
					>
						<div class=" self-center flex items-center justify-center size-9">
							<img
								src="{WEBUI_BASE_URL}/static/favicon.png"
								class="sidebar-new-chat-icon size-6 rounded-full group-hover:hidden"
								alt=""
							/>

							<Sidebar className="size-5 hidden group-hover:flex" />
						</div>
					</button>
				</Tooltip>
			</div>

			<div class="-mt-[0.5px]">
				<div class="">
					<Tooltip content={$i18n.t('New Chat')} placement="right">
						<a
							class=" cursor-pointer flex rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 transition group"
							href={buildFounderosRootHref($founderosLaunchContext)}
							draggable="false"
							on:click={async (e) => {
								e.stopImmediatePropagation();
								e.preventDefault();

								goto(buildFounderosRootHref($founderosLaunchContext));
								newChatHandler();
							}}
							aria-label={$i18n.t('New Chat')}
						>
							<div class=" self-center flex items-center justify-center size-9">
								<PencilSquare className="size-4.5" />
							</div>
						</a>
					</Tooltip>
				</div>

				{#if HERMES_SHOW_SEARCH}
					<div>
						<Tooltip content={$i18n.t('Search')} placement="right">
							<button
								class=" cursor-pointer flex rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 transition group"
								on:click={(e) => {
									e.stopImmediatePropagation();
									e.preventDefault();

									showSearch.set(true);
								}}
								draggable="false"
								aria-label={$i18n.t('Search')}
							>
								<div class=" self-center flex items-center justify-center size-9">
									<Search className="size-4.5" />
								</div>
							</button>
						</Tooltip>
					</div>
				{/if}

				{#if showSidebarNotes}
					<div class="">
						<Tooltip content={$i18n.t('Notes')} placement="right">
							<a
								class=" cursor-pointer flex rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 transition group"
								href="/notes"
								on:click={async (e) => {
									e.stopImmediatePropagation();
									e.preventDefault();

									goto('/notes');
									itemClickHandler();
								}}
								draggable="false"
								aria-label={$i18n.t('Notes')}
							>
								<div class=" self-center flex items-center justify-center size-9">
									<Note className="size-4.5" />
								</div>
							</a>
						</Tooltip>
					</div>
				{/if}

				{#if showSidebarWorkspace}
					<div class="">
						<Tooltip content={$i18n.t('Workspace')} placement="right">
							<a
								class=" cursor-pointer flex rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 transition group"
								href="/workspace"
								on:click={async (e) => {
									e.stopImmediatePropagation();
									e.preventDefault();

									goto('/workspace');
									itemClickHandler();
								}}
								aria-label={$i18n.t('Workspace')}
								draggable="false"
							>
								<div class=" self-center flex items-center justify-center size-9">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="1.5"
										stroke="currentColor"
										class="size-4.5"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z"
										/>
									</svg>
								</div>
							</a>
						</Tooltip>
					</div>
				{/if}
			</div>
		</button>

		<div>
			<div>
				<div class=" py-2 flex justify-center items-center">
					{#if $user !== undefined && $user !== null}
						<UserMenu
							role={$user?.role}
							profile={$config?.features?.enable_user_status ?? true}
							showActiveUsers={false}
							on:show={(e: CustomEvent<string>) => {
								if (e.detail === 'archived-chat') {
									showArchivedChats.set(true);
								}
							}}
						>
							<div
								class=" cursor-pointer flex rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 transition group"
							>
								<div class="self-center relative">
									<img
										src={`${WEBUI_API_BASE_URL}/users/${$user?.id}/profile/image`}
										class=" size-7 object-cover rounded-full"
										alt={$i18n.t('Open User Profile Menu')}
										aria-label={$i18n.t('Open User Profile Menu')}
									/>

									{#if $config?.features?.enable_user_status}
										<div class="absolute -bottom-0.5 -right-0.5">
											<span class="relative flex size-2.5">
												<span
													class="relative inline-flex size-2.5 rounded-full {true
														? 'bg-green-500'
														: 'bg-gray-300 dark:bg-gray-700'} border-2 border-white dark:border-gray-900"
												></span>
											</span>
										</div>
									{/if}
								</div>
							</div>
						</UserMenu>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- {$i18n.t('New Folder')} -->
<!-- {$i18n.t('Pinned')} -->

{#if $showSidebar}
	<div
		bind:this={navElement}
		id="sidebar"
		class="h-screen max-h-[100dvh] min-h-screen select-none {$showSidebar
			? `${$mobile ? 'bg-gray-50 dark:bg-gray-950' : 'bg-gray-50/70 dark:bg-gray-950/70'} z-50`
			: ' bg-transparent z-0 '} {$isApp
			? `ml-[4.5rem] md:ml-0 `
			: ' transition-all duration-300 '} shrink-0 text-gray-900 dark:text-gray-200 text-sm fixed top-0 left-0 overflow-x-hidden
        "
		transition:slide={{ duration: 250, axis: 'x' }}
		data-state={$showSidebar}
	>
		<div
			class=" my-auto flex flex-col justify-between h-screen max-h-[100dvh] w-[var(--sidebar-width)] overflow-x-hidden scrollbar-hidden z-50 {$showSidebar
				? ''
				: 'invisible'}"
		>
			<div
				class="sidebar px-[0.5625rem] pt-2 pb-1.5 flex justify-between space-x-1 text-gray-600 dark:text-gray-400 sticky top-0 z-10 -mb-3"
			>
				<a
					class="flex items-center rounded-xl size-8.5 h-full justify-center hover:bg-gray-100/50 dark:hover:bg-gray-850/50 transition no-drag-region"
					href={buildFounderosRootHref($founderosLaunchContext)}
					draggable="false"
					on:click={newChatHandler}
				>
					<img
						crossorigin="anonymous"
						src="{WEBUI_BASE_URL}/static/favicon.png"
						class="sidebar-new-chat-icon size-6 rounded-full"
						alt=""
					/>
				</a>

				<a href={buildFounderosRootHref($founderosLaunchContext)} class="flex flex-1 px-1.5" on:click={newChatHandler}>
					<div
						id="sidebar-webui-name"
						class=" self-center font-medium text-gray-850 dark:text-white font-primary"
					>
						{HERMES_ONLY_SIDEBAR ? HERMES_SHELL_LABEL : $WEBUI_NAME}
					</div>
				</a>
				<Tooltip
					content={$showSidebar ? $i18n.t('Close Sidebar') : $i18n.t('Open Sidebar')}
					placement="bottom"
				>
					<button
						class="flex rounded-xl size-8.5 justify-center items-center hover:bg-gray-100/50 dark:hover:bg-gray-850/50 transition {isWindows
							? 'cursor-pointer'
							: 'cursor-[w-resize]'}"
						on:click={() => {
							showSidebar.set(!$showSidebar);
						}}
						aria-label={$showSidebar ? $i18n.t('Close Sidebar') : $i18n.t('Open Sidebar')}
					>
						<div class=" self-center p-1.5">
							<Sidebar />
						</div>
					</button>
				</Tooltip>

				<div
					class="{scrollTop > 0
						? 'visible'
						: 'invisible'} sidebar-bg-gradient-to-b bg-linear-to-b from-gray-50 dark:from-gray-950 to-transparent from-50% pointer-events-none absolute inset-0 -z-10 -mb-6"
				></div>
			</div>

			<div
				class="relative flex flex-col flex-1 overflow-y-auto scrollbar-hidden pt-3 pb-3"
				on:scroll={(e) => {
					const target = e.currentTarget as HTMLElement | null;

					if (!target) {
						return;
					}

					if (target.scrollTop === 0) {
						scrollTop = 0;
					} else {
						scrollTop = target.scrollTop;
					}
				}}
			>
				<div class="pb-1.5">
					<div class="px-[0.4375rem] flex justify-center text-gray-800 dark:text-gray-200">
						<a
							id="sidebar-new-chat-button"
							class="group grow flex items-center space-x-3 rounded-2xl px-2.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 transition outline-none"
							href={buildFounderosRootHref($founderosLaunchContext)}
							draggable="false"
							on:click={newChatHandler}
							aria-label={$i18n.t('New Chat')}
						>
							<div class="self-center">
								<PencilSquare className=" size-4.5" strokeWidth="2" />
							</div>

							<div class="flex flex-1 self-center translate-y-[0.5px]">
								<div class=" self-center text-sm font-primary">{$i18n.t('New Chat')}</div>
							</div>

							<HotkeyHint name="newChat" className=" group-hover:visible invisible" />
						</a>
					</div>

					{#if HERMES_SHOW_SEARCH}
						<div class="px-[0.4375rem] flex justify-center text-gray-800 dark:text-gray-200">
							<button
								id="sidebar-search-button"
								class="group grow flex items-center space-x-3 rounded-2xl px-2.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 transition outline-none"
								on:click={() => {
									showSearch.set(true);
								}}
								draggable="false"
								aria-label={$i18n.t('Search')}
							>
								<div class="self-center">
									<Search strokeWidth="2" className="size-4.5" />
								</div>

								<div class="flex flex-1 self-center translate-y-[0.5px]">
									<div class=" self-center text-sm font-primary">{$i18n.t('Search')}</div>
								</div>
								<HotkeyHint name="search" className=" group-hover:visible invisible" />
							</button>
						</div>
					{/if}

					{#if showSidebarNotes}
						<div class="px-[0.4375rem] flex justify-center text-gray-800 dark:text-gray-200">
							<a
								id="sidebar-notes-button"
								class="grow flex items-center space-x-3 rounded-2xl px-2.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 transition"
								href="/notes"
								on:click={itemClickHandler}
								draggable="false"
								aria-label={$i18n.t('Notes')}
							>
								<div class="self-center">
									<Note className="size-4.5" strokeWidth="2" />
								</div>

								<div class="flex self-center translate-y-[0.5px]">
									<div class=" self-center text-sm font-primary">{$i18n.t('Notes')}</div>
								</div>
							</a>
						</div>
					{/if}

					{#if showSidebarWorkspace}
						<div class="px-[0.4375rem] flex justify-center text-gray-800 dark:text-gray-200">
							<a
								id="sidebar-workspace-button"
								class="grow flex items-center space-x-3 rounded-2xl px-2.5 py-2 hover:bg-gray-100 dark:hover:bg-gray-900 transition"
								href="/workspace"
								on:click={itemClickHandler}
								draggable="false"
								aria-label={$i18n.t('Workspace')}
							>
								<div class="self-center">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										fill="none"
										viewBox="0 0 24 24"
										stroke-width="2"
										stroke="currentColor"
										class="size-4.5"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z"
										/>
									</svg>
								</div>

								<div class="flex self-center translate-y-[0.5px]">
									<div class=" self-center text-sm font-primary">{$i18n.t('Workspace')}</div>
								</div>
							</a>
						</div>
					{/if}
				</div>

				{#if recentHermesSessions.length > 0}
					<div class="px-2 pt-1.5">
						<div class="flex items-center justify-between gap-3 px-1.5">
							<div class="min-w-0">
								<div
									class="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500"
								>
									{$i18n.t('Hermes sessions')}
								</div>
							</div>

							<button
								type="button"
								class="shrink-0 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
								on:click={openHermesSessionPanel}
							>
								{$i18n.t('Session')}
							</button>
						</div>

						<div class="mt-1.5 space-y-0.5">
							{#each recentHermesSessions as session (session.session_id)}
								<HermesSessionItem
									{session}
									busy={hermesSessionActionId === session.session_id ||
										(Boolean(session.imported_chat_id) &&
											hermesSessionActionId === session.imported_chat_id)}
									on:open={(e) => {
										openImportedHermesSession(e.detail);
									}}
									on:import={(e: CustomEvent<HermesSessionListItem>) => {
										importHermesSidebarSession(e.detail);
									}}
								/>
							{/each}
						</div>
					</div>
				{/if}

				{#if showSidebarModels}
					<Folder
						id="sidebar-models"
						bind:open={showPinnedModels}
						className="px-2 mt-0.5"
						name={$i18n.t('Models')}
						chevron={false}
						dragAndDrop={false}
					>
						<PinnedModelList bind:selectedChatId={selectedChatId} {shiftKey} />
					</Folder>
				{/if}

				{#if showSidebarChannels}
					<Folder
						id="sidebar-channels"
						bind:open={showChannels}
						className="px-2 mt-0.5"
						name={$i18n.t('Channels')}
						chevron={false}
						dragAndDrop={false}
						onAdd={$user?.role === 'admin' || ($user?.permissions?.features?.channels ?? true)
							? async () => {
									await tick();

									setTimeout(() => {
										showCreateChannel = true;
									}, 0);
								}
							: null}
						onAddLabel={$i18n.t('Create Channel')}
					>
						{#each $channels as channel, channelIdx (`${channel?.id}`)}
							<ChannelItem
								{channel}
								onUpdate={async () => {
									await initChannels();
								}}
							/>

							{#if channelIdx < $channels.length - 1 && channel.type !== $channels[channelIdx + 1]?.type}<hr
									class=" border-gray-100/40 dark:border-gray-800/10 my-1.5 w-full"
								/>
							{/if}
						{/each}
					</Folder>
				{/if}

				{#if $config?.features?.enable_folders && ($user?.role === 'admin' || ($user?.permissions?.features?.folders ?? true))}
					<Folder
						id="sidebar-folders"
						bind:open={showFolders}
						className="px-2 mt-0.5"
						name={$i18n.t('Folders')}
						chevron={false}
						onAdd={() => {
							showCreateFolderModal = true;
						}}
						onAddLabel={$i18n.t('New Folder')}
						on:drop={async (e: CustomEvent<SidebarDropDetail>) => {
							const { type, id, item } = e.detail;

							if (type === 'folder') {
								if (folders[id]?.parent_id === null) {
									return;
								}

								const res = await updateFolderParentIdById(getWorkspaceAuthToken(), id, undefined).catch(
									(error) => {
										toast.error(`${error}`);
										return null;
									}
								);

								if (res) {
									await initFolders();
								}
							}
						}}
					>
						<Folders
						bind:folderRegistry
							{folders}
							{shiftKey}
							onDelete={(folderId: string) => {
								selectedFolder.set(null);
								initChatList();
							}}
							on:update={() => {
								initChatList();
							}}
							on:import={(e: CustomEvent<{ folderId: string; items: SidebarChatImportItem[] }>) => {
								const { folderId, items } = e.detail;
								importChatHandler(items, false, folderId);
							}}
							on:change={async () => {
								initChatList();
							}}
						/>
					</Folder>
				{/if}

				<Folder
					id="sidebar-chats"
					className="px-2 mt-0.5"
					name={$i18n.t('Chats')}
					chevron={false}
					on:change={async () => {
						selectedFolder.set(null);
					}}
							on:import={(e: CustomEvent<SidebarChatImportItem[]>) => {
								importChatHandler(e.detail);
							}}
						on:drop={async (e: CustomEvent<SidebarDropDetail>) => {
							const { type, id, item } = e.detail;

						if (type === 'chat') {
							let chat = await getChatById(getWorkspaceAuthToken(), id).catch((error) => {
								return null;
							});
							if (!chat && item) {
								chat = await importChats(getWorkspaceAuthToken(), [
									{
										chat: item.chat,
										meta: item?.meta ?? {},
										pinned: false,
										folder_id: null,
										created_at: item?.created_at ?? null,
										updated_at: item?.updated_at ?? null
									}
								]);
							}

							if (chat) {
								console.log(chat);
								if (chat.folder_id) {
									const res = await updateChatFolderIdById(
										getWorkspaceAuthToken(),
										chat.id,
										undefined
									).catch(
										(error) => {
											toast.error(`${error}`);
											return null;
										}
									);

									folderRegistry[chat.folder_id]?.setFolderItems?.();
								}

								if (chat.pinned) {
									const res = await toggleChatPinnedStatusById(getWorkspaceAuthToken(), chat.id);
								}

								initChatList();
							}
						} else if (type === 'folder') {
							if (folders[id]?.parent_id === null) {
								return;
							}

							const res = await updateFolderParentIdById(getWorkspaceAuthToken(), id, undefined).catch(
								(error) => {
									toast.error(`${error}`);
									return null;
								}
							);

							if (res) {
								await initFolders();
							}
						}
					}}
				>
					{#if $pinnedChats.length > 0}
						<div class="mb-1">
							<div class="flex flex-col space-y-1 rounded-xl">
								<Folder
									id="sidebar-pinned-chats"
									buttonClassName=" text-gray-500"
									on:import={(e: CustomEvent<SidebarChatImportItem[]>) => {
										importChatHandler(e.detail, true);
									}}
									on:drop={async (e: CustomEvent<SidebarDropDetail>) => {
										const { type, id, item } = e.detail;

										if (type === 'chat') {
											let chat = await getChatById(getWorkspaceAuthToken(), id).catch((error) => {
												return null;
											});
											if (!chat && item) {
												chat = await importChats(getWorkspaceAuthToken(), [
													{
														chat: item.chat,
														meta: item?.meta ?? {},
														pinned: false,
														folder_id: null,
														created_at: item?.created_at ?? null,
														updated_at: item?.updated_at ?? null
													}
												]);
											}

											if (chat) {
												console.log(chat);
												if (chat.folder_id) {
									const res = await updateChatFolderIdById(
														getWorkspaceAuthToken(),
														chat.id,
														undefined
													).catch((error) => {
														toast.error(`${error}`);
														return null;
													});
												}

												if (!chat.pinned) {
													const res = await toggleChatPinnedStatusById(getWorkspaceAuthToken(), chat.id);
												}

												initChatList();
											}
										}
									}}
									name={$i18n.t('Pinned')}
								>
									<div
										class="ml-3 pl-1 mt-[1px] flex flex-col overflow-y-auto scrollbar-hidden border-s border-gray-100 dark:border-gray-900 text-gray-900 dark:text-gray-200"
									>
										{#each orderedPinnedChats as chat, idx (`pinned-chat-${chat?.id ?? idx}`)}
											<ChatItem
												className=""
												id={chat.id}
												title={chat.title}
												createdAt={chat.created_at}
												updatedAt={chat.updated_at}
												activityUpdatedAt={chat.effective_updated_at}
												meta={chat.meta}
												sessionSummary={chat.session_summary}
												{shiftKey}
												selected={selectedChatId === chat.id}
												on:select={() => {
													selectedChatId = chat.id;
												}}
												on:unselect={() => {
													selectedChatId = null;
												}}
												on:change={async () => {
													initChatList();
												}}
												on:tag={(e: CustomEvent<{ type: 'add' | 'delete'; name: string }>) => {
													const { type, name } = e.detail;
													tagEventHandler(type, name, chat.id);
												}}
											/>
										{/each}
									</div>
								</Folder>
							</div>
						</div>
					{/if}

					<div class=" flex-1 flex flex-col overflow-y-auto scrollbar-hidden">
						<div class="pt-1.5">
							{#if orderedChats}
								{#each orderedChats as chat, idx (`chat-${chat?.id ?? idx}`)}
								{#if idx === 0 || (idx > 0 && chat.time_range !== orderedChats[idx - 1].time_range)}
										<div
											class="w-full pl-2.5 text-xs text-gray-500 dark:text-gray-500 font-medium {idx ===
											0
												? ''
												: 'pt-5'} pb-1.5"
										>
											{$i18n.t(chat.time_range ?? '')}
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

									<ChatItem
										className=""
										id={chat.id}
										title={chat.title}
										createdAt={chat.created_at}
										updatedAt={chat.updated_at}
										activityUpdatedAt={chat.effective_updated_at}
										meta={chat.meta}
										sessionSummary={chat.session_summary}
										{shiftKey}
										selected={selectedChatId === chat.id}
										on:select={() => {
											selectedChatId = chat.id;
										}}
										on:unselect={() => {
											selectedChatId = null;
										}}
										on:change={async () => {
											initChatList();
										}}
										on:tag={(e: CustomEvent<{ type: 'add' | 'delete'; name: string }>) => {
											const { type, name } = e.detail;
											tagEventHandler(type, name, chat.id);
										}}
									/>
								{/each}

								{#if $scrollPaginationEnabled && !allChatsLoaded}
									<Loader
										on:visible={() => {
											if (!chatListLoading) {
												loadMoreChats();
											}
										}}
									>
										<div
											class="w-full flex justify-center py-1 text-xs animate-pulse items-center gap-2"
										>
											<Spinner className=" size-4" />
											<div class=" ">{$i18n.t('Loading...')}</div>
										</div>
									</Loader>
								{/if}
							{:else}
								<div
									class="w-full flex justify-center py-1 text-xs animate-pulse items-center gap-2"
								>
									<Spinner className=" size-4" />
									<div class=" ">{$i18n.t('Loading...')}</div>
								</div>
							{/if}
						</div>
					</div>
				</Folder>
			</div>

			<div class="px-1.5 pt-1.5 pb-2 sticky bottom-0 z-10 -mt-3 sidebar">
				<div
					class=" sidebar-bg-gradient-to-t bg-linear-to-t from-gray-50 dark:from-gray-950 to-transparent from-50% pointer-events-none absolute inset-0 -z-10 -mt-6"
				></div>
				<div class="flex flex-col font-primary">
					{#if $user !== undefined && $user !== null}
						<UserMenu
							role={$user?.role}
							profile={$config?.features?.enable_user_status ?? true}
							showActiveUsers={false}
							className="w-[calc(var(--sidebar-width)-1rem)]"
							on:show={(e: CustomEvent<string>) => {
								if (e.detail === 'archived-chat') {
									showArchivedChats.set(true);
								}
							}}
						>
							<div
								class=" flex items-center rounded-2xl py-2 px-1.5 w-full hover:bg-gray-100/50 dark:hover:bg-gray-900/50 transition"
							>
								<div class=" self-center mr-3 relative">
									<img
										src={`${WEBUI_API_BASE_URL}/users/${$user?.id}/profile/image`}
										class=" size-7 object-cover rounded-full"
										alt={$i18n.t('Open User Profile Menu')}
										aria-label={$i18n.t('Open User Profile Menu')}
									/>

									{#if $config?.features?.enable_user_status}
										<div class="absolute -bottom-0.5 -right-0.5">
											<span class="relative flex size-2.5">
												<span
													class="relative inline-flex size-2.5 rounded-full {true
														? 'bg-green-500'
														: 'bg-gray-300 dark:bg-gray-700'} border-2 border-white dark:border-gray-900"
												></span>
											</span>
										</div>
									{/if}
								</div>
								<div class=" self-center font-medium">{$user?.name}</div>
							</div>
						</UserMenu>
					{/if}
				</div>
			</div>
		</div>
	</div>

		{#if !$mobile}
			<div
				class="relative flex items-center justify-center group border-l border-gray-50 dark:border-gray-850/30 hover:border-gray-200 dark:hover:border-gray-800 transition z-20"
				id="sidebar-resizer"
				role="separator"
			>
				<button
					type="button"
					aria-label={$i18n.t('Resize sidebar')}
					class=" absolute -left-1.5 -right-1.5 -top-0 -bottom-0 z-20 cursor-col-resize bg-transparent"
					on:mousedown={resizeStartHandler}
				></button>
			</div>
		{/if}
{/if}
