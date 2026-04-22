<script lang="ts">
	import fileSaver from 'file-saver';
	const { saveAs } = fileSaver;
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';

	import { downloadDatabase } from '$lib/apis/utils';
	import { getContext } from 'svelte';
	import { config } from '$lib/stores';
	import { toast } from 'svelte-sonner';
	import { getAllUserChats } from '$lib/apis/chats';
	import { getAllUsers } from '$lib/apis/users';
	import { exportConfig, importConfig } from '$lib/apis/configs';

	const i18n = getContext('i18n');

	type ExportUserRecord = {
		id?: string;
		name?: string;
		email?: string;
		role?: string;
		[key: string]: unknown;
	};

	export const saveHandler = async (): Promise<void> => {};

	let configInputElement: HTMLInputElement | null = null;
	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	const exportAllUserChats = async () => {
		let blob = new Blob([JSON.stringify(await getAllUserChats(getWorkspaceAuthToken()))], {
			type: 'application/json'
		});
		saveAs(blob, `all-chats-export-${Date.now()}.json`);
	};

	const exportUsers = async () => {
		const users = (await getAllUsers(getWorkspaceAuthToken())) as { users: ExportUserRecord[] };

		const headers = ['id', 'name', 'email', 'role'];

		const csv = [
			headers.join(','),
				...users.users.map((user: ExportUserRecord) => {
				return headers
					.map((header) => {
						if (user[header] === null || user[header] === undefined) {
							return '';
						}
						return `"${String(user[header]).replace(/"/g, '""')}"`;
					})
					.join(',');
			})
		].join('\n');

		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		saveAs(blob, 'users.csv');
	};

</script>

<div class="flex flex-col h-full justify-between text-sm">
	<div class="space-y-3 overflow-y-scroll scrollbar-hidden h-full">
			<input
				id="config-json-input"
				bind:this={configInputElement}
				hidden
				type="file"
				accept=".json"
				on:change={(e: Event) => {
					const input = e.currentTarget as HTMLInputElement | null;
					const file = input?.files?.[0];
					if (!file) {
						return;
					}
					const reader = new FileReader();

					reader.onload = async () => {
						const configText = reader.result;
						if (typeof configText !== 'string') {
							toast.error($i18n.t('Failed to read config file'));
							if (input) {
								input.value = '';
							}
							return;
						}

						const res = await importConfig(getWorkspaceAuthToken(), JSON.parse(configText)).catch((error) => {
							toast.error(`${error}`);
						});

						if (res) {
							toast.success($i18n.t('Config imported successfully'));
						}
						if (input) {
							input.value = '';
						}
					};

					reader.readAsText(file);
				}}
		/>

		<div>
			<div class="mb-1 text-sm font-medium">{$i18n.t('Config')}</div>

			<div>
				<div class="py-0.5 flex w-full justify-between">
					<div class="self-center text-xs">{$i18n.t('Import Config')}</div>
						<button
							class="p-1 px-3 text-xs flex rounded-sm transition"
							on:click={() => {
								configInputElement?.click();
							}}
							type="button"
						>
						<span class="self-center">{$i18n.t('Import')}</span>
					</button>
				</div>
			</div>

			<div>
				<div class="py-0.5 flex w-full justify-between">
					<div class="self-center text-xs">{$i18n.t('Export Config')}</div>
					<button
						class="p-1 px-3 text-xs flex rounded-sm transition"
						on:click={async () => {
							const config = await exportConfig(getWorkspaceAuthToken());
							const blob = new Blob([JSON.stringify(config)], {
								type: 'application/json'
							});
							saveAs(blob, `config-${Date.now()}.json`);
						}}
						type="button"
					>
						<span class="self-center">{$i18n.t('Export')}</span>
					</button>
				</div>
			</div>
		</div>

		{#if $config?.features.enable_admin_export ?? true}
			<div>
				<div class="mb-1 text-sm font-medium">{$i18n.t('Database')}</div>

				<div>
					<div class="py-0.5 flex w-full justify-between">
						<div class="self-center text-xs">{$i18n.t('Download Database')}</div>
						<button
						class="p-1 px-3 text-xs flex rounded-sm transition"
						on:click={() => {
							downloadDatabase(getWorkspaceAuthToken()).catch((error) => {
								toast.error(`${error}`);
							});
						}}
							type="button"
						>
							<span class="self-center">{$i18n.t('Download')}</span>
						</button>
					</div>
				</div>

				<div>
					<div class="py-0.5 flex w-full justify-between">
						<div class="self-center text-xs">{$i18n.t('Export All Chats (All Users)')}</div>
						<button
							class="p-1 px-3 text-xs flex rounded-sm transition"
							on:click={() => {
								exportAllUserChats();
							}}
							type="button"
						>
							<span class="self-center">{$i18n.t('Export')}</span>
						</button>
					</div>
				</div>

				<div>
					<div class="py-0.5 flex w-full justify-between">
						<div class="self-center text-xs">{$i18n.t('Export Users')}</div>
						<button
							class="p-1 px-3 text-xs flex rounded-sm transition"
							on:click={() => {
								exportUsers();
							}}
							type="button"
						>
							<span class="self-center">{$i18n.t('Export')}</span>
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
