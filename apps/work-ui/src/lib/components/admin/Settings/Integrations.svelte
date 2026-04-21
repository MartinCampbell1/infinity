<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { onMount, getContext } from 'svelte';
	import { v4 as uuidv4 } from 'uuid';

	const i18n = getContext('i18n');

	import { terminalServers } from '$lib/stores';
	import { getTerminalServers } from '$lib/apis/terminal';
	import { WEBUI_API_BASE_URL } from '$lib/constants';

	import Switch from '$lib/components/common/Switch.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Cog6 from '$lib/components/icons/Cog6.svelte';
	import Cloud from '$lib/components/icons/Cloud.svelte';
	import Connection from '$lib/components/chat/Settings/Tools/Connection.svelte';

	import AddToolServerModal from '$lib/components/AddToolServerModal.svelte';
	import AddTerminalServerModal from '$lib/components/AddTerminalServerModal.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';

	import {
		getToolServerConnections,
		setToolServerConnections,
		getTerminalServerConnections,
		setTerminalServerConnections
	} from '$lib/apis/configs';

	type ToolServerAccessGrant = {
		id?: string;
		principal_type: 'user' | 'group';
		principal_id: string;
		permission: 'read' | 'write';
	};

	type ToolServerConnectionConfig = {
		enable?: boolean;
		function_name_filter_list?: string;
		access_grants?: ToolServerAccessGrant[];
	};

	type ToolServerConnectionInfo = {
		id?: string;
		name?: string;
		description?: string;
		oauth_client_info?: Record<string, unknown> | null;
		oauth_client_id?: string;
		oauth_client_secret?: string;
	};

	type ToolServerConnection = {
		type?: 'openapi' | 'mcp';
		url: string;
		spec_type?: 'url' | 'json';
		spec?: string;
		path?: string;
		auth_type?: string;
		headers?: Record<string, unknown>;
		key?: string;
		config?: ToolServerConnectionConfig;
		info?: ToolServerConnectionInfo;
	};

	type TerminalConnectionAccessGrant = ToolServerAccessGrant;

	type TerminalConnectionPolicy = {
		image?: string;
		cpu_limit?: string;
		memory_limit?: string;
		storage?: string;
		idle_timeout_minutes?: number;
		env?: Record<string, string>;
	};

	type TerminalServerConnection = {
		id?: string;
		name?: string;
		url: string;
		key?: string;
		auth_type?: string;
		path?: string;
		enabled?: boolean;
		config?: {
			access_grants?: TerminalConnectionAccessGrant[];
		};
		server_type?: 'orchestrator' | 'terminal' | null;
		policy_id?: string;
		policy?: TerminalConnectionPolicy;
	};

	type ToolServerConnectionsResponse = {
		TOOL_SERVER_CONNECTIONS?: ToolServerConnection[] | null;
	};

	type TerminalServerConnectionsResponse = {
		TERMINAL_SERVER_CONNECTIONS?: TerminalServerConnection[] | null;
	};

	let servers: ToolServerConnection[] | null = null;
	let showConnectionModal = false;

	// Terminal server admin connections
	let terminalConnections: TerminalServerConnection[] = [];
	let showAddTerminalModal = false;
	let editTerminalIdx: number | null = null;
	let showDeleteTerminalConfirm = false;
	let deleteTerminalIdx: number | null = null;

	const addConnectionHandler = async (server: ToolServerConnection): Promise<void> => {
		servers = [...(servers ?? []), server];
		await updateHandler();
	};

	const updateHandler = async (): Promise<void> => {
		const res = await setToolServerConnections(localStorage.token, {
			TOOL_SERVER_CONNECTIONS: servers
		}).catch((err) => {
			toast.error($i18n.t('Failed to save connections'));
			return null;
		});

		if (res) {
			toast.success($i18n.t('Connections saved successfully'));
		}
	};

	const saveTerminalServers = async (): Promise<void> => {
		const res = await setTerminalServerConnections(localStorage.token, {
			TERMINAL_SERVER_CONNECTIONS: terminalConnections
		}).catch((err) => {
			toast.error($i18n.t('Failed to save terminal servers'));
			return null;
		});

		if (res) {
			toast.success($i18n.t('Terminal servers saved'));

			// Refresh the terminalServers store so changes are reflected immediately
			// Preserve user direct terminals, refresh system terminals from backend
			const existingDirectTerminals = ($terminalServers ?? []).filter((t) => !t.id);
			const systemTerminals = await getTerminalServers(localStorage.token);
			const systemEntries = systemTerminals.map((t) => ({
				id: t.id,
				url: `${WEBUI_API_BASE_URL}/terminals/${t.id}`,
				name: t.name,
				key: localStorage.token
			}));
			terminalServers.set([...existingDirectTerminals, ...systemEntries]);
		}
	};

	const addTerminalConnection = (server: TerminalServerConnection): void => {
		terminalConnections = [...terminalConnections, { ...server, id: server.id ?? uuidv4() }];
		void saveTerminalServers();
	};

	const updateTerminalConnection = (
		idx: number,
		updated: TerminalServerConnection
	): void => {
		terminalConnections = terminalConnections.map((c, i) =>
			i === idx ? { ...c, ...updated, id: updated.id ?? c.id } : c
		);
		void saveTerminalServers();
	};

	const removeTerminalConnection = (idx: number): void => {
		terminalConnections = terminalConnections.filter((_, i) => i !== idx);
		void saveTerminalServers();
	};

	const loadConnections = async (): Promise<void> => {
		const res = (await getToolServerConnections(localStorage.token)) as ToolServerConnectionsResponse;
		servers = res?.TOOL_SERVER_CONNECTIONS ?? [];

		// Load terminal server connections
		try {
			const terminalRes = (await getTerminalServerConnections(
				localStorage.token
			)) as TerminalServerConnectionsResponse;
			terminalConnections = terminalRes?.TERMINAL_SERVER_CONNECTIONS ?? [];
		} catch {
			// Not configured yet
		}
	};

	onMount(() => {
		void loadConnections();
	});
</script>

<AddToolServerModal bind:show={showConnectionModal} onSubmit={addConnectionHandler} />

<AddTerminalServerModal
	bind:show={showAddTerminalModal}
	edit={editTerminalIdx !== null}
	connection={editTerminalIdx !== null ? terminalConnections[editTerminalIdx] ?? null : null}
	onSubmit={(c: TerminalServerConnection) => {
		if (editTerminalIdx !== null) {
			updateTerminalConnection(editTerminalIdx, c);
			editTerminalIdx = null;
		} else {
			addTerminalConnection(c);
		}
	}}
	onDelete={() => {
		if (editTerminalIdx !== null) {
			deleteTerminalIdx = editTerminalIdx;
			showDeleteTerminalConfirm = true;
			editTerminalIdx = null;
		}
	}}
/>

<ConfirmDialog
	bind:show={showDeleteTerminalConfirm}
	message={$i18n.t(
		'Are you sure you want to delete this terminal connection? This action cannot be undone.'
	)}
	confirmLabel={$i18n.t('Delete')}
	on:confirm={() => {
		if (deleteTerminalIdx !== null) {
			removeTerminalConnection(deleteTerminalIdx);
			deleteTerminalIdx = null;
		}
	}}
/>

<form
	class="flex flex-col h-full justify-between text-sm"
	on:submit|preventDefault={() => {
		void updateHandler();
	}}
>
	<div class=" overflow-y-scroll scrollbar-hidden h-full">
		{#if servers !== null}
			<div class="">
				<div class="mb-3">
					<div class=" mt-0.5 mb-2.5 text-base font-medium">{$i18n.t('General')}</div>

					<hr class=" border-gray-100/30 dark:border-gray-850/30 my-2" />

					<div class="mb-2.5 flex flex-col w-full justify-between">
						<div class="flex justify-between items-center mb-0.5">
							<div class="font-medium">{$i18n.t('Manage Tool Servers')}</div>

							<Tooltip content={$i18n.t(`Add Connection`)}>
								<button
									class="px-1"
									on:click={() => {
										showConnectionModal = true;
									}}
									type="button"
								>
									<Plus />
								</button>
							</Tooltip>
						</div>

						<div class="flex flex-col gap-1">
								{#each servers as server, idx}
									<Connection
										bind:connection={server}
										onSubmit={() => {
											void updateHandler();
										}}
										onDelete={() => {
											servers = (servers ?? []).filter((_, i) => i !== idx);
											void updateHandler();
										}}
									/>
								{/each}
						</div>

						{#if servers.length === 0}
							<div class="text-xs text-gray-400 dark:text-gray-500">
								{$i18n.t('No tool server connections configured.')}
							</div>
						{/if}

						<div class="my-1.5">
							<div class="text-xs text-gray-500">
								{$i18n.t('Connect to your own OpenAPI compatible external tool servers.')}
							</div>
						</div>
					</div>

					<hr class=" border-gray-100/30 dark:border-gray-850/30 my-4" />

					<div class="mb-2.5 flex flex-col w-full">
						<div class="flex justify-between items-center mb-1">
							<div class="flex items-center gap-2">
								<div class="font-medium">{$i18n.t('Open Terminal')}</div>
								<span
									class="text-[0.65rem] font-medium uppercase px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
									>{$i18n.t('Experimental')}</span
								>
							</div>

							<Tooltip content={$i18n.t('Add Connection')}>
								<button
									class="px-1"
									on:click={() => {
										editTerminalIdx = null;
										showAddTerminalModal = true;
									}}
									type="button"
								>
									<Plus />
								</button>
							</Tooltip>
						</div>

						<div class="flex flex-col gap-1.5">
							{#each terminalConnections as connection, idx}
								<div class="flex w-full gap-2 items-center">
									<Tooltip className="w-full relative" content={''} placement="top-start">
										<div class="flex w-full">
											<div
												class="flex-1 relative flex gap-1.5 items-center {connection?.enabled ===
												false
													? 'opacity-50'
													: ''}"
											>
												<Tooltip content={$i18n.t('Terminal')}>
													<Cloud className="size-4" strokeWidth="1.5" />
												</Tooltip>

												<div class="outline-hidden w-full bg-transparent text-sm">
													{connection.name || connection.url || $i18n.t('New Terminal')}
												</div>
											</div>
										</div>
									</Tooltip>

									<div class="flex gap-1 items-center">
										<Tooltip content={$i18n.t('Configure')}>
											<button
												class="self-center p-1 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-850 rounded-lg transition"
												on:click={() => {
													editTerminalIdx = idx;
													showAddTerminalModal = true;
												}}
												type="button"
											>
												<Cog6 />
											</button>
										</Tooltip>

										<Tooltip
											content={connection?.enabled !== false
												? $i18n.t('Enabled')
												: $i18n.t('Disabled')}
										>
										<Switch
											state={connection?.enabled !== false}
											on:change={() => {
												terminalConnections = terminalConnections.map((c, i) =>
													i === idx ? { ...c, enabled: !(c?.enabled !== false) } : c
												);
												void saveTerminalServers();
											}}
										/>
									</Tooltip>
									</div>
								</div>
							{/each}
						</div>

						{#if terminalConnections.length === 0}
							<div class="text-xs text-gray-400 dark:text-gray-500">
								{$i18n.t('No terminal connections configured.')}
							</div>
						{/if}

						<div class="mt-1.5">
							<div class="text-xs text-gray-500">
								{$i18n.t(
									'Connect to Open Terminal instances. All users will have access to file browsing and terminal tools through these servers.'
								)}
							</div>
							<div class="text-xs text-gray-600 dark:text-gray-300 mt-1">
								<a
									class="underline"
									href="https://github.com/open-webui/open-terminal"
									target="_blank">{$i18n.t('Learn more about Open Terminal')} ↗</a
								>
							</div>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="flex h-full justify-center">
				<div class="my-auto">
					<Spinner className="size-6" />
				</div>
			</div>
		{/if}
	</div>

	<div class="flex justify-end pt-3 text-sm font-medium">
		<button
			class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
			type="submit"
		>
			{$i18n.t('Save')}
		</button>
	</div>
</form>
