<!-- @ts-nocheck -->
<script context="module" lang="ts">
	// @ts-nocheck
	let savedSelectionByChatKey: Record<string, string | null> = {};

	type HermesWorkspaceContinuityState = {
		rootPath: string | null;
		browsePath: string | null;
		previewReference: string | null;
		lastFocusedReference: string | null;
	};

	const createWorkspaceContinuityState = (): HermesWorkspaceContinuityState => ({
		rootPath: null,
		browsePath: null,
		previewReference: null,
		lastFocusedReference: null
	});

	let savedWorkspaceStateByChatKey: Record<string, HermesWorkspaceContinuityState> = {};
</script>

<script lang="ts">
	// @ts-nocheck
	import { getContext, onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';

	import {
		getHermesWorkspaceBrowse,
		getHermesWorkspaceFileUrl,
		type HermesWorkspaceBrowseEntry,
		switchHermesWorkspace,
		type HermesWorkspace,
		type HermesWorkspaceSwitchResponse
	} from '$lib/apis/hermes';
	import { WEBUI_API_BASE_URL } from '$lib/constants';
	import { getFileById, getFileContentById } from '$lib/apis/files';
	import type { WorkspacePanelStatus } from '$lib/stores';
	import { copyToClipboard, formatFileSize } from '$lib/utils';
	import {
		buildHermesWorkspaceSurfaceItems,
		getHermesWorkspacePreviewMode,
		type HermesGeneratedWorkspaceFile,
		type HermesWorkspaceSurfaceItem
	} from '$lib/utils/hermesWorkspace';
	import {
		emitFounderosDeepLink as emitFounderosDeepLinkEvent,
		emitFounderosError as emitFounderosErrorEvent,
		emitFounderosFileOpened as emitFounderosFileOpenedEvent
	} from '$lib/founderos/events';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import FilePreview from '$lib/components/chat/FileNav/FilePreview.svelte';
	import Document from '$lib/components/icons/Document.svelte';
	import Folder from '$lib/components/icons/Folder.svelte';
	import HermesWorkspaceGuideRow from './HermesWorkspaceGuideRow.svelte';

	type TranslationStore = {
		subscribe: (
			run: (value: { t: (key: string, params?: Record<string, unknown>) => string }) => void
		) => () => void;
	};

	const i18n = getContext<TranslationStore>('i18n');

	// TODO(21st): Replace this local workspace stub pattern with a 21st.dev-derived pattern once MCP auth is fixed.

	export let active = false;
	export let chatId: string | null = null;
	export let chatFiles: Array<Record<string, unknown>> = [];
	export let generatedFiles: HermesGeneratedWorkspaceFile[] = [];
	export let taskIds: string[] | null = null;
	export let hermesWorkspaces: HermesWorkspace[] = [];
	export let onAttach:
		| ((blob: Blob, name: string, contentType: string) => Promise<void> | void)
		| null = null;
	export let onHermesWorkspaceSwitched: (payload: HermesWorkspaceSwitchResponse) => void = () => {};
	export let onWorkspaceStatusChange: ((status: WorkspacePanelStatus) => void) | null = null;

	let selectedItemId: string | null = null;
	let hydratedChatKey: string | null = null;
	let loadedItemId: string | null = null;
	let loadRequestId = 0;
	let selectedItem: HermesWorkspaceSurfaceItem | null = null;
	let selectedWorkspaceItem: HermesWorkspaceSurfaceItem | null = null;
	let switchingWorkspacePath: string | null = null;
	let workspaceBrowseLoaded = false;
	let workspaceBrowseLoading = false;
	let workspaceBrowseError = '';
	let workspaceBrowsePath = '';
	let workspaceBrowseRootPath = '';
	let workspaceBrowseEntries: HermesWorkspaceBrowseEntry[] = [];
	let workspaceContinuityState = createWorkspaceContinuityState();

	let selectedItemLoading = false;
	let previewError = '';
	let previewUnsupported = false;

	let fileContent: string | null = null;
	let fileImageUrl: string | null = null;
	let fileVideoUrl: string | null = null;
	let fileAudioUrl: string | null = null;
	let filePdfData: ArrayBuffer | null = null;
	let fileSqliteData: ArrayBuffer | null = null;
	let fileOfficeHtml: string | null = null;
	let fileOfficeSlides: string[] | null = null;
	let currentSlide = 0;
	let excelSheetNames: string[] = [];
	let selectedExcelSheet = '';
	let excelWorkbook: import('xlsx').WorkBook | null = null;

	$: workspaceItems = buildHermesWorkspaceSurfaceItems(chatFiles, generatedFiles);
	$: availableHermesWorkspaces = (Array.isArray(hermesWorkspaces) ? hermesWorkspaces : []).filter(
		(workspace): workspace is HermesWorkspace =>
			!!workspace && typeof workspace.path === 'string' && !!workspace.path
	);
	$: activeHermesWorkspace =
		availableHermesWorkspaces.find((workspace) => workspace.is_active) ??
		availableHermesWorkspaces[0] ??
		null;
	$: generatedWorkspaceItems = workspaceItems.filter((item) => item.source === 'generated');
	$: chatWorkspaceItems = workspaceItems.filter((item) => item.source === 'chat');
	$: activeChatKey = chatId ?? '__current_chat__';
	$: selectedChatItem = workspaceItems.find((item) => item.id === selectedItemId) ?? null;
	$: selectedItem = selectedWorkspaceItem ?? selectedChatItem ?? null;
	$: hasActiveTasks = (taskIds?.length ?? 0) > 0;
	$: workspaceBrowserEntries = (workspaceBrowseEntries ?? [])
		.filter((entry) => !!entry?.name)
		.sort((left, right) => {
			if (left.type !== right.type) {
				return left.type === 'directory' ? -1 : 1;
			}

			return left.name.localeCompare(right.name);
		});
	$: currentWorkspacePath = workspaceBrowsePath || activeHermesWorkspace?.path || '';
	$: canBrowseWorkspace = !!activeHermesWorkspace?.path;
	$: hasWorkspaceParent =
		!!workspaceBrowsePath &&
		!!workspaceBrowseRootPath &&
		normalizeWorkspacePath(workspaceBrowsePath) !== normalizeWorkspacePath(workspaceBrowseRootPath);
		$: workspacePathTrail =
			currentWorkspacePath && workspaceBrowseRootPath
				? buildWorkspacePathTrail(
						currentWorkspacePath,
						workspaceBrowseRootPath,
						activeHermesWorkspace?.name || getWorkspaceLeafName(workspaceBrowseRootPath)
					)
				: [];
		$: workspaceBrowserMeta = [
			$i18n.t('Path: {{PATH}}', { PATH: currentWorkspacePath }),
			workspaceBrowserEntries.length
				? $i18n.t('Folder entries: {{COUNT}}', { COUNT: workspaceBrowserEntries.length })
				: ''
		].filter(Boolean);
		$: workspaceGuideMeta = [
			$i18n.t('Linked items: {{COUNT}}', { COUNT: workspaceItems.length }),
			generatedWorkspaceItems.length
				? $i18n.t('Generated: {{COUNT}}', { COUNT: generatedWorkspaceItems.length })
				: '',
			chatWorkspaceItems.length
				? $i18n.t('Attached: {{COUNT}}', { COUNT: chatWorkspaceItems.length })
				: ''
		].filter(Boolean);
	$: selectedItemMetaItems = selectedItem
		? [
				selectedItem.source === 'generated'
					? $i18n.t('Generated file')
					: selectedItem.source === 'workspace'
						? $i18n.t('Workspace file')
						: selectedItem.type === 'file'
							? $i18n.t('Current chat file')
							: $i18n.t('Current chat attachment'),
				selectedItem.executionName
					? $i18n.t('Run: {{NAME}}', { NAME: selectedItem.executionName })
					: '',
				selectedItem.type !== 'file' ? $i18n.t('Type: {{TYPE}}', { TYPE: selectedItem.type }) : '',
				selectedItem.size ? formatFileSize(selectedItem.size) : '',
				selectedItem.reference && selectedItem.reference !== selectedItem.name
					? selectedItem.reference
					: ''
			].filter(Boolean)
		: [];
	$: canAttachSelectedItem =
		!!onAttach &&
		!!selectedItem &&
		(!!selectedItem.fileId ||
			!!selectedItem.url ||
			(typeof selectedItem.content === 'string' && selectedItem.content.length >= 0));
	$: canOpenSelectedItem =
		!!selectedItem &&
		(!!selectedItem.url ||
			!!selectedItem.fileId ||
			(typeof selectedItem.content === 'string' && selectedItem.content.length > 0));

	$: if (activeChatKey !== hydratedChatKey) {
		hydratedChatKey = activeChatKey;
		workspaceContinuityState =
			savedWorkspaceStateByChatKey[activeChatKey] ?? createWorkspaceContinuityState();
		selectedItemId = savedSelectionByChatKey[activeChatKey] ?? null;
		selectedWorkspaceItem = workspaceContinuityState.previewReference
			? createWorkspaceSurfaceItem(workspaceContinuityState.previewReference)
			: null;
		workspaceBrowseLoaded = false;
		workspaceBrowseLoading = false;
		workspaceBrowseError = '';
		workspaceBrowsePath = '';
		workspaceBrowseRootPath = '';
		workspaceBrowseEntries = [];
		loadedItemId = null;
		clearPreviewState();
	}

	$: if (selectedItemId && !workspaceItems.some((item) => item.id === selectedItemId)) {
		selectedItemId = null;
		loadedItemId = null;
		savedSelectionByChatKey[activeChatKey] = null;
		clearPreviewState();
	}

	$: if (activeHermesWorkspace?.path !== workspaceBrowseRootPath) {
		const nextRootPath = activeHermesWorkspace?.path ?? '';
		const canRestoreWorkspaceState =
			!!nextRootPath && workspaceContinuityState.rootPath === nextRootPath;

		workspaceBrowseLoaded = false;
		workspaceBrowseLoading = false;
		workspaceBrowseError = '';
		workspaceBrowsePath = canRestoreWorkspaceState
			? (workspaceContinuityState.browsePath ?? '')
			: '';
		workspaceBrowseRootPath = nextRootPath;
		workspaceBrowseEntries = [];
		selectedWorkspaceItem =
			canRestoreWorkspaceState && workspaceContinuityState.previewReference
				? createWorkspaceSurfaceItem(workspaceContinuityState.previewReference)
				: null;

		if (!canRestoreWorkspaceState) {
			persistWorkspaceContinuityState({
				rootPath: nextRootPath || null,
				browsePath: null,
				previewReference: null,
				lastFocusedReference: null
			});
		}
	}

	$: if (selectedItem?.id !== loadedItemId) {
		loadedItemId = selectedItem?.id ?? null;
		if (selectedItem) {
			void loadSelectedItem(selectedItem);
		} else {
			clearPreviewState();
		}
	}

	$: if (active && canBrowseWorkspace && !workspaceBrowseLoaded && !workspaceBrowseLoading) {
		void loadWorkspaceBrowse(workspaceBrowsePath || activeHermesWorkspace?.path || null);
	}

	$: if (active) {
		onWorkspaceStatusChange?.({
			source: 'stub',
			currentPath: currentWorkspacePath || undefined,
			itemCount: canBrowseWorkspace ? workspaceBrowserEntries.length : workspaceItems.length,
			visibleItemCount: canBrowseWorkspace ? workspaceBrowserEntries.length : undefined,
			linkedItemCount: workspaceItems.length,
			selectedFile: selectedItem?.reference ?? null,
			selectedFileName: selectedItem?.name ?? null,
			attachEnabled: canAttachSelectedItem
		});
	}

	const clearPreviewState = () => {
		if (fileImageUrl) {
			URL.revokeObjectURL(fileImageUrl);
		}
		if (fileVideoUrl) {
			URL.revokeObjectURL(fileVideoUrl);
		}
		if (fileAudioUrl) {
			URL.revokeObjectURL(fileAudioUrl);
		}

		fileContent = null;
		fileImageUrl = null;
		fileVideoUrl = null;
		fileAudioUrl = null;
		filePdfData = null;
		fileSqliteData = null;
		fileOfficeHtml = null;
		fileOfficeSlides = null;
		currentSlide = 0;
		excelSheetNames = [];
		selectedExcelSheet = '';
		excelWorkbook = null;
		previewError = '';
		previewUnsupported = false;
	};

	const getErrorMessage = (error: unknown, fallback: string) => {
		if (typeof error === 'string') {
			return error;
		}

		if (error && typeof error === 'object') {
			if ('detail' in error && typeof error.detail === 'string') {
				return error.detail;
			}

			if ('message' in error && typeof error.message === 'string') {
				return error.message;
			}
		}

		return fallback;
	};

	const emitFounderosFileOpened = (path: string) => {
		const normalizedPath = path.trim();
		if (!normalizedPath) {
			return;
		}

		emitFounderosFileOpenedEvent({ path: normalizedPath });
	};

	const emitFounderosDeepLink = (payload: { filePath?: string; anchor?: string }) => {
		emitFounderosDeepLinkEvent(payload);
	};

	const emitFounderosError = (payload: { code?: string; message: string }) => {
		const message = payload.message.trim();
		if (!message) {
			return;
		}

		emitFounderosErrorEvent({
			...(payload.code ? { code: payload.code } : {}),
			message
		});
	};

	const getWorkspaceItemOpenPath = (item: HermesWorkspaceSurfaceItem) =>
		item.reference?.trim() || item.url?.trim() || item.name?.trim() || '';

	const emitWorkspaceItemOpened = (item: HermesWorkspaceSurfaceItem, anchor: string) => {
		const path = getWorkspaceItemOpenPath(item);
		if (!path) {
			return;
		}

		emitFounderosFileOpened(path);
		emitFounderosDeepLink({ filePath: path, anchor });
	};

	const normalizeWorkspacePath = (path: string | null | undefined) => {
		if (!path) {
			return '';
		}

		if (path === '/') {
			return '/';
		}

		return path.replace(/\/+$/, '');
	};

	const getWorkspaceLeafName = (path: string | null | undefined) =>
		normalizeWorkspacePath(path).split('/').filter(Boolean).at(-1) ?? '';

	const joinWorkspacePath = (basePath: string, name: string) => {
		const normalizedBasePath = normalizeWorkspacePath(basePath);
		return normalizedBasePath === '/' ? `/${name}` : `${normalizedBasePath}/${name}`;
	};

	const getWorkspaceParentPath = (path: string) =>
		normalizeWorkspacePath(path).substring(0, normalizeWorkspacePath(path).lastIndexOf('/')) || '/';

	const getRelativeWorkspacePath = (path: string, rootPath: string) => {
		const normalizedPath = normalizeWorkspacePath(path);
		const normalizedRootPath = normalizeWorkspacePath(rootPath);

		if (!normalizedPath || !normalizedRootPath || normalizedPath === normalizedRootPath) {
			return '';
		}

		if (normalizedRootPath === '/') {
			return normalizedPath.slice(1);
		}

		return normalizedPath.startsWith(`${normalizedRootPath}/`)
			? normalizedPath.slice(normalizedRootPath.length + 1)
			: normalizedPath.replace(`${normalizedRootPath}/`, '');
	};

	const buildWorkspacePathTrail = (path: string, rootPath: string, rootLabel: string) => {
		const normalizedRootPath = normalizeWorkspacePath(rootPath);
		const trail = [
			{
				label: rootLabel || $i18n.t('Active workspace'),
				path: normalizedRootPath
			}
		];
		const relativePath = getRelativeWorkspacePath(path, rootPath);

		if (!relativePath) {
			return trail;
		}

		let currentPath = normalizedRootPath;

		for (const segment of relativePath.split('/').filter(Boolean)) {
			currentPath = joinWorkspacePath(currentPath, segment);
			trail.push({
				label: segment,
				path: currentPath
			});
		}

		return trail;
	};

	const createWorkspaceSurfaceItem = (
		filePath: string,
		size: number | null = null
	): HermesWorkspaceSurfaceItem => ({
		id: `workspace:${filePath}`,
		name: getWorkspaceLeafName(filePath) || $i18n.t('Untitled workspace file'),
		source: 'workspace',
		type: 'file',
		reference: filePath,
		url: getHermesWorkspaceFileUrl(filePath),
		size,
		content: null,
		contentType: null,
		fileId: null,
		executionName: null,
		previewable: true
	});

	const persistWorkspaceContinuityState = (patch: Partial<typeof workspaceContinuityState>) => {
		workspaceContinuityState = {
			...workspaceContinuityState,
			...patch
		};
		savedWorkspaceStateByChatKey[activeChatKey] = workspaceContinuityState;
	};

	const getWorkspaceEntryPath = (entry: HermesWorkspaceBrowseEntry) =>
		joinWorkspacePath(currentWorkspacePath, entry.name);

	const isWorkspaceEntrySelected = (entry: HermesWorkspaceBrowseEntry) =>
		selectedWorkspaceItem?.reference === getWorkspaceEntryPath(entry);

	const isWorkspaceEntryRemembered = (entry: HermesWorkspaceBrowseEntry) =>
		entry.type === 'file' &&
		!selectedWorkspaceItem &&
		workspaceContinuityState.lastFocusedReference === getWorkspaceEntryPath(entry);

	const getFileContentUrl = (item: HermesWorkspaceSurfaceItem) => {
		if (item.fileId) {
			return `${WEBUI_API_BASE_URL}/files/${item.fileId}/content`;
		}

		if (item.url) {
			if (item.url.startsWith('http') || item.url.startsWith('/api/')) {
				return item.url;
			}

			return `${WEBUI_API_BASE_URL}/files/${item.url}/content`;
		}

		return null;
	};

	const handleSwitchWorkspace = async (workspace: HermesWorkspace) => {
		if (!workspace || workspace.is_active || switchingWorkspacePath || hasActiveTasks) {
			return;
		}

		if (typeof localStorage === 'undefined' || !localStorage.token) {
			toast.error($i18n.t('Failed to switch Hermes workspace.'));
			return;
		}

		switchingWorkspacePath = workspace.path;

		try {
			const nextWorkspaces = await switchHermesWorkspace(localStorage.token, workspace.path);
			onHermesWorkspaceSwitched(nextWorkspaces);
			toast.success($i18n.t('Switched Hermes workspace.'));
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, $i18n.t('Failed to switch Hermes workspace.')));
			emitFounderosError({
				code: 'workspace.switch.failed',
				message: getErrorMessage(error, $i18n.t('Failed to switch Hermes workspace.'))
			});
		} finally {
			switchingWorkspacePath = null;
		}
	};

	const loadWorkspaceBrowse = async (path?: string | null) => {
		if (workspaceBrowseLoading) {
			return;
		}

		if (
			typeof localStorage === 'undefined' ||
			!localStorage.token ||
			!activeHermesWorkspace?.path
		) {
			workspaceBrowseLoaded = true;
			return;
		}

		workspaceBrowseLoading = true;
		workspaceBrowseError = '';

		try {
			const browseResponse = await getHermesWorkspaceBrowse(localStorage.token, path);
			workspaceBrowseEntries = browseResponse.entries ?? [];
			workspaceBrowsePath = browseResponse.current_path;
			workspaceBrowseRootPath = browseResponse.root_path;
			persistWorkspaceContinuityState({
				rootPath: browseResponse.root_path ?? activeHermesWorkspace?.path ?? null,
				browsePath: browseResponse.current_path ?? path ?? activeHermesWorkspace?.path ?? null
			});
		} catch (error) {
			console.error(error);
			workspaceBrowseEntries = [];
			workspaceBrowseError = getErrorMessage(
				error,
				$i18n.t('Failed to load Hermes workspace files.')
			);
			emitFounderosError({
				code: 'workspace.browse.failed',
				message: workspaceBrowseError
			});
		} finally {
			workspaceBrowseLoaded = true;
			workspaceBrowseLoading = false;
		}
	};

	const browseWorkspaceParent = async () => {
		if (!workspaceBrowsePath || !workspaceBrowseRootPath || !hasWorkspaceParent) {
			return;
		}

		const parentPath = getWorkspaceParentPath(workspaceBrowsePath);
		const normalizedParent =
			parentPath.length < workspaceBrowseRootPath.length ? workspaceBrowseRootPath : parentPath;

		selectedWorkspaceItem = null;
		persistWorkspaceContinuityState({
			previewReference: null
		});
		emitFounderosDeepLink({ filePath: normalizedParent, anchor: 'workspace-browser' });
		await loadWorkspaceBrowse(normalizedParent);
	};

	const browseWorkspaceTrail = async (path: string) => {
		if (!path || normalizeWorkspacePath(path) === normalizeWorkspacePath(currentWorkspacePath)) {
			return;
		}

		selectedWorkspaceItem = null;
		persistWorkspaceContinuityState({
			previewReference: null
		});
		emitFounderosDeepLink({ filePath: path, anchor: 'workspace-browser' });
		await loadWorkspaceBrowse(path);
	};

	const openWorkspaceEntry = async (entry: HermesWorkspaceBrowseEntry) => {
		const entryPath = getWorkspaceEntryPath(entry);

		if (entry.type === 'directory') {
			selectedWorkspaceItem = null;
			persistWorkspaceContinuityState({
				previewReference: null
			});
			emitFounderosDeepLink({ filePath: entryPath, anchor: 'workspace-browser' });
			await loadWorkspaceBrowse(entryPath);
			return;
		}

		selectedItemId = null;
		savedSelectionByChatKey[activeChatKey] = null;
		selectedWorkspaceItem = createWorkspaceSurfaceItem(entryPath, entry.size ?? null);
		emitWorkspaceItemOpened(selectedWorkspaceItem, 'workspace-preview');
		persistWorkspaceContinuityState({
			rootPath: workspaceBrowseRootPath || activeHermesWorkspace?.path || null,
			browsePath: currentWorkspacePath || activeHermesWorkspace?.path || null,
			previewReference: entryPath,
			lastFocusedReference: entryPath
		});
	};

	const selectItem = (item: HermesWorkspaceSurfaceItem) => {
		selectedWorkspaceItem = null;
		selectedItemId = item.id;
		savedSelectionByChatKey[activeChatKey] = item.id;
		emitWorkspaceItemOpened(item, 'workspace-preview');
		persistWorkspaceContinuityState({
			previewReference: null
		});
	};

	const closePreview = () => {
		selectedItemId = null;
		selectedWorkspaceItem = null;
		loadedItemId = null;
		savedSelectionByChatKey[activeChatKey] = null;
		persistWorkspaceContinuityState({
			previewReference: null
		});
		clearPreviewState();
	};

	const loadOfficePreview = async (name: string, arrayBuffer: ArrayBuffer) => {
		const ext = name.split('.').pop()?.toLowerCase() ?? '';

		if (ext === 'docx') {
			const [mammoth, DOMPurify] = await Promise.all([import('mammoth'), import('dompurify')]);
			const result = await mammoth.convertToHtml({ arrayBuffer });
			fileOfficeHtml = DOMPurify.default.sanitize(result.value);
			return;
		}

		if (ext === 'xlsx') {
			const XLSX = await import('xlsx');
			const { excelToTable } = await import('$lib/utils/excelToTable');
			const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
			excelWorkbook = workbook;
			excelSheetNames = workbook.SheetNames;
			if (excelSheetNames.length > 0) {
				selectedExcelSheet = excelSheetNames[0];
				const result = await excelToTable(workbook.Sheets[selectedExcelSheet]);
				fileOfficeHtml = result.html;
			}
			return;
		}

		if (ext === 'pptx') {
			const { pptxToImages } = await import('$lib/utils/pptxToHtml');
			const result = await pptxToImages(arrayBuffer);
			fileOfficeSlides = result.images;
			currentSlide = 0;
		}
	};

	const applyBlobPreview = async (
		name: string,
		blob: Blob,
		contentType?: string | null
	): Promise<void> => {
		const previewMode = getHermesWorkspacePreviewMode(name, contentType);

		if (previewMode === 'image') {
			fileImageUrl = URL.createObjectURL(blob);
			return;
		}

		if (previewMode === 'video') {
			fileVideoUrl = URL.createObjectURL(blob);
			return;
		}

		if (previewMode === 'audio') {
			fileAudioUrl = URL.createObjectURL(blob);
			return;
		}

		if (previewMode === 'pdf') {
			filePdfData = await blob.arrayBuffer();
			return;
		}

		if (previewMode === 'sqlite') {
			fileSqliteData = await blob.arrayBuffer();
			return;
		}

		if (previewMode === 'office') {
			await loadOfficePreview(name, await blob.arrayBuffer());
			return;
		}

		if (previewMode === 'text') {
			fileContent = await blob.text();
			return;
		}

		previewUnsupported = true;
	};

	const fetchRemoteBlob = async (url: string) => {
		const sameOrigin =
			typeof window !== 'undefined' &&
			new URL(url, window.location.origin).origin === window.location.origin;
		const headers =
			sameOrigin && typeof localStorage !== 'undefined' && localStorage.token
				? {
						authorization: `Bearer ${localStorage.token}`
					}
				: undefined;

		const response = await fetch(
			url,
			sameOrigin
				? {
						credentials: 'include',
						headers
					}
				: undefined
		);
		if (!response.ok) {
			throw new Error('Failed to fetch generated file');
		}

		return {
			blob: await response.blob(),
			contentType: response.headers.get('content-type') || null
		};
	};

	const loadSelectedItem = async (item: HermesWorkspaceSurfaceItem) => {
		const requestId = ++loadRequestId;
		selectedItemLoading = true;
		clearPreviewState();

		try {
			if (item.content !== null && item.content !== undefined) {
				fileContent = item.content;
				return;
			}

			if (item.source === 'chat' && item.fileId) {
				if (typeof localStorage === 'undefined' || !localStorage.token) {
					throw new Error('Missing auth token');
				}

				const file = await getFileById(localStorage.token, item.fileId);
				if (requestId !== loadRequestId) {
					return;
				}

				const contentType = file?.meta?.content_type ?? item.contentType ?? null;
				if (getHermesWorkspacePreviewMode(item.name, contentType) === 'text') {
					const inlineContent =
						typeof file?.data?.content === 'string' ? file.data.content : (item.content ?? null);
					if (inlineContent !== null) {
						fileContent = inlineContent;
						return;
					}
				}

				const arrayBuffer = await getFileContentById(item.fileId);
				if (requestId !== loadRequestId) {
					return;
				}

				if (!arrayBuffer) {
					throw new Error('No file content');
				}

				await applyBlobPreview(
					item.name,
					new Blob([arrayBuffer], {
						type: contentType || 'application/octet-stream'
					}),
					contentType
				);
				return;
			}

			if (item.url) {
				const { blob, contentType } = await fetchRemoteBlob(item.url);
				if (requestId !== loadRequestId) {
					return;
				}

				await applyBlobPreview(item.name, blob, contentType ?? item.contentType);
				return;
			}

			previewUnsupported = true;
		} catch (error) {
			console.error(error);
			if (requestId === loadRequestId) {
				previewError = getErrorMessage(
					error,
					$i18n.t('Preview is not available for this file right now.')
				);
				emitFounderosError({
					code: 'workspace.preview.failed',
					message: previewError
				});
			}
		} finally {
			if (requestId === loadRequestId) {
				selectedItemLoading = false;
			}
		}
	};

	const refreshSelectedItem = async () => {
		if (!selectedItem) {
			return;
		}

		loadedItemId = null;
		await loadSelectedItem(selectedItem);
	};

	const copySelectedReference = async () => {
		if (!selectedItem?.reference) {
			return;
		}

		const copied = await copyToClipboard(selectedItem.reference);
		toast[copied ? 'success' : 'error'](
			$i18n.t(copied ? 'Copied to clipboard' : 'Failed to copy to clipboard')
		);
	};

	const openSelectedItem = () => {
		if (!selectedItem) {
			return;
		}

		if (selectedItem.content && !getFileContentUrl(selectedItem)) {
			void copySelectedReference();
			return;
		}

		const target = getFileContentUrl(selectedItem);
		if (!target || typeof window === 'undefined') {
			return;
		}

		window.open(target, '_blank', 'noopener,noreferrer');
	};

	const getAttachPayload = async (item: HermesWorkspaceSurfaceItem) => {
		if (item.content !== null && item.content !== undefined) {
			return {
				blob: new Blob([item.content], {
					type: item.contentType || 'text/plain'
				}),
				contentType: item.contentType || 'text/plain'
			};
		}

		if (item.fileId) {
			const arrayBuffer = await getFileContentById(item.fileId);
			if (!arrayBuffer) {
				throw new Error('No file content');
			}

			return {
				blob: new Blob([arrayBuffer], {
					type: item.contentType || 'application/octet-stream'
				}),
				contentType: item.contentType || 'application/octet-stream'
			};
		}

		const target = getFileContentUrl(item);
		if (!target) {
			throw new Error('No file target');
		}

		return fetchRemoteBlob(target);
	};

	const attachSelectedItem = async () => {
		if (!selectedItem || !canAttachSelectedItem || !onAttach) {
			return;
		}

		try {
			const { blob, contentType } = await getAttachPayload(selectedItem);
			await onAttach(
				blob,
				selectedItem.name,
				contentType || blob.type || 'application/octet-stream'
			);
		} catch (error) {
			console.error(error);
			const message = getErrorMessage(error, $i18n.t('Failed to attach file'));
			toast.error(message);
			emitFounderosError({
				code: 'workspace.attach.failed',
				message
			});
		}
	};

	onDestroy(() => {
		loadRequestId += 1;
		clearPreviewState();
	});
</script>

<div class="flex h-full min-h-0 flex-col px-2 py-2">
	{#if availableHermesWorkspaces.length > 1}
		<div
			class="mx-2 mb-2 rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2.5"
		>
			<div
				class="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400"
			>
				{$i18n.t('Workspaces')}
			</div>
			<div class="mt-1 text-[11px] leading-5 text-slate-400">
				{$i18n.t('Switch the active Hermes workspace without leaving the current chat shell.')}
			</div>

			<div class="mt-2 flex flex-col gap-1.5">
				{#each availableHermesWorkspaces as workspace}
					<button
						type="button"
						class="w-full rounded-lg border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 {workspace.is_active
							? 'border-white/12 bg-white/10'
							: 'border-white/8 bg-white/5 hover:bg-white/8'}"
						disabled={switchingWorkspacePath !== null || hasActiveTasks || workspace.is_active}
						on:click={() => handleSwitchWorkspace(workspace)}
					>
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<div class="line-clamp-1 text-xs font-medium text-slate-200">
									{workspace.name}
								</div>
								<div class="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
									{workspace.path}
								</div>
							</div>

							<div class="flex shrink-0 flex-wrap justify-end gap-1">
								{#if switchingWorkspacePath === workspace.path}
									<div
										class="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] font-medium text-slate-300"
									>
										{$i18n.t('Switching')}...
									</div>
								{:else if workspace.path === activeHermesWorkspace?.path}
									<div
										class="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] font-medium text-slate-300"
									>
										{$i18n.t('Active workspace')}
									</div>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>

			{#if hasActiveTasks}
				<div class="mt-2 text-[11px] text-slate-400">
					{$i18n.t('Cannot switch workspaces while a task is running.')}
				</div>
			{/if}
		</div>
	{/if}

	{#if !canBrowseWorkspace && workspaceItems.length === 0 && workspaceBrowserEntries.length === 0 && !workspaceBrowseLoading && !workspaceBrowseError && workspaceBrowseLoaded}
		<div
			class="mx-2 flex flex-1 min-h-0 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center"
		>
			<div>
				<div class="text-sm font-medium text-slate-200">
					{$i18n.t('No workspace files for this chat yet.')}
				</div>
				<div class="mt-1 text-xs leading-5 text-slate-400">
					{$i18n.t(
						'Hermes-generated outputs and current chat attachments will appear here as the session progresses.'
					)}
				</div>
			</div>
		</div>
	{:else if selectedItem}
		<div
			class="mx-2 rounded-xl border border-white/8 bg-slate-900/80"
		>
			<div class="flex flex-wrap gap-1.5 border-b border-white/8 px-3 py-2">
				<button
					class="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/12"
					on:click={closePreview}
				>
					{$i18n.t('Back to list')}
				</button>
				<button
					class="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
					on:click={openSelectedItem}
					disabled={!canOpenSelectedItem}
				>
					{$i18n.t('Open')}
				</button>
				<button
					class="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
					on:click={attachSelectedItem}
					disabled={!canAttachSelectedItem}
				>
					{$i18n.t('Attach to chat')}
				</button>
				<button
					class="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
					on:click={copySelectedReference}
					disabled={!selectedItem.reference}
				>
					{$i18n.t('Copy path')}
				</button>
				<button
					class="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/12"
					on:click={refreshSelectedItem}
				>
					{$i18n.t('Refresh')}
				</button>
			</div>

			<div class="border-b border-white/8 px-3 py-2">
				<div class="line-clamp-1 text-sm font-medium text-slate-100">
					{selectedItem.name}
				</div>
				{#if selectedItem.reference}
					<div class="mt-1 line-clamp-1 text-[11px] text-slate-400">
						{$i18n.t('Path: {{PATH}}', { PATH: selectedItem.reference })}
					</div>
				{/if}

				{#if selectedItemMetaItems.length > 0}
					<div class="mt-1 flex flex-wrap gap-1.5">
						{#each selectedItemMetaItems as metaItem}
							<div
								class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
							>
								<span class="block max-w-full truncate">{metaItem}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex min-h-[18rem] flex-1 overflow-hidden">
				{#if selectedItemLoading}
					<div class="flex h-full w-full items-center justify-center">
						<Spinner className="size-4" />
					</div>
				{:else if previewError || previewUnsupported}
					<div class="w-full p-3">
						<HermesWorkspaceGuideRow
							title={selectedItem.name}
							description={previewError ||
								$i18n.t('Preview is not available for this file type yet.')}
							metaItems={selectedItemMetaItems}
						/>
					</div>
				{:else}
					<FilePreview
						bind:currentSlide
						selectedFile={selectedItem.name}
						fileLoading={selectedItemLoading}
						{fileContent}
						{fileImageUrl}
						{fileVideoUrl}
						{fileAudioUrl}
						{filePdfData}
						{fileSqliteData}
						{fileOfficeHtml}
						{fileOfficeSlides}
						{excelSheetNames}
						{selectedExcelSheet}
						onSheetChange={async (sheet) => {
							if (!excelWorkbook) {
								return;
							}

							selectedExcelSheet = sheet;
							const { excelToTable } = await import('$lib/utils/excelToTable');
							const result = await excelToTable(excelWorkbook.Sheets[sheet]);
							fileOfficeHtml = result.html;
						}}
					/>
				{/if}
			</div>
		</div>
	{:else}
		<div class="flex flex-1 min-h-0 flex-col overflow-hidden">
			<div class="flex-1 min-h-0 overflow-y-auto px-2">
				{#if canBrowseWorkspace}
					<div class="pb-3">
						<div class="flex items-start justify-between gap-2 px-1">
							<div class="min-w-0">
								<div
									class="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400"
								>
									{$i18n.t('Active workspace folder')}
								</div>
								<div class="mt-1 flex flex-wrap gap-1.5">
									{#each workspaceBrowserMeta as metaItem}
										<div
											class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
										>
											<span class="block max-w-full truncate">{metaItem}</span>
										</div>
									{/each}
								</div>
							</div>

							{#if hasWorkspaceParent}
								<button
									class="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/12"
									on:click={browseWorkspaceParent}
								>
									{$i18n.t('Back')}
								</button>
							{/if}
						</div>

						{#if workspacePathTrail.length > 0}
							<div class="mt-2 overflow-x-auto px-1">
								<div
									class="flex min-w-max items-center gap-1 text-[11px] text-slate-400"
								>
									<div class="shrink-0 font-medium text-slate-500">
										{$i18n.t('Current path')}
									</div>
									{#each workspacePathTrail as segment, index}
										<div class="shrink-0 text-slate-600">/</div>
										<button
											class="shrink-0 rounded-full px-2 py-0.5 transition {index ===
											workspacePathTrail.length - 1
												? 'border border-white/10 bg-white/8 text-slate-300'
												: 'bg-transparent text-slate-400 hover:bg-white/8 hover:text-slate-200'}"
											disabled={index === workspacePathTrail.length - 1}
											on:click={() => browseWorkspaceTrail(segment.path)}
										>
											{segment.label}
										</button>
									{/each}
								</div>
							</div>
						{/if}

						{#if !workspaceBrowseLoaded || workspaceBrowseLoading}
							<div class="mt-2 flex justify-center py-4">
								<Spinner className="size-4" />
							</div>
						{:else if workspaceBrowseError}
							<div class="mt-2 px-1 text-xs text-slate-400">
								{workspaceBrowseError}
							</div>
						{:else if workspaceBrowserEntries.length === 0}
							<div
								class="mt-2 rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-4 text-center text-xs text-slate-400"
							>
								{$i18n.t('This workspace folder is empty.')}
							</div>
						{:else}
							<div class="mt-2 flex flex-col gap-1.5">
								{#each workspaceBrowserEntries as entry}
									<button
										class="w-full rounded-xl border px-3 py-2 text-left transition {isWorkspaceEntrySelected(
											entry
										)
											? 'border-white/12 bg-white/10'
											: isWorkspaceEntryRemembered(entry)
												? 'border-white/10 bg-white/8'
												: 'border-white/8 bg-white/5 hover:border-white/12 hover:bg-white/8'}"
										on:click={() => openWorkspaceEntry(entry)}
									>
										<div class="flex items-start gap-3">
											<div class="pt-0.5 text-slate-500">
												{#if entry.type === 'directory'}
													<Folder className="size-4" />
												{:else}
													<Document className="size-4" />
												{/if}
											</div>

											<div class="min-w-0 flex-1">
												<div
													class="line-clamp-1 text-sm font-medium text-slate-100"
												>
													{entry.name}
												</div>
												<div
													class="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400"
												>
													<div>
														{$i18n.t(entry.type === 'directory' ? 'Folder' : 'Workspace file')}
													</div>
													{#if entry.size}
														<div>{formatFileSize(entry.size)}</div>
													{/if}
													{#if isWorkspaceEntrySelected(entry)}
														<div>{$i18n.t('Current')}</div>
													{:else if isWorkspaceEntryRemembered(entry)}
														<div>{$i18n.t('Previewing selected file')}</div>
													{/if}
												</div>
											</div>
										</div>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				{#if !canBrowseWorkspace || workspaceItems.length > 0}
					<div class="pb-3">
						<HermesWorkspaceGuideRow
							title={$i18n.t('Chat-linked files')}
							description={$i18n.t(
								'Files already attached to this chat and Hermes-generated outputs appear here.'
							)}
							metaItems={workspaceGuideMeta}
						>
							<svelte:fragment slot="actions">
								{#if generatedWorkspaceItems.length > 0}
									<button
										class="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/12"
										on:click={() => selectItem(generatedWorkspaceItems[0])}
									>
										{$i18n.t('Open latest output')}
									</button>
								{/if}
							</svelte:fragment>
						</HermesWorkspaceGuideRow>
					</div>
				{/if}

				{#if generatedWorkspaceItems.length > 0}
					<div class="pb-3">
						<div
							class="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400"
						>
							{$i18n.t('Generated files')}
						</div>
						<div class="mt-2 flex flex-col gap-1.5">
							{#each generatedWorkspaceItems as item}
								<button
									class="w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-left transition hover:border-white/12 hover:bg-white/8"
									on:click={() => selectItem(item)}
								>
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0">
											<div
												class="line-clamp-1 text-sm font-medium text-slate-100"
											>
												{item.name}
											</div>
											<div
												class="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400"
											>
												<div>{$i18n.t('Generated file')}</div>
												{#if item.executionName}
													<div>{item.executionName}</div>
												{/if}
											</div>
										</div>
										<div
											class="shrink-0 rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
										>
											{$i18n.t('Generated')}
										</div>
									</div>
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if chatWorkspaceItems.length > 0}
					<div class="pb-2">
						<div
							class="px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400"
						>
							{$i18n.t('Current chat files')}
						</div>
						<div class="mt-2 flex flex-col gap-1.5">
							{#each chatWorkspaceItems as item}
								<button
									class="w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-left transition hover:border-white/12 hover:bg-white/8"
									on:click={() => selectItem(item)}
								>
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0">
											<div
												class="line-clamp-1 text-sm font-medium text-slate-100"
											>
												{item.name}
											</div>
											<div
												class="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400"
											>
												<div>
													{item.type === 'file'
														? $i18n.t('Current chat file')
														: $i18n.t('Current chat attachment')}
												</div>
												{#if item.type !== 'file'}
													<div>{$i18n.t('Type: {{TYPE}}', { TYPE: item.type })}</div>
												{/if}
												{#if item.size}
													<div>{formatFileSize(item.size)}</div>
												{/if}
											</div>
										</div>
										<div
											class="shrink-0 rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
										>
											{$i18n.t('Attached')}
										</div>
									</div>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
