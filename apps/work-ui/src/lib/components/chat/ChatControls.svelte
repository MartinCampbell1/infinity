<!-- @ts-nocheck -->
<script context="module" lang="ts">
	// @ts-nocheck
	let savedTab:
		| 'controls'
		| 'files'
		| 'overview'
		| 'session'
		| 'profile'
		| 'skills'
		| 'memory'
		| 'tasks'
		| 'todos' = 'session';
</script>

<script lang="ts">
	// @ts-nocheck
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import { slide } from 'svelte/transition';
	import { Pane, PaneResizer, type PaneAPI } from 'paneforge';
	import { onDestroy, onMount, tick, getContext } from 'svelte';
	import {
		chatControlsOpenTarget,
		artifactContents,
		config,
		terminalServers,
		mobile,
		showControls,
		showCallOverlay,
		showArtifacts,
		showEmbeds,
		settings,
		showFileNavPath,
		selectedTerminalId,
		user,
		type WorkspacePanelStatus
	} from '$lib/stores';

	import { uploadFile } from '$lib/apis/files';
	import {
		getHermesRuntime,
		type HermesRuntime,
		getHermesWorkspaces,
		type HermesWorkspacesResponse
	} from '$lib/apis/hermes';
	import { toast } from 'svelte-sonner';
	import { collectHermesGeneratedWorkspaceFiles } from '$lib/utils/hermesWorkspace';
	import { createFounderosHostActionRelay } from '$lib/founderos/bridge';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';

	import Controls from './Controls/Controls.svelte';
	import CallOverlay from './MessageInput/CallOverlay.svelte';
	import Drawer from '../common/Drawer.svelte';
	import Artifacts from './Artifacts.svelte';
	import Embeds from './ChatControls/Embeds.svelte';
	import FileNav from './FileNav.svelte';
	import PyodideFileNav from './PyodideFileNav.svelte';
	import Overview from './Overview.svelte';
	import HermesWorkspaceHeader from '$lib/components/hermes/workspace/HermesWorkspaceHeader.svelte';
	import HermesWorkspaceStub from '$lib/components/hermes/workspace/HermesWorkspaceStub.svelte';
	import HermesSessionPanel from '$lib/components/hermes/panels/HermesSessionPanel.svelte';
	import HermesProfilePanel from '$lib/components/hermes/panels/HermesProfilePanel.svelte';
	import HermesSkillsPanel from '$lib/components/hermes/panels/HermesSkillsPanel.svelte';
	import HermesMemoryPanel from '$lib/components/hermes/panels/HermesMemoryPanel.svelte';
	import HermesTasksPanel from '$lib/components/hermes/panels/HermesTasksPanel.svelte';
	import HermesTodosPanel from '$lib/components/hermes/panels/HermesTodosPanel.svelte';
	import { getHermesChatMeta, getPersistedHermesSessionContext } from '$lib/utils/hermesSessions';

	const i18n = getContext<any>('i18n');
	const HERMES_OPERATOR_MODE = true;
	type PanelTabId =
		| 'controls'
		| 'files'
		| 'overview'
		| 'session'
		| 'profile'
		| 'skills'
		| 'memory'
		| 'tasks'
		| 'todos';
	type PanelTab = {
		id: PanelTabId;
		label: string;
	};

	export let history: Record<string, any> = {};
	export let models: any[] = [];

	export let chatId: string | null = null;
	export let chatHermesSession: Record<string, any> | null = null;
	export let chatMeta: Record<string, any> | null = null;

	export let chatFiles: any[] = [];
	export let params: Record<string, any> = {};

	export let eventTarget: EventTarget;
	export let submitPrompt: Function;
	export let stopResponse: Function;
	export let showMessage: Function;
	export let files: any[] = [];
	export let modelId: string | null = null;
	export let taskIds: string[] | null = null;
	export let hermesStreamActive = false;

	export let codeInterpreterEnabled = false;
	export let onHermesProfileSwitched: (
		payload?: Record<string, any> | null
	) => void | Promise<void> = () => {};

	export let pane: PaneAPI | undefined = undefined;

	let largeScreen = false;
	let dragged = false;
	let minSize = 0;
	let paneReady = false;
	let sessionTabPinned = false;
	let inspectTabsExpanded = false;
	let activeWorkspaceSource: WorkspacePanelStatus['source'] = 'stub';
	let defaultWorkspaceStatus: WorkspacePanelStatus = {
		source: 'stub',
		currentPath: undefined,
		itemCount: undefined,
		visibleItemCount: undefined,
		linkedItemCount: undefined,
		selectedFile: null,
		selectedFileName: null,
		attachEnabled: false
	};
	let effectiveWorkspaceStatus: WorkspacePanelStatus = defaultWorkspaceStatus;

	// Tab state for Controls+Workspace panel
	let activeTab: PanelTabId = savedTab;
	// svelte-ignore reactive_declaration_module_script_dependency
	$: {
		savedTab = activeTab;
	}

	let hasMessages = false;
	let primaryTabs: PanelTab[] = [];
	let inspectTabs: PanelTab[] = [];
	let activeTabInInspectGroup = false;

	$: hasMessages = !!(history?.messages && Object.keys(history.messages).length > 0);
	$: currentHermesMeta = getPersistedHermesSessionContext({
		chatHermesSession,
		chatMeta: getHermesChatMeta(chatMeta),
		runtime: hermesRuntime
	});
	$: showAdvancedTab = HERMES_OPERATOR_MODE
		? $user?.role === 'admin'
		: $user?.role === 'admin' || ($user?.permissions?.chat?.controls ?? true);
	$: if ($chatControlsOpenTarget === 'session') {
		sessionTabPinned = true;
	}
	$: if (!$showControls && !hasMessages) {
		sessionTabPinned = false;
	}
	$: showSessionTab = hasMessages || sessionTabPinned || $chatControlsOpenTarget === 'session';
	$: showProfileTab = !!$user;
	$: showSkillsTab = $user?.role === 'admin' || ($user?.permissions?.workspace?.skills ?? false);
	$: showMemoryTab =
		$config?.features?.enable_memories &&
		($user?.role === 'admin' || ($user?.permissions?.features?.memories ?? true));
	$: showTasksTab = hasMessages || taskIds !== null;
	$: showTodosTab = hasMessages;
	$: showFilesTab = true;
	$: showOverviewTab = hasMessages;
	$: primaryTabs = [
		...(showFilesTab ? [{ id: 'files', label: $i18n.t('Workspace') }] : []),
		...(showSessionTab ? [{ id: 'session', label: $i18n.t('Session') }] : []),
		...(showTasksTab ? [{ id: 'tasks', label: $i18n.t('Tasks') }] : [])
	] as PanelTab[];
	$: inspectTabs = [
		...(showProfileTab ? [{ id: 'profile', label: $i18n.t('Profile') }] : []),
		...(showSkillsTab ? [{ id: 'skills', label: $i18n.t('Skills') }] : []),
		...(showMemoryTab ? [{ id: 'memory', label: $i18n.t('Memory') }] : []),
		...(showOverviewTab ? [{ id: 'overview', label: $i18n.t('Overview') }] : []),
		...(showTodosTab ? [{ id: 'todos', label: $i18n.t('Todos') }] : []),
		...(showAdvancedTab ? [{ id: 'controls', label: $i18n.t('Advanced') }] : [])
	] as PanelTab[];
	$: activeTabInInspectGroup = inspectTabs.some((tab) => tab.id === activeTab);
	$: if (activeTabInInspectGroup) {
		inspectTabsExpanded = true;
	}
	$: if (!activeTabInInspectGroup && inspectTabs.length === 0) {
		inspectTabsExpanded = false;
	}
	let workspaceStatus: WorkspacePanelStatus | null = null;
	let hermesRuntime: HermesRuntime | null = null;
	let hermesWorkspaces: HermesWorkspacesResponse | null = null;
	let workspaceContextLoaded = false;
	let workspaceContextLoading = false;

	$: activeWorkspaceSource = $selectedTerminalId
		? 'terminal'
		: codeInterpreterEnabled
			? 'pyodide'
			: 'stub';
	$: generatedWorkspaceFiles = collectHermesGeneratedWorkspaceFiles(history);
	$: stubWorkspaceItemCount = (chatFiles?.length ?? 0) + generatedWorkspaceFiles.length;
	$: defaultWorkspaceStatus = {
		source: activeWorkspaceSource,
		currentPath: undefined,
		itemCount: activeWorkspaceSource === 'stub' ? stubWorkspaceItemCount : undefined,
		visibleItemCount: undefined,
		linkedItemCount: activeWorkspaceSource === 'stub' ? stubWorkspaceItemCount : undefined,
		selectedFile: null,
		selectedFileName: null,
		attachEnabled: false
	} satisfies WorkspacePanelStatus;
	$: effectiveWorkspaceStatus =
		workspaceStatus?.source === activeWorkspaceSource
			? {
					...defaultWorkspaceStatus,
					...workspaceStatus,
					itemCount: workspaceStatus.itemCount ?? defaultWorkspaceStatus.itemCount
				}
			: defaultWorkspaceStatus;
	$: activeHermesWorkspaceItem = hermesWorkspaces?.items?.find((item) => item.is_active) ?? null;
	$: activeHermesWorkspaceName = activeHermesWorkspaceItem?.name ?? '';
	$: activeHermesWorkspacePath = activeHermesWorkspaceItem?.path ?? '';
	$: workspaceTitle =
		activeHermesWorkspaceName ||
		($selectedTerminalId
			? $i18n.t('Terminal workspace')
			: codeInterpreterEnabled
				? $i18n.t('Code workspace')
				: $i18n.t('Workspace surface'));
	$: workspaceSubtitle = $selectedTerminalId
		? $i18n.t('Browse, preview, and attach files for the current conversation.')
		: codeInterpreterEnabled
			? $i18n.t('Inspect runtime files created during this session.')
			: $i18n.t('Inspect the active Hermes workspace and files attached to this chat.');
	$: workspaceBadge = $selectedTerminalId
		? $i18n.t('Terminal')
		: codeInterpreterEnabled
			? $i18n.t('Local')
			: $i18n.t('Hermes');
		$: workspacePathLabel = effectiveWorkspaceStatus.currentPath
			? $i18n.t('Path: {{PATH}}', { PATH: effectiveWorkspaceStatus.currentPath })
			: activeHermesWorkspacePath
				? $i18n.t('Path: {{PATH}}', { PATH: activeHermesWorkspacePath })
				: activeWorkspaceSource === 'stub'
					? $i18n.t('Chat files only')
					: $i18n.t('No active directory');
		$: workspaceVisibleItemCount =
			typeof effectiveWorkspaceStatus.visibleItemCount === 'number'
				? effectiveWorkspaceStatus.visibleItemCount
				: activeWorkspaceSource !== 'stub' && typeof effectiveWorkspaceStatus.itemCount === 'number'
					? effectiveWorkspaceStatus.itemCount
					: null;
		$: workspaceItemCountLabel =
			typeof workspaceVisibleItemCount === 'number'
				? $i18n.t('Visible items: {{COUNT}}', {
						COUNT: workspaceVisibleItemCount
					})
				: '';
	$: workspaceLinkedItemCountLabel =
		activeWorkspaceSource === 'stub' && typeof effectiveWorkspaceStatus.linkedItemCount === 'number'
			? $i18n.t('Linked items: {{COUNT}}', { COUNT: effectiveWorkspaceStatus.linkedItemCount })
			: '';
	$: workspaceProfileLabel = currentHermesMeta?.profile
		? $i18n.t('Profile: {{NAME}}', { NAME: currentHermesMeta.profile })
		: $i18n.t('Profile: default');
	$: workspaceSelectionLabel = effectiveWorkspaceStatus.selectedFileName
		? $i18n.t('Previewing {{NAME}}', { NAME: effectiveWorkspaceStatus.selectedFileName })
		: '';
	$: workspaceMetaItems = [
		workspacePathLabel,
		workspaceItemCountLabel,
		workspaceLinkedItemCountLabel,
		workspaceProfileLabel,
		workspaceSelectionLabel,
		history?.currentId ? $i18n.t('Linked to current chat') : ''
	].filter(Boolean);

	const getOperatorFallbackTab = (): PanelTabId => {
		if (showFilesTab) return 'files';
		if (showSessionTab) return 'session';
		if (showTasksTab) return 'tasks';
		if (showProfileTab) return 'profile';
		if (showSkillsTab) return 'skills';
		if (showMemoryTab) return 'memory';
		if (showOverviewTab) return 'overview';
		if (showTodosTab) return 'todos';
		if (showAdvancedTab) return 'controls';
		return 'files';
	};

	const toggleInspectTabs = () => {
		if (activeTabInInspectGroup && inspectTabsExpanded) {
			activeTab = getOperatorFallbackTab();
			inspectTabsExpanded = false;
			return;
		}

		inspectTabsExpanded = !inspectTabsExpanded;
	};

	const handleWorkspaceStatusChange = (nextStatus: WorkspacePanelStatus) => {
		workspaceStatus = nextStatus;
	};

	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	const loadWorkspaceContext = async (force = false) => {
		if (workspaceContextLoading || (workspaceContextLoaded && !force)) {
			return;
		}

		const token = getWorkspaceAuthToken();
		if (!token) {
			workspaceContextLoaded = true;
			return;
		}

		workspaceContextLoading = true;

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
			workspaceContextLoaded = true;
			workspaceContextLoading = false;
		}
	};

	const handleHermesProfileSwitched = async (payload: Record<string, any> | null = null) => {
		hermesRuntime = null;
		hermesWorkspaces = null;
		workspaceContextLoaded = false;
		workspaceStatus = null;

		await onHermesProfileSwitched(payload);

		if (activeTab === 'files') {
			await loadWorkspaceContext(true);
		}
	};

	const handleHermesWorkspaceSwitched = (payload: HermesWorkspacesResponse) => {
		hermesWorkspaces = payload;
		workspaceContextLoaded = true;
		workspaceStatus = null;
	};

	const hasArtifactSurface = () => ($artifactContents ?? []).length > 0;

	const focusWorkspaceFiles = () => {
		chatControlsOpenTarget.set(null);
		showArtifacts.set(false);
		showEmbeds.set(false);
		showControls.set(true);
		activeTab = 'files';
		void tick().then(() => {
			if (largeScreen && paneReady && pane) {
				openPane();
			}
		});
	};

	const focusWorkspaceDiff = () => {
		chatControlsOpenTarget.set(null);
		const canShowArtifacts = hasArtifactSurface();
		showEmbeds.set(false);
		showArtifacts.set(canShowArtifacts);
		showControls.set(true);
		activeTab = 'files';
		void tick().then(() => {
			if (largeScreen && paneReady && pane) {
				openPane();
			}
		});
	};

	const handleFounderosSessionFocus = (event: Event) => {
		const detail = (event as CustomEvent<{ section?: string }>).detail;
		const section = detail?.section;

		if (section === 'files') {
			focusWorkspaceFiles();
			return;
		}

		if (section === 'diff') {
			focusWorkspaceDiff();
		}
	};

	// Tab fallback: if active tab becomes hidden, switch to next available
	$: if (!showOverviewTab && activeTab === 'overview') activeTab = getOperatorFallbackTab();
	$: if (!showSessionTab && activeTab === 'session') activeTab = getOperatorFallbackTab();
	$: if (!showFilesTab && activeTab === 'files') activeTab = getOperatorFallbackTab();
	$: if (!showSkillsTab && activeTab === 'skills') activeTab = getOperatorFallbackTab();
	$: if (!showMemoryTab && activeTab === 'memory') activeTab = getOperatorFallbackTab();
	$: if (!showTasksTab && activeTab === 'tasks') activeTab = getOperatorFallbackTab();
	$: if (!showTodosTab && activeTab === 'todos') activeTab = getOperatorFallbackTab();
	$: if (!showAdvancedTab && activeTab === 'controls') activeTab = getOperatorFallbackTab();

	// Auto-close if there are no visible tabs
	$: if (
		!showAdvancedTab &&
		!showFilesTab &&
		!showOverviewTab &&
		!showSessionTab &&
		!showProfileTab &&
		!showSkillsTab &&
		!showMemoryTab &&
		!showTasksTab &&
		!showTodosTab
	) {
		showControls.set(false);
	}

	$: if ($chatControlsOpenTarget) {
		const requestedTab: PanelTabId =
			$chatControlsOpenTarget === 'workspace'
				? 'files'
				: $chatControlsOpenTarget === 'session'
					? 'session'
					: 'tasks';

		if (
			(requestedTab === 'files' && showFilesTab) ||
			(requestedTab === 'session' && showSessionTab) ||
			(requestedTab === 'tasks' && showTasksTab)
		) {
			activeTab = requestedTab;
		}

		chatControlsOpenTarget.set(null);
	}

	// Auto-switch to Workspace tab when display_file is triggered
	$: if ($showFileNavPath) {
		activeTab = 'files';
		showControls.set(true);
	}

	$: if (activeTab === 'files' && !workspaceContextLoaded && !workspaceContextLoading) {
		loadWorkspaceContext();
	}

	// Auto-open Workspace tab when a terminal is selected (suppress panel open when full-screen)
	$: if ($selectedTerminalId) {
		activeTab = 'files';
		if (largeScreen) {
			showControls.set(true);
		}
	}

	// Attach a terminal file to the chat input
	const handleTerminalAttach = async (blob: Blob, name: string, contentType: string) => {
		const tempItemId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
		const fileItem = {
			type: 'file',
			file: '',
			id: null,
			url: '',
			name,
			collection_name: '',
			status: 'uploading',
			error: '',
			itemId: tempItemId,
			size: blob.size
		};

		files = [...files, fileItem];

		try {
			const token = getWorkspaceAuthToken();
			if (!token) {
				throw new Error('Missing auth token');
			}
			const file = new File([blob], name, { type: contentType || 'application/octet-stream' });
			const uploaded = await uploadFile(token, file);
			if (!uploaded) throw new Error('Upload failed');

			const idx = files.findIndex((f) => f.itemId === tempItemId);
			if (idx !== -1) {
				files[idx] = {
					...fileItem,
					status: 'uploaded',
					file: uploaded,
					id: uploaded.id,
					url: `${uploaded.id}`,
					collection_name: uploaded?.meta?.collection_name
				};
				files = files;
			}
			toast.success($i18n.t('File attached to chat'));
		} catch (e) {
			files = files.filter((f) => f.itemId !== tempItemId);
			toast.error($i18n.t('Failed to attach file'));
		}
	};

	export const openPane = () => {
		if (!pane) {
			return;
		}

		if (parseInt(localStorage?.chatControlsSize)) {
			const container = document.getElementById('chat-container');
			if (!container?.clientWidth) {
				return;
			}
			let size = Math.floor(
				(parseInt(localStorage?.chatControlsSize) / container.clientWidth) * 100
			);
			pane.resize(size);
		} else {
			pane.resize(minSize);
		}
	};

	const handleMediaQuery = async (e: MediaQueryList | MediaQueryListEvent) => {
		if (e.matches) {
			largeScreen = true;
			if ($showCallOverlay) {
				showCallOverlay.set(false);
				await tick();
				showCallOverlay.set(true);
			}
		} else {
			largeScreen = false;
			if ($showCallOverlay) {
				showCallOverlay.set(false);
				await tick();
				showCallOverlay.set(true);
			}
			pane = undefined;
		}
	};

	const onMouseDown = () => {
		dragged = true;
	};
	const onMouseUp = () => {
		dragged = false;
	};

	onMount(() => {
		const mediaQuery = window.matchMedia('(min-width: 1024px)');
		mediaQuery.addEventListener('change', handleMediaQuery);
		handleMediaQuery(mediaQuery);

		let resizeObserver: ResizeObserver | null = null;
		let isDestroyed = false;

		// Wait for Svelte to render the Pane after largeScreen changed
		const init = async () => {
			await tick();

			if (isDestroyed) return;

			// If controls were persisted as open, set the pane to the saved size
			if ($showControls && pane) {
				openPane();
			}

			setTimeout(() => {
				paneReady = true;
			}, 0);

			const container = document.getElementById('chat-container') as HTMLElement;
			if (!container) return;

			minSize = Math.floor((350 / container.clientWidth) * 100);
			resizeObserver = new ResizeObserver((entries) => {
				for (let entry of entries) {
					const width = entry.contentRect.width;
					minSize = Math.floor((350 / width) * 100);
					if ($showControls) {
						if (pane && pane.isExpanded() && pane.getSize() < minSize) {
							pane.resize(minSize);
						} else {
							let size = Math.floor(
								(parseInt(localStorage?.chatControlsSize) / container.clientWidth) * 100
							);
							if (size < minSize && pane) pane.resize(minSize);
						}
					}
				}
			});
			resizeObserver.observe(container);
		};
		init();

		document.addEventListener('mousedown', onMouseDown);
		document.addEventListener('mouseup', onMouseUp);
		const founderosHostActionCleanup = createFounderosHostActionRelay({
			onAccountSwitch: () => undefined,
			onSessionRetry: () => undefined,
			onSessionFocus: handleFounderosSessionFocus
		});

		return () => {
			isDestroyed = true;
			paneReady = false;
			resizeObserver?.disconnect();
			if (!largeScreen) {
				showControls.set(false);
			}
			mediaQuery.removeEventListener('change', handleMediaQuery);
			document.removeEventListener('mousedown', onMouseDown);
			document.removeEventListener('mouseup', onMouseUp);
			founderosHostActionCleanup();
		};
	});

	const closeHandler = () => {
		if (!largeScreen) {
			showControls.set(false);
		}
		showArtifacts.set(false);
		showEmbeds.set(false);
		if ($showCallOverlay) showCallOverlay.set(false);
	};

	$: if (paneReady && !chatId && activeTab !== 'session' && $chatControlsOpenTarget !== 'session') {
		closeHandler();
	}

	// Helper: is a "special" full-screen panel active?
	$: specialPanel = $showCallOverlay || $showArtifacts || $showEmbeds;
</script>

{#if !largeScreen}
	{#if $showControls}
		<Drawer
			show={$showControls}
			onClose={() => showControls.set(false)}
			className="min-h-[100dvh] !bg-slate-950"
		>
			<div class="h-[100dvh] flex flex-col">
				{#if $showCallOverlay}
					<div
						class="h-full max-h-[100dvh] bg-slate-950 text-gray-300 flex justify-center"
					>
						<CallOverlay
							bind:files
							{submitPrompt}
							{stopResponse}
							{modelId}
							{chatId}
							{eventTarget}
							on:close={() => showControls.set(false)}
						/>
					</div>
					{:else if $showEmbeds}
						<Embeds />
					{:else if $showArtifacts}
						<Artifacts />
				{:else}
					<!-- Controls + Workspace tabs -->
							<div class="flex flex-col h-full min-h-0">
								<!-- Tab bar -->
								<div class="flex items-center justify-between px-2 pt-2 pb-2 shrink-0">
									<div class="flex gap-1 min-w-0 overflow-x-auto scrollbar-hidden">
										{#each primaryTabs as tab}
										<button
											class="px-2.5 py-1 text-sm rounded-lg transition whitespace-nowrap {activeTab ===
											tab.id
												? 'bg-white/10 font-medium text-white'
												: 'text-slate-400 hover:text-slate-200'}"
											on:click={() => (activeTab = tab.id)}
										>
												{tab.label}
											</button>
										{/each}
										{#if inspectTabs.length > 0}
										<button
											class="px-2.5 py-1 text-sm rounded-lg transition whitespace-nowrap {(inspectTabsExpanded ||
											activeTabInInspectGroup)
												? 'bg-white/10 font-medium text-white'
												: 'text-slate-400 hover:text-slate-200'}"
											on:click={toggleInspectTabs}
										>
												{$i18n.t('Inspect')}
											</button>
										{/if}
									</div>
									<button
									class="p-1 rounded-lg hover:bg-white/10 transition text-slate-400"
									on:click={() => showControls.set(false)}
									aria-label={$i18n.t('Close')}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.5"
									class="size-4"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
								{#if inspectTabsExpanded && inspectTabs.length > 0}
									<div
										class="flex gap-1 overflow-x-auto border-b border-gray-100 px-2 pb-2 dark:border-gray-800"
									>
										{#each inspectTabs as tab}
										<button
											class="px-2.5 py-1 text-[11px] rounded-full transition whitespace-nowrap {activeTab ===
											tab.id
												? 'border border-white/10 bg-white/12 text-white'
												: 'border border-white/8 bg-white/6 text-slate-300 hover:bg-white/10'}"
											on:click={() => (activeTab = tab.id)}
										>
												{tab.label}
											</button>
										{/each}
									</div>
								{/if}

								<div
							class="flex-1 min-h-0 {activeTab === 'overview'
								? 'h-full'
								: activeTab === 'controls'
									? 'overflow-y-auto px-3 pt-1'
									: ''}"
						>
							{#if activeTab === 'overview'}
								<Overview
									{history}
									onNodeClick={(e: any) => {
										const node = e.node;
										showMessage(node.data.message, true);
									}}
									onClose={() => showControls.set(false)}
								/>
							{:else if activeTab === 'profile'}
								<HermesProfilePanel
									active={activeTab === 'profile'}
									{taskIds}
									{hermesStreamActive}
									onProfileSwitched={handleHermesProfileSwitched}
								/>
							{:else if activeTab === 'skills'}
								<HermesSkillsPanel active={activeTab === 'skills'} />
							{:else if activeTab === 'memory'}
								<HermesMemoryPanel active={activeTab === 'memory'} />
							{:else if activeTab === 'tasks'}
								<HermesTasksPanel active={activeTab === 'tasks'} {taskIds} {stopResponse} />
							{:else if activeTab === 'todos'}
								<HermesTodosPanel active={activeTab === 'todos'} {history} />
							{:else if activeTab === 'session'}
								<HermesSessionPanel
									active={activeTab === 'session'}
									{chatId}
									{chatHermesSession}
									{chatMeta}
									{history}
									{models}
									{taskIds}
									{chatFiles}
								/>
							{:else if activeTab === 'files' && $selectedTerminalId}
								<div class="flex h-full min-h-0 flex-col">
									<HermesWorkspaceHeader
										title={workspaceTitle}
										subtitle={workspaceSubtitle}
										badge={workspaceBadge}
										metaItems={workspaceMetaItems}
									/>
									<div class="flex-1 min-h-0">
										<FileNav
											onAttach={handleTerminalAttach}
											onWorkspaceStatusChange={handleWorkspaceStatusChange}
										/>
									</div>
								</div>
							{:else if activeTab === 'files' && codeInterpreterEnabled}
								<div class="flex h-full min-h-0 flex-col">
									<HermesWorkspaceHeader
										title={workspaceTitle}
										subtitle={workspaceSubtitle}
										badge={workspaceBadge}
										metaItems={workspaceMetaItems}
									/>
									<div class="flex-1 min-h-0">
										<PyodideFileNav
											onAttach={handleTerminalAttach}
											onWorkspaceStatusChange={handleWorkspaceStatusChange}
										/>
									</div>
								</div>
							{:else if activeTab === 'files'}
								<div class="flex h-full min-h-0 flex-col">
									<HermesWorkspaceHeader
										title={workspaceTitle}
										subtitle={workspaceSubtitle}
										badge={workspaceBadge}
										metaItems={workspaceMetaItems}
									/>
									<div class="flex-1 min-h-0">
										<HermesWorkspaceStub
											active={activeTab === 'files'}
											{chatId}
											{chatFiles}
											generatedFiles={generatedWorkspaceFiles}
											{taskIds}
											hermesWorkspaces={hermesWorkspaces?.items ?? []}
											onAttach={handleTerminalAttach}
											onHermesWorkspaceSwitched={handleHermesWorkspaceSwitched}
											onWorkspaceStatusChange={handleWorkspaceStatusChange}
										/>
									</div>
								</div>
							{:else}
								<Controls embed={true} {models} bind:chatFiles bind:params />
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</Drawer>
	{/if}
{:else}
	{#if $showControls}
		<PaneResizer
			class="relative flex items-center justify-center group border-l border-gray-50 dark:border-gray-850/30 hover:border-gray-200 dark:hover:border-gray-800 transition z-20"
			id="controls-resizer"
		>
			<div
				class="absolute -left-1.5 -right-1.5 -top-0 -bottom-0 z-20 cursor-col-resize bg-transparent"
			></div>
		</PaneResizer>
	{/if}

	<Pane
		bind:pane
			defaultSize={0}
			onResize={(size) => {
				if ($showControls && pane?.isExpanded()) {
					if (size < minSize) pane.resize(minSize);
					if (size < minSize) {
						localStorage.chatControlsSize = 0;
					} else {
						const container = document.getElementById('chat-container');
						if (container?.clientWidth) {
							localStorage.chatControlsSize = Math.floor((size / 100) * container.clientWidth);
						}
					}
				}
			}}
		onCollapse={() => {
			if (paneReady) showControls.set(false);
		}}
		collapsible={true}
		class="z-10 bg-slate-950"
	>
		{#if $showControls}
			<div class="flex max-h-full min-h-full">
				<div
					class="w-full {specialPanel && !$showCallOverlay
						? ' '
						: 'bg-slate-950 dark:shadow-lg'} z-40 pointer-events-auto {activeTab ===
					'files'
						? ''
						: 'overflow-y-auto'} scrollbar-hidden"
					id="controls-container"
				>
					{#if $showCallOverlay}
						<div class="w-full h-full flex justify-center">
							<CallOverlay
								bind:files
								{submitPrompt}
								{stopResponse}
								{modelId}
								{chatId}
								{eventTarget}
								on:close={() => showControls.set(false)}
							/>
						</div>
						{:else if $showEmbeds}
							<Embeds overlay={dragged} />
						{:else if $showArtifacts}
							<Artifacts overlay={dragged} />
					{:else}
						<!-- Controls + Workspace tabs -->
						<div class="flex flex-col h-full min-h-0">
							<!-- Tab bar -->
							<div class="flex items-center justify-between px-2 pt-2 pb-2 shrink-0">
								<div class="flex gap-1 min-w-0 overflow-x-auto scrollbar-hidden">
									{#each primaryTabs as tab}
										<button
											class="px-2.5 py-1 text-sm rounded-lg transition whitespace-nowrap {activeTab ===
											tab.id
												? 'bg-white/10 font-medium text-white'
												: 'text-slate-400 hover:text-slate-200'}"
											on:click={() => (activeTab = tab.id)}
										>
											{tab.label}
										</button>
									{/each}
									{#if inspectTabs.length > 0}
										<button
											class="px-2.5 py-1 text-sm rounded-lg transition whitespace-nowrap {(inspectTabsExpanded ||
											activeTabInInspectGroup)
												? 'bg-white/10 font-medium text-white'
												: 'text-slate-400 hover:text-slate-200'}"
											on:click={toggleInspectTabs}
										>
											{$i18n.t('Inspect')}
										</button>
									{/if}
								</div>
								<button
									class="p-1 rounded-lg hover:bg-white/10 transition text-slate-400"
									on:click={() => showControls.set(false)}
									aria-label={$i18n.t('Close')}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"
										class="size-4"
									>
										<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
							{#if inspectTabsExpanded && inspectTabs.length > 0}
								<div
									class="flex gap-1 overflow-x-auto border-b border-white/8 px-2 pb-2"
								>
									{#each inspectTabs as tab}
										<button
											class="px-2.5 py-1 text-[11px] rounded-full transition whitespace-nowrap {activeTab ===
											tab.id
												? 'border border-white/10 bg-white/12 text-white'
												: 'border border-white/8 bg-white/6 text-slate-300 hover:bg-white/10'}"
											on:click={() => (activeTab = tab.id)}
										>
											{tab.label}
										</button>
									{/each}
								</div>
							{/if}

							<div
								class="flex-1 min-h-0 {activeTab === 'overview'
									? 'h-full'
									: activeTab === 'controls'
										? 'overflow-y-auto px-3 pt-1'
										: ''}"
							>
								{#if activeTab === 'overview'}
									<Overview
										{history}
										onNodeClick={(e: any) => {
											const node = e.node;
											if (node?.data?.message?.favorite) {
												history.messages[node.data.message.id].favorite = true;
											} else {
												history.messages[node.data.message.id].favorite = null;
											}
											showMessage(node.data.message, true);
										}}
										onClose={() => showControls.set(false)}
									/>
								{:else if activeTab === 'session'}
									<HermesSessionPanel
										active={activeTab === 'session'}
										{chatId}
										{chatHermesSession}
										{chatMeta}
										{history}
										{models}
										{taskIds}
										{chatFiles}
									/>
								{:else if activeTab === 'profile'}
									<HermesProfilePanel
										active={activeTab === 'profile'}
										{taskIds}
										{hermesStreamActive}
										onProfileSwitched={handleHermesProfileSwitched}
									/>
								{:else if activeTab === 'skills'}
									<HermesSkillsPanel active={activeTab === 'skills'} />
								{:else if activeTab === 'memory'}
									<HermesMemoryPanel active={activeTab === 'memory'} />
								{:else if activeTab === 'tasks'}
									<HermesTasksPanel active={activeTab === 'tasks'} {taskIds} {stopResponse} />
								{:else if activeTab === 'todos'}
									<HermesTodosPanel active={activeTab === 'todos'} {history} />
								{:else if activeTab === 'files' && $selectedTerminalId}
									<div class="flex h-full min-h-0 flex-col">
										<HermesWorkspaceHeader
											title={workspaceTitle}
											subtitle={workspaceSubtitle}
											badge={workspaceBadge}
											metaItems={workspaceMetaItems}
										/>
										<div class="flex-1 min-h-0">
											<FileNav
												onAttach={handleTerminalAttach}
												onWorkspaceStatusChange={handleWorkspaceStatusChange}
												overlay={dragged}
											/>
										</div>
									</div>
								{:else if activeTab === 'files' && codeInterpreterEnabled}
									<div class="flex h-full min-h-0 flex-col">
										<HermesWorkspaceHeader
											title={workspaceTitle}
											subtitle={workspaceSubtitle}
											badge={workspaceBadge}
											metaItems={workspaceMetaItems}
										/>
										<div class="flex-1 min-h-0">
											<PyodideFileNav
												onAttach={handleTerminalAttach}
												onWorkspaceStatusChange={handleWorkspaceStatusChange}
												overlay={dragged}
											/>
										</div>
									</div>
								{:else if activeTab === 'files'}
									<div class="flex h-full min-h-0 flex-col">
										<HermesWorkspaceHeader
											title={workspaceTitle}
											subtitle={workspaceSubtitle}
											badge={workspaceBadge}
											metaItems={workspaceMetaItems}
										/>
										<div class="flex-1 min-h-0">
											<HermesWorkspaceStub
												active={activeTab === 'files'}
												{chatId}
												{chatFiles}
												generatedFiles={generatedWorkspaceFiles}
												{taskIds}
												hermesWorkspaces={hermesWorkspaces?.items ?? []}
												onAttach={handleTerminalAttach}
												onHermesWorkspaceSwitched={handleHermesWorkspaceSwitched}
												onWorkspaceStatusChange={handleWorkspaceStatusChange}
											/>
										</div>
									</div>
								{:else}
									<Controls embed={true} {models} bind:chatFiles bind:params />
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</Pane>
{/if}
