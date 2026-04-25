<script lang="ts">
	import '../../app.css';
	import { toast } from 'svelte-sonner';
	import { onDestroy, onMount, tick, getContext } from 'svelte';
	import { get } from 'svelte/store';
	import { openDB, deleteDB, type IDBPDatabase } from 'idb';
	import fileSaver from 'file-saver';
	import type { Writable } from 'svelte/store';
	import type { i18n as I18nType } from 'i18next';

	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';

	import { getModels, getToolServersData, getVersionUpdates } from '$lib/apis';
	import { getTools } from '$lib/apis/tools';
	import { getBanners } from '$lib/apis/configs';
	import { getTerminalServers } from '$lib/apis/terminal';
	import { getUserSettings } from '$lib/apis/users';

		import { WEBUI_VERSION, WEBUI_API_BASE_URL } from '$lib/constants';
		import {
			clearFounderosEmbeddedCredentials,
			persistFounderosEmbeddedCredentials,
			resolveFounderosEmbeddedAccessToken
		} from '$lib/founderos/credentials';
			import {
				fetchFounderosLaunchBootstrap,
				exchangeFounderosLaunchSession,
			type FounderosLaunchBootstrapPayload
		} from '$lib/founderos/bootstrap';
	import { founderosLaunchContext } from '$lib/founderos';
	import { verifyFounderosLaunchIntegrity } from '$lib/founderos/launch';
	import { buildFounderosShellHref } from '$lib/founderos/navigation';
	import { resolveFounderosShellOrigin } from '$lib/founderos/shell-origin';
	import { resolveFounderosShellReturnPath } from '$lib/founderos/shell-return';
	import { mergeEnabledTerminalServerData } from '$lib/founderos/terminal-servers';
	import type { SessionWorkspaceHostContext } from '$lib/founderos/types';
	import { registerWorkspaceKeyboardShortcuts } from '$lib/composables/workspace-keyboard-shortcuts';
	import {
		applyFounderosHostContextPatch,
		createFounderosHostActionRelay,
		createFounderosWorkspaceRelay,
		emitWorkspaceApprovalRequested,
		emitWorkspaceDeepLink,
		emitWorkspaceError,
		emitWorkspaceFileOpened,
		emitWorkspaceProducerBatch,
		emitWorkspaceSessionUpdated,
		emitWorkspaceToolCompleted,
		emitWorkspaceToolStarted,
		founderosHostContext,
		initFounderosBridge,
		seedFounderosHostContext,
		syncFounderosLaunchContext,
		teardownFounderosBridge
	} from '$lib/founderos/bridge';
	import type { I18nStore } from '$lib/i18n';
	import { compareVersion } from '$lib/utils';

	import {
		config,
		user,
		settings,
		models,
		knowledge,
		tools,
		functions,
		tags,
		banners,
		showSettings,
		showShortcuts,
		showChangelog,
		temporaryChatEnabled,
		toolServers,
		terminalServers,
		selectedTerminalId,
		showSearch,
		showSidebar,
		showControls,
		mobile
	} from '$lib/stores';

	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import EmbeddedMetaStrip from '$lib/components/founderos/EmbeddedMetaStrip.svelte';
	import SettingsModal from '$lib/components/chat/SettingsModal.svelte';
	import ChangelogModal from '$lib/components/ChangelogModal.svelte';
	import AccountPending from '$lib/components/layout/Overlay/AccountPending.svelte';
	import UpdateInfoToast from '$lib/components/layout/UpdateInfoToast.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';

	const i18n = getContext<I18nStore>('i18n') as Writable<I18nType>;
	const HERMES_ONLY_CHAT = true;
	const { saveAs } = fileSaver;

	const applyFounderosLaunchBootstrap = async (
		payload: FounderosLaunchBootstrapPayload,
		sessionUser: FounderosLaunchBootstrapPayload['user'] | null = null,
		options: {
			finalize?: boolean;
		} = {}
	) => {
		const { finalize = true } = options;
		seedFounderosHostContext(payload.hostContext);
		user.set({
			...(sessionUser ?? payload.user)
		});

		settings.set({
			...payload.ui.settings
		});

		models.set(payload.ui.models);
		toolServers.set(payload.ui.toolServers);
		terminalServers.set(payload.ui.terminalServers);
		banners.set(payload.ui.banners);
		tools.set(payload.ui.tools);
		showSidebar.set(payload.ui.showSidebar);
		showControls.set(payload.ui.showControls);
		selectedTerminalId.set(payload.ui.selectedTerminalId);
		temporaryChatEnabled.set(payload.ui.temporaryChatEnabled);

		if (finalize) {
			loaded = true;
		}

		await tick();

		if (finalize) {
			emitWorkspaceSessionUpdated({
				title: document?.title ?? 'Infinity workspace',
				status: 'planning'
			});
		}
	};

		const clearFounderosLaunchToken = () => {
			clearFounderosEmbeddedCredentials();
		};

	const hydrateFounderosLaunchAuth = async (payload: FounderosLaunchBootstrapPayload) => {
		if (payload.auth.mode !== 'session_exchange') {
			return {
				valid: true,
				sessionUser: null as FounderosLaunchBootstrapPayload['user'] | null,
				shellIssuedSession: false
			};
		}

		const exchange = await exchangeFounderosLaunchSession($founderosLaunchContext, payload.auth);

		if (!exchange.accepted || (!exchange.token && !exchange.cookieBound)) {
			clearFounderosLaunchToken();
			return {
				valid: false,
				message: exchange.note || 'FounderOS embedded session exchange failed.',
				shellIssuedSession: false
			};
		}

			persistFounderosEmbeddedCredentials({
				token: exchange.token,
				sessionGrant: exchange.sessionGrant,
				storageMode:
					exchange.storageMode === 'http_only_cookie'
						? 'http_only_cookie'
						: 'local_dev_session_storage'
			});

			if (!exchange.user) {
				clearFounderosLaunchToken();
				return {
					valid: false,
					message: 'FounderOS embedded session token is invalid.',
					shellIssuedSession: false
				};
			}

			return {
				valid: true,
				sessionUser: exchange.user,
				shellIssuedSession: true
			};
		};

	let founderosBridgeCleanup: () => void = () => {};
	let founderosEventCleanup: () => void = () => {};
	let founderosHostActionCleanup: () => void = () => {};
	let keyboardShortcutCleanup: () => void = () => {};
	let founderosBridgeSignature = '';
	let embeddedMode = false;
	let loaded = false;
	let DB: IDBPDatabase<any> | null = null;
	let localDBChats: Record<string, unknown>[] = [];

	let version: { current: string; latest: string } | null = null;
	let founderosLaunchIntegrityState:
		| 'idle'
		| 'not_applicable'
		| 'valid'
		| 'missing'
		| 'invalid'
		| 'expired' = 'idle';
		let founderosLaunchIntegrityMessage: string | null = null;
			let founderosLaunchBootstrapState: 'idle' | 'hydrating' | 'ready' | 'failed' = 'idle';
			let founderosLaunchBootstrapMessage: string | null = null;
			let founderosLaunchShellSessionMode = false;

	const clearChatInputStorage = () => {
		const chatInputKeys = Object.keys(localStorage).filter((key) => key.startsWith('chat-input'));
		if (chatInputKeys.length > 0) {
			chatInputKeys.forEach((key) => {
				localStorage.removeItem(key);
			});
		}
	};

	const getWorkspaceAuthToken = () =>
		resolveFounderosEmbeddedAccessToken({
			allowLegacyToken:
				!$founderosLaunchContext.enabled || !founderosLaunchShellSessionMode
		});

	const checkLocalDBChats = async () => {
		try {
			// Check if IndexedDB exists
			DB = await openDB('Chats', 1);

			if (!DB) {
				return;
			}

			const chats = await DB.getAllFromIndex('chats', 'timestamp');
			localDBChats = chats.map((item, idx) => chats[chats.length - 1 - idx]);

			if (localDBChats.length === 0) {
				await deleteDB('Chats');
			}
		} catch (error) {
			// IndexedDB Not Found
		}
	};

	const setUserSettings = async (cb: () => Promise<void>) => {
		let userSettings = await getUserSettings(getWorkspaceAuthToken()).catch((error) => {
			console.error(error);
			return null;
		});

		if (!userSettings) {
			try {
				userSettings = JSON.parse(localStorage.getItem('settings') ?? '{}');
			} catch (e: unknown) {
				console.error('Failed to parse settings from localStorage', e);
				userSettings = {};
			}
		}

		if (userSettings?.ui) {
			settings.set(userSettings.ui);
		}

		if (cb) {
			await cb();
		}
	};

	const setModels = async () => {
		models.set(
			await getModels(
				getWorkspaceAuthToken(),
				$config?.features?.enable_direct_connections ? ($settings?.directConnections ?? null) : null
			)
		);
	};

	const setToolServers = async () => {
		let toolServersData = await getToolServersData($settings?.toolServers ?? []);
		const availableToolServers = toolServersData.filter(
			(data): data is Record<string, any> & { error?: unknown } => {
			if (!data || data.error) {
				toast.error(
					$i18n.t(`Failed to connect to {{URL}} OpenAPI tool server`, {
						URL: data?.url
					})
				);
				return false;
			}
			return true;
		}
		);
		toolServers.set(availableToolServers);

		// Inject enabled terminal servers as always-on tool servers
		const enabledTerminals = ($settings?.terminalServers ?? []).filter((s) => s.enabled);
		if (enabledTerminals.length > 0) {
			let terminalServersData = await getToolServersData(
				enabledTerminals.map((t) => ({
					url: t.url,
					auth_type: t.auth_type ?? 'bearer',
					key: t.key ?? '',
					path: t.path ?? '/openapi.json',
					config: { enable: true }
				}))
			);
			const availableTerminalServers = mergeEnabledTerminalServerData(
				enabledTerminals,
				terminalServersData
			);
			enabledTerminals.forEach((terminal, index) => {
				const data = terminalServersData[index];
				if (!data || data.error) {
					toast.error(
						$i18n.t(`Failed to connect to {{URL}} terminal server`, {
							URL: terminal.url
						})
					);
				}
			});

			terminalServers.set(availableTerminalServers);
		} else {
			terminalServers.set([]);
		}

		// Fetch terminal servers the user has access to (for FileNav + terminal_id)
		const authToken = getWorkspaceAuthToken();
		const systemTerminals = await getTerminalServers(authToken);
		if (systemTerminals.length > 0) {
			// Store with proxy URL and session key for FileNav file browsing
			const terminalEntries = systemTerminals.map((t) => ({
				id: t.id,
				url: `${WEBUI_API_BASE_URL}/terminals/${t.id}`,
				name: t.name,
				key: authToken
			}));
			terminalServers.update((existing) => [...existing, ...terminalEntries]);
		}
	};

	const setBanners = async () => {
		const bannersData = await getBanners(getWorkspaceAuthToken());
		banners.set(bannersData);
	};

	const setTools = async () => {
		const toolsData = await getTools(getWorkspaceAuthToken());
		tools.set(toolsData);
	};

	onMount(async () => {
		founderosEventCleanup = registerFounderosEventBridge();
		founderosHostActionCleanup = registerFounderosHostActionBridge();

		if ($founderosLaunchContext.enabled) {
			try {
				clearChatInputStorage();
				const verification = await verifyFounderosLaunchIntegrity($founderosLaunchContext);
				founderosLaunchIntegrityState = verification.state;
				founderosLaunchIntegrityMessage = verification.valid ? null : verification.note;

				if (!verification.valid) {
					founderosLaunchBootstrapState = 'idle';
					founderosLaunchBootstrapMessage = verification.note;
					loaded = true;
					if (!$founderosLaunchContext.embedded && ($user === undefined || $user === null)) {
						await goto('/auth');
					}
					return;
				}

				founderosLaunchBootstrapState = 'hydrating';
				const bootstrap = await fetchFounderosLaunchBootstrap($founderosLaunchContext);
				if (!bootstrap.accepted || !bootstrap.payload) {
					founderosLaunchBootstrapState = 'failed';
					founderosLaunchBootstrapMessage = bootstrap.note;
					loaded = true;
					if (!$founderosLaunchContext.embedded) {
						await goto('/auth');
					}
					return;
				}

				const authValidation = await hydrateFounderosLaunchAuth(bootstrap.payload);
				if (!authValidation.valid) {
					founderosLaunchBootstrapState = 'failed';
					founderosLaunchBootstrapMessage =
						authValidation.message ?? 'FounderOS embedded auth validation failed.';
					clearFounderosLaunchToken();
					user.set(undefined);
					loaded = true;
					if (!$founderosLaunchContext.embedded) {
						await goto('/auth');
					}
					return;
				}

				founderosLaunchBootstrapState = 'ready';
				founderosLaunchBootstrapMessage = null;
				founderosLaunchShellSessionMode = authValidation.shellIssuedSession ?? false;
				await applyFounderosLaunchBootstrap(bootstrap.payload, authValidation.sessionUser, {
					finalize: true
				});
				return;
			} catch (error) {
				console.error('FounderOS embedded launch failed', error);
				founderosLaunchBootstrapState = 'failed';
				founderosLaunchBootstrapMessage =
					error instanceof Error && error.message
						? error.message
						: 'FounderOS embedded launch failed unexpectedly.';
				loaded = true;
				emitWorkspaceError({
					code: 'founderos_launch_failure',
					message: founderosLaunchBootstrapMessage
				});
				if (!$founderosLaunchContext.embedded) {
					await goto('/auth');
				}
				return;
			}
		}

		if ($user === undefined || $user === null) {
			await goto('/auth');
			return;
		}
		if (!['user', 'admin'].includes($user?.role)) {
			return;
		}

		clearChatInputStorage();
		await Promise.all([
			checkLocalDBChats(),
			setBanners().catch((e) => console.error('Failed to load banners:', e)),
			setTools().catch((e) => console.error('Failed to load tools:', e)),
			setUserSettings(async () => {
				await Promise.all([
					setModels().catch((e) => console.error('Failed to load models:', e)),
					setToolServers().catch((e) => console.error('Failed to load tool servers:', e))
				]);
			}).catch((e) => console.error('Failed to load user settings:', e))
		]);

		keyboardShortcutCleanup = registerWorkspaceKeyboardShortcuts({
			document,
			getLaunchContext: () => get(founderosLaunchContext),
			navigate: goto,
			hermesOnlyChat: HERMES_ONLY_CHAT
		});

		if ($user?.role === 'admin' && ($settings?.showChangelog ?? true)) {
			showChangelog.set(($settings?.version ?? null) !== ($config?.version ?? null));
		}

		if (HERMES_ONLY_CHAT) {
			temporaryChatEnabled.set(false);
		} else if ($user?.role === 'admin' || ($user?.permissions?.chat?.temporary ?? true)) {
			if ($page.url.searchParams.get('temporary-chat') === 'true') {
				temporaryChatEnabled.set(true);
			}

			if ($user?.role !== 'admin' && $user?.permissions?.chat?.temporary_enforced) {
				temporaryChatEnabled.set(true);
			}
		}

		// Check for version updates
		if ($user?.role === 'admin' && $config?.features?.enable_version_update_check) {
			// Check if the user has dismissed the update toast in the last 24 hours
			if (localStorage.dismissedUpdateToast) {
				const dismissedUpdateToast = new Date(Number(localStorage.dismissedUpdateToast));
				const now = new Date();

				if (now.getTime() - dismissedUpdateToast.getTime() > 24 * 60 * 60 * 1000) {
					checkForVersionUpdates();
				}
			} else {
				checkForVersionUpdates();
			}
		}
		// Persist showControls: track open/close state separately from saved size
		// chatControlsSize always retains the last width for openPane()
		await showControls.set(!$mobile ? localStorage.showControls === 'true' : false);
		showControls.subscribe((value) => {
			localStorage.showControls = value ? 'true' : 'false';
		});

		// Persist selectedTerminalId across page loads
		selectedTerminalId.set(localStorage.selectedTerminalId ?? null);
		selectedTerminalId.subscribe((value) => {
			if (value === null) {
				delete localStorage.selectedTerminalId;
			} else {
				localStorage.selectedTerminalId = value;
			}
		});

		await tick();

		loaded = true;
		emitWorkspaceSessionUpdated({
			title: document?.title ?? undefined
		});
	});

	onDestroy(() => {
		founderosBridgeCleanup();
		founderosEventCleanup();
		founderosHostActionCleanup();
		keyboardShortcutCleanup();
		teardownFounderosBridge();
	});

	$: embeddedMode = $founderosLaunchContext.embedded;
	$: shellOrigin = resolveFounderosShellOrigin(
		$founderosLaunchContext,
		browser ? window.location.origin : null
	);
	$: shellReturnHref = buildFounderosShellHref(
		resolveFounderosShellReturnPath($founderosHostContext ?? null),
		$founderosLaunchContext,
		shellOrigin
	);
	$: syncFounderosLaunchContext($founderosLaunchContext);
		$: if (browser) {
			const launchIntegrityReady =
				!$founderosLaunchContext.enabled || founderosLaunchIntegrityState === 'valid';
			const launchBootstrapReady =
				!$founderosLaunchContext.enabled || founderosLaunchBootstrapState === 'ready';
			const nextBridgeSignature = [
				$founderosLaunchContext.enabled ? '1' : '0',
				$founderosLaunchContext.embedded ? '1' : '0',
				$founderosLaunchContext.hostOrigin ?? '',
				launchIntegrityReady ? '1' : '0',
				launchBootstrapReady ? '1' : '0'
			].join(':');

			if (nextBridgeSignature !== founderosBridgeSignature) {
				founderosBridgeCleanup();
				teardownFounderosBridge();
				founderosBridgeCleanup = launchIntegrityReady && launchBootstrapReady
					? initFounderosBridge($founderosLaunchContext)
					: () => {};
				founderosBridgeSignature = nextBridgeSignature;
			}
		}
	$: if (loaded && $page?.url?.pathname) {
		emitWorkspaceSessionUpdated({
			title: document?.title ?? undefined
		});
	}

	const checkForVersionUpdates = async () => {
		version = await getVersionUpdates(getWorkspaceAuthToken()).catch((error) => {
			return {
				current: WEBUI_VERSION,
				latest: WEBUI_VERSION
			};
		});
	};

	const registerFounderosEventBridge = (): (() => void) =>
		createFounderosWorkspaceRelay({
			onToolStarted: emitWorkspaceToolStarted,
			onToolCompleted: emitWorkspaceToolCompleted,
			onApprovalRequested: emitWorkspaceApprovalRequested,
			onFileOpened: emitWorkspaceFileOpened,
			onError: emitWorkspaceError,
			onDeepLink: emitWorkspaceDeepLink,
			onProducerBatch: emitWorkspaceProducerBatch
		});

	const registerFounderosHostActionBridge = (): (() => void) =>
			createFounderosHostActionRelay({
				onAccountSwitch: ({ accountId }) => {
					const current = get(founderosHostContext);
					if (current?.accountId !== accountId || current?.accountLabel) {
						applyFounderosHostContextPatch({
							accountId,
							accountLabel: null
						});
					}
				},
				onSessionRetry: () => undefined,
				onSessionFocus: () => undefined
			});
</script>

<SettingsModal bind:show={$showSettings} />
{#if !embeddedMode}
	<ChangelogModal bind:show={$showChangelog} />
{/if}

{#if !embeddedMode && version && compareVersion(version.latest, version.current) && ($settings?.showUpdateToast ?? true)}
	<div class=" absolute bottom-8 right-8 z-50" in:fade={{ duration: 100 }}>
		<UpdateInfoToast
			{version}
			on:close={() => {
				localStorage.setItem('dismissedUpdateToast', Date.now().toString());
				version = null;
			}}
		/>
	</div>
{/if}

	{#if $founderosLaunchContext.enabled && loaded && (founderosLaunchIntegrityState !== 'valid' || founderosLaunchBootstrapState === 'failed')}
		<div class="app relative">
		<div
			class="bg-[#08101f] text-slate-100 h-screen max-h-[100dvh] flex items-center justify-center px-6"
			data-founderos-launch={$founderosLaunchContext.enabled ? '1' : '0'}
			data-founderos-embedded={embeddedMode ? '1' : '0'}
		>
			<div class="max-w-lg rounded-3xl border border-white/8 bg-slate-900/80 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
				<div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
					FounderOS Launch
				</div>
				<h1 class="mt-3 text-2xl font-semibold tracking-tight text-slate-50">
					Workspace launch could not be verified
				</h1>
					<p class="mt-3 text-sm leading-6 text-slate-300">
						{founderosLaunchBootstrapMessage ??
							founderosLaunchIntegrityMessage ??
							'The shell-issued session token is missing, invalid, or expired.'}
					</p>
					<div class="mt-5 grid gap-3 text-xs text-slate-400">
					<div>
						<span class="font-medium text-slate-200">session</span>:
						{$founderosLaunchContext.sessionId ?? 'n/a'}
					</div>
						<div>
							<span class="font-medium text-slate-200">state</span>:
							{founderosLaunchIntegrityState}
						</div>
						<div>
							<span class="font-medium text-slate-200">bootstrap</span>:
							{founderosLaunchBootstrapState}
						</div>
					</div>
				</div>
			</div>
	</div>
{:else if $user}
	<div class="app relative">
		<div
			class=" text-slate-100 bg-[#08101f] h-screen max-h-[100dvh] overflow-auto flex flex-row justify-end"
			data-founderos-launch={$founderosLaunchContext.enabled ? '1' : '0'}
			data-founderos-embedded={embeddedMode ? '1' : '0'}
		>
			{#if !['user', 'admin'].includes($user?.role)}
				<AccountPending />
			{:else}
				{#if !embeddedMode && localDBChats.length > 0}
					<div class="fixed w-full h-full flex z-50">
						<div
							class="absolute w-full h-full backdrop-blur-md bg-slate-950/60 flex justify-center"
						>
							<div class="m-auto pb-44 flex flex-col justify-center">
								<div class="max-w-md">
									<div class="text-center text-white text-2xl font-medium z-50">
										{$i18n.t('Important Update')}<br />
										{$i18n.t('Action Required for Chat Log Storage')}
									</div>

									<div class=" mt-4 text-center text-sm text-slate-200 w-full">
										{$i18n.t(
											"Saving chat logs directly to your browser's storage is no longer supported. Please take a moment to download and delete your chat logs by clicking the button below. Don't worry, you can easily re-import your chat logs to the backend through"
										)}
										<span class="font-medium text-white"
											>{$i18n.t('Settings')} > {$i18n.t('Chats')} > {$i18n.t('Import Chats')}</span
										>. {$i18n.t(
											'This ensures that your valuable conversations are securely saved to your backend database. Thank you!'
										)}
									</div>

									<div class=" mt-6 mx-auto relative group w-fit">
										<button
											class="relative z-20 flex px-5 py-2 rounded-full border border-sky-500/20 bg-sky-500/15 hover:bg-sky-500/20 transition font-medium text-sm text-sky-100"
											on:click={async () => {
												if (!DB) {
													return;
												}

												let blob = new Blob([JSON.stringify(localDBChats)], {
													type: 'application/json'
												});
												saveAs(blob, `chat-export-${Date.now()}.json`);

												const tx = DB.transaction('chats', 'readwrite');
												await Promise.all([tx.store.clear(), tx.done]);
												await deleteDB('Chats');

												localDBChats = [];
											}}
										>
											{$i18n.t('Download & Delete')}
										</button>

										<button
											class="text-xs text-center w-full mt-2 text-slate-400 underline"
											on:click={async () => {
												localDBChats = [];
											}}>{$i18n.t('Close')}</button
										>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}

				{#if !embeddedMode}
					<Sidebar />
				{/if}

				{#if loaded}
					<div class="w-full min-h-0 flex-1 flex flex-col">
						{#if embeddedMode}
							<EmbeddedMetaStrip
								projectName={$founderosHostContext?.projectName ?? null}
								sessionId={$founderosHostContext?.sessionId ?? $founderosLaunchContext.sessionId}
								accountLabel={$founderosHostContext?.accountLabel ?? null}
								accountId={$founderosHostContext?.accountId ?? null}
								executionMode={$founderosHostContext?.executionMode ?? 'unknown'}
								quotaState={$founderosHostContext?.quotaState ?? null}
								pendingApprovals={$founderosHostContext?.pendingApprovals ?? null}
								openedFrom={$founderosHostContext?.openedFrom ?? 'unknown'}
								shellReturnHref={shellReturnHref}
							/>
						{/if}
						<div class="min-h-0 flex-1 flex flex-col">
							<slot />
						</div>
					</div>
				{:else}
					<div
						class="w-full flex-1 h-full flex items-center justify-center {!embeddedMode && $showSidebar
							? '  md:max-w-[calc(100%-var(--sidebar-width))]'
							: ' '}"
					>
						<Spinner className="size-5" />
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}
