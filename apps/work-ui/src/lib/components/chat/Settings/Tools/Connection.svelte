<script lang="ts">
	import { getContext } from 'svelte';
	const i18n = getContext('i18n');

	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Switch from '$lib/components/common/Switch.svelte';
	import SensitiveInput from '$lib/components/common/SensitiveInput.svelte';
	import Cog6 from '$lib/components/icons/Cog6.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import AddToolServerModal from '$lib/components/AddToolServerModal.svelte';
	import WrenchAlt from '$lib/components/icons/WrenchAlt.svelte';

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

	export let onDelete: () => void = () => {};
	export let onSubmit: (connection: ToolServerConnection) => void = () => {};

	export let connection: ToolServerConnection | null = null;
	export let direct = false;

	let showConfigModal = false;
	let showDeleteConfirmDialog = false;
</script>

<AddToolServerModal
	edit
	{direct}
	bind:show={showConfigModal}
	{connection}
	onDelete={() => {
		showDeleteConfirmDialog = true;
	}}
	onSubmit={(c: ToolServerConnection) => {
		connection = c;
		onSubmit(c);
	}}
/>

<ConfirmDialog
	bind:show={showDeleteConfirmDialog}
	message={$i18n.t(
		'Are you sure you want to delete this connection? This action cannot be undone.'
	)}
	confirmLabel={$i18n.t('Delete')}
	on:confirm={() => {
		onDelete();
		showConfigModal = false;
	}}
/>

<div class="flex w-full gap-2 items-center">
	<Tooltip className="w-full relative" content={''} placement="top-start">
		<div class="flex w-full">
			<div
				class="flex-1 relative flex gap-1.5 items-center {!(connection?.config?.enable ?? true)
					? 'opacity-50'
					: ''}"
			>
				<Tooltip content={connection?.type === 'mcp' ? $i18n.t('MCP') : $i18n.t('OpenAPI')}>
					<WrenchAlt />
				</Tooltip>

				{#if connection?.info?.name}
					<div class=" capitalize outline-hidden w-full bg-transparent">
						{connection?.info?.name ?? connection?.url}
						<span class="text-gray-500">{connection?.info?.id ?? ''}</span>
					</div>
				{:else}
					<div>
						{connection?.url}
					</div>
				{/if}
			</div>
		</div>
	</Tooltip>

	<div class="flex gap-1 items-center">
		<Tooltip content={$i18n.t('Configure')} className="self-start">
			<button
				class="self-center p-1 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-850 rounded-lg transition"
				on:click={() => {
					showConfigModal = true;
				}}
				type="button"
			>
				<Cog6 />
			</button>
		</Tooltip>

		<Tooltip
			content={(connection?.config?.enable ?? true) ? $i18n.t('Enabled') : $i18n.t('Disabled')}
		>
			<Switch
				state={connection?.config?.enable ?? true}
				on:change={() => {
					if (!connection) {
						return;
					}
					if (!connection.config) connection.config = {};
					connection.config.enable = !(connection?.config?.enable ?? true);
					onSubmit(connection);
				}}
			/>
		</Tooltip>
	</div>
</div>
