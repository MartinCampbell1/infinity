<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { getContext } from 'svelte';
	import { toast } from 'svelte-sonner';

	import {
		getHermesProfiles,
		type HermesProfile,
		type HermesProfilesResponse
	} from '$lib/apis/hermes';
	import { deleteMemoryById, getMemories, type MemoryItem } from '$lib/apis/memories';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import AddMemoryModal from '$lib/components/chat/Settings/Personalization/AddMemoryModal.svelte';
	import EditMemoryModal from '$lib/components/chat/Settings/Personalization/EditMemoryModal.svelte';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';
	import GarbageBin from '$lib/components/icons/GarbageBin.svelte';
	import Pencil from '$lib/components/icons/Pencil.svelte';
	import Search from '$lib/components/icons/Search.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';

	const i18n = getContext<any>('i18n');

	// TODO(21st): Replace this stopgap local panel pattern with a 21st.dev-derived micro-surface once MCP auth is fixed.

	export let active = false;

	type MemoryGroup = {
		id: string;
		label: string;
		items: MemoryItem[];
	};

	let memoriesLoaded = false;
	let memoriesLoading = false;
	let profileContextLoaded = false;
	let profileContextLoading = false;
	let previousActive = false;
	let profileLoadError = '';
	let query = '';
	let memories: MemoryItem[] = [];
	let profilesResponse: HermesProfilesResponse | null = null;
	let showAddMemoryModal = false;
	let showEditMemoryModal = false;
	let showDeleteConfirm = false;
	let selectedMemory: MemoryItem | null = null;
	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	const normalizeTimestamp = (value: number | null | undefined) =>
		typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

	const getErrorMessage = (error: any, fallback: string) => {
		if (typeof error === 'string') {
			return error;
		}

		return error?.detail ?? error?.message ?? fallback;
	};

	const formatDateTime = (timestamp: number | null | undefined) => {
		const normalizedTimestamp = normalizeTimestamp(timestamp);
		if (!normalizedTimestamp) {
			return '';
		}

		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(normalizedTimestamp * 1000));
	};

	const groupMemoriesByMonth = (items: MemoryItem[]) => {
		const grouped = new Map<string, MemoryGroup>();

		for (const item of items) {
			const sortTimestamp =
				normalizeTimestamp(item.updated_at) ?? normalizeTimestamp(item.created_at) ?? 0;
			const groupDate = new Date(sortTimestamp * 1000);
			const groupId = `${groupDate.getFullYear()}-${groupDate.getMonth() + 1}`;
			const label = new Intl.DateTimeFormat(undefined, {
				month: 'long',
				year: 'numeric'
			}).format(groupDate);

			if (!grouped.has(groupId)) {
				grouped.set(groupId, {
					id: groupId,
					label,
					items: []
				});
			}

			grouped.get(groupId)?.items.push(item);
		}

		return Array.from(grouped.values());
	};

	const sortMemories = (items: MemoryItem[]) =>
		[...items].sort((left, right) => {
			const rightTimestamp =
				normalizeTimestamp(right.updated_at) ?? normalizeTimestamp(right.created_at) ?? 0;
			const leftTimestamp =
				normalizeTimestamp(left.updated_at) ?? normalizeTimestamp(left.created_at) ?? 0;

			return rightTimestamp - leftTimestamp;
		});

	const loadMemories = async (force = false) => {
		if (memoriesLoading || (memoriesLoaded && !force)) {
			return;
		}

		if (typeof localStorage === 'undefined') {
			return;
		}

		memoriesLoading = true;

		try {
			const nextMemories = await getMemories(getWorkspaceAuthToken()).catch((error) => {
				toast.error(`${error}`);
				return null;
			});

			memories = sortMemories((nextMemories ?? []).filter(Boolean));
		} finally {
			memoriesLoaded = true;
			memoriesLoading = false;
		}
	};

	const loadProfileContext = async (force = false) => {
		if (profileContextLoading || (profileContextLoaded && !force)) {
			return;
		}

		if (typeof localStorage === 'undefined') {
			return;
		}

		profileContextLoading = true;
		profileLoadError = '';

		try {
			profilesResponse = await getHermesProfiles(getWorkspaceAuthToken()).catch((error) => {
				console.error(error);
				profileLoadError = getErrorMessage(error, $i18n.t('Profile context unavailable.'));
				return null;
			});
		} finally {
			profileContextLoaded = true;
			profileContextLoading = false;
		}
	};

	$: filteredMemories = query
		? memories.filter((memory) => memory.content?.toLowerCase().includes(query.toLowerCase()))
		: memories;
	$: memoryGroups = groupMemoriesByMonth(filteredMemories);
	$: activeHermesProfile =
		(profilesResponse?.items?.find((profile) => profile.is_active) as HermesProfile | undefined) ??
		profilesResponse?.items?.[0] ??
		null;
	$: memoryContextChips = [
		activeHermesProfile?.memory_enabled || activeHermesProfile?.has_memory
			? $i18n.t('Profile memory enabled')
			: '',
		activeHermesProfile?.user_profile_enabled || activeHermesProfile?.has_user_profile
			? $i18n.t('User profile')
			: ''
	].filter(Boolean);

	$: {
		const becameActive = active && !previousActive;
		previousActive = active;

		if (becameActive) {
			if (!memoriesLoaded && !memoriesLoading) {
				loadMemories();
			}

			loadProfileContext(profileContextLoaded);
		}
	}
</script>

<div class="flex h-full min-h-0 flex-col px-2 py-2">
	<div class="flex items-center gap-2 px-2 pb-2">
		<div class="flex flex-1 items-center rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2">
			<div class="mr-2 text-slate-400">
				<Search className="size-3.5" />
			</div>
			<input
				class="w-full bg-transparent text-sm text-slate-100 outline-hidden placeholder:text-slate-500"
				bind:value={query}
				placeholder={$i18n.t('Search Memories')}
			/>

			{#if query}
				<button
					type="button"
					class="ml-2 rounded-full p-1 text-slate-400 transition hover:bg-slate-700/60 hover:text-slate-200"
					on:click={() => {
						query = '';
					}}
				>
					<XMark className="size-3.5" strokeWidth="2" />
				</button>
			{/if}
		</div>

		<button
			type="button"
			class="rounded-full border border-sky-500/20 bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-100 transition hover:bg-sky-500/20"
			on:click={() => {
				showAddMemoryModal = true;
			}}
		>
			{$i18n.t('Add Memory')}
		</button>
	</div>

	<div class="px-2 pb-2">
		<div
			class="rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2.5"
		>
			<div class="flex items-start justify-between gap-3">
				<div class="min-w-0">
					<div
						class="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400"
					>
						{$i18n.t('Saved user memories')}
					</div>
					<div class="mt-1 line-clamp-1 text-sm font-medium text-slate-200">
						{activeHermesProfile?.name ?? profilesResponse?.active_profile ?? $i18n.t('Not set')}
					</div>

					<div class="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
						{$i18n.t('This is the user memory store Hermes can read when memory is enabled.')}
					</div>
				</div>

				{#if profileContextLoading}
					<div class="mt-0.5 text-slate-400">
						<Spinner className="size-4" />
					</div>
				{/if}
			</div>

			{#if memoryContextChips.length > 0}
				<div class="mt-2 flex flex-wrap gap-1.5">
				{#each memoryContextChips as item}
					<div
						class="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[11px] text-slate-400"
					>
						{item}
					</div>
					{/each}
				</div>
			{/if}

			{#if profileLoadError}
				<div class="mt-2 text-xs text-slate-400">{profileLoadError}</div>
			{/if}
		</div>
	</div>

	<div
		class="flex items-center justify-between gap-2 px-2 pb-2 text-[11px] text-slate-400"
	>
		<div>
			{#if memoriesLoading && !memoriesLoaded}
				{$i18n.t('Loading')}...
			{:else}
				{$i18n.t('Saved memories')} · {memories.length}
			{/if}
		</div>

		{#if memoriesLoading && memoriesLoaded}
			<div class="flex items-center gap-1.5">
				<Spinner className="size-3" />
				<div>{$i18n.t('Updated')}</div>
			</div>
		{/if}
	</div>

	<div class="flex-1 min-h-0 overflow-y-auto px-1 pb-2">
		{#if memoriesLoading && !memoriesLoaded}
			<div class="flex h-24 items-center justify-center">
				<Spinner className="size-4" />
			</div>
		{:else if memoryGroups.length === 0}
			<div class="px-3 py-8 text-center text-sm text-slate-400">
				{#if memories.length === 0}
					{$i18n.t('Saved user memories appear here.')}
				{:else}
					{$i18n.t('No results found')}
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-3">
				{#each memoryGroups as group (group.id)}
					<section>
						<div class="flex items-center justify-between px-2 pb-1">
							<div
								class="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400"
							>
								{group.label}
							</div>
							<div class="text-[11px] text-slate-400">{group.items.length}</div>
						</div>

						<div class="flex flex-col gap-1.5">
							{#each group.items as memory (memory.id)}
								<div
									class="rounded-xl border border-white/8 bg-slate-900/70 px-3 py-2.5 transition hover:bg-slate-800/70"
								>
								<div class="flex items-start justify-between gap-3">
										<button
											type="button"
											class="min-w-0 flex-1 text-left"
											on:click={() => {
												selectedMemory = memory;
												showEditMemoryModal = true;
											}}
										>
											<div class="line-clamp-2 text-sm leading-6 text-slate-100">
												{memory.content}
											</div>
											<div class="mt-1 text-[11px] text-slate-400">
												{$i18n.t('Updated at')}: {formatDateTime(memory.updated_at)}
											</div>

											{#if normalizeTimestamp(memory.created_at) && memory.created_at !== memory.updated_at}
												<div class="text-[11px] text-slate-400">
													{$i18n.t('Created at')}: {formatDateTime(memory.created_at)}
												</div>
											{/if}
										</button>

										<div class="flex shrink-0 items-center gap-1 text-slate-400">
											<button
												type="button"
												class="rounded-xl p-1.5 transition hover:bg-slate-700/60"
												on:click|stopPropagation={() => {
													selectedMemory = memory;
													showEditMemoryModal = true;
												}}
											>
												<Pencil className="size-4" />
											</button>
											<button
												type="button"
												class="rounded-xl p-1.5 transition hover:bg-slate-700/60"
												on:click|stopPropagation={() => {
													selectedMemory = memory;
													showDeleteConfirm = true;
												}}
											>
												<GarbageBin className="size-4" strokeWidth="1.5" />
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{/if}
	</div>

	<AddMemoryModal
		bind:show={showAddMemoryModal}
		on:save={() => {
			loadMemories(true);
		}}
	/>

	<EditMemoryModal
		bind:show={showEditMemoryModal}
		memory={selectedMemory ?? {}}
		on:save={() => {
			loadMemories(true);
		}}
	/>

	<ConfirmDialog
		title={$i18n.t('Delete Memory?')}
		show={showDeleteConfirm}
		on:confirm={async () => {
			if (!selectedMemory || typeof localStorage === 'undefined') {
				showDeleteConfirm = false;
				return;
			}

			const res = await deleteMemoryById(getWorkspaceAuthToken(), selectedMemory.id).catch((error) => {
				toast.error(`${error}`);
				return null;
			});

			if (res) {
				toast.success($i18n.t('Memory deleted successfully'));
				await loadMemories(true);
			}

			showDeleteConfirm = false;
		}}
		on:cancel={() => {
			showDeleteConfirm = false;
		}}
	>
		<div class="text-sm text-slate-400">
			{$i18n.t('Are you sure you want to delete this memory? This action cannot be undone.')}
		</div>
	</ConfirmDialog>
</div>
