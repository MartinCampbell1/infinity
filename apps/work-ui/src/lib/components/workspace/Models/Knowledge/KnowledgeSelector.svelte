<script lang="ts">
	import dayjs from 'dayjs';

	import { onMount, onDestroy, getContext, createEventDispatcher } from 'svelte';
	import { searchNotes } from '$lib/apis/notes';
	import { searchKnowledgeBases, searchKnowledgeFiles } from '$lib/apis/knowledge';

	import { decodeString } from '$lib/utils';

	import Dropdown from '$lib/components/common/Dropdown.svelte';
	import Search from '$lib/components/icons/Search.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Database from '$lib/components/icons/Database.svelte';
	import PageEdit from '$lib/components/icons/PageEdit.svelte';
	import DocumentPage from '$lib/components/icons/DocumentPage.svelte';

	const i18n = getContext('i18n');
	type KnowledgeNoteItem = {
		type: 'note';
		id?: string;
		name: string;
		description: string;
		title?: string;
		updated_at?: number;
		[key: string]: unknown;
	};

	type KnowledgeCollectionItem = {
		type: 'collection';
		id?: string;
		name: string;
		description?: string;
		[key: string]: unknown;
	};

	type KnowledgeFileItem = {
		type: 'file';
		id?: string;
		name: string;
		description?: string;
		filename?: string;
		meta?: {
			name?: string | null;
		} | null;
		[key: string]: unknown;
	};

	type KnowledgeSelectorItem = KnowledgeNoteItem | KnowledgeCollectionItem | KnowledgeFileItem;

	type SearchNotesItem = {
		title?: string;
		updated_at?: number;
		[key: string]: unknown;
	};

	type SearchKnowledgeItem = {
		name?: string;
		description?: string | null;
		[key: string]: unknown;
	};

	type SearchKnowledgeFileItem = {
		filename?: string;
		description?: string | null;
		meta?: {
			name?: string | null;
		} | null;
		[key: string]: unknown;
	};

	type SearchResponse<T> = {
		items?: T[];
	} | null;

	const dispatch = createEventDispatcher<{
		select: KnowledgeSelectorItem;
	}>();

	export let onClose: () => void = () => {};

	let show = false;

	let query = '';
	let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined = undefined;

	let noteItems: KnowledgeSelectorItem[] = [];
	let knowledgeItems: KnowledgeSelectorItem[] = [];
	let fileItems: KnowledgeSelectorItem[] = [];

	let items: KnowledgeSelectorItem[] = [];
	let searchRequestId = 0;

	$: items = [...noteItems, ...knowledgeItems, ...fileItems];

	$: if (query !== undefined) {
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			void getItems();
		}, 300);
	}

	onDestroy(() => {
		clearTimeout(searchDebounceTimer);
	});

	const getItems = async () => {
		const requestId = ++searchRequestId;
		noteItems = [];
		knowledgeItems = [];
		fileItems = [];

		await Promise.all([
			getNoteItems(requestId),
			getKnowledgeItems(requestId),
			getKnowledgeFileItems(requestId)
		]);
	};

	const getNoteItems = async (requestId: number) => {
		const res = (await searchNotes(localStorage.token, query).catch(() => {
			return null;
		})) as SearchResponse<SearchNotesItem>;

		if (requestId !== searchRequestId || !res) return;

		noteItems = (res.items ?? []).map((note) => {
			return {
				...note,
				type: 'note' as const,
				name: note.title ?? '',
				description: dayjs((note.updated_at ?? 0) / 1000000).fromNow()
			};
		});
	};

	const getKnowledgeItems = async (requestId: number) => {
		const res = (await searchKnowledgeBases(localStorage.token, query).catch(() => {
			return null;
		})) as SearchResponse<SearchKnowledgeItem>;

		if (requestId !== searchRequestId || !res) return;

		knowledgeItems = (res.items ?? []).map((item) => {
			return {
				...item,
				type: 'collection' as const,
				name: item.name ?? '',
				description: item.description ?? ''
			};
		});
	};

	const getKnowledgeFileItems = async (requestId: number) => {
		const res = (await searchKnowledgeFiles(localStorage.token, query).catch(() => {
			return null;
		})) as SearchResponse<SearchKnowledgeFileItem>;

		if (requestId !== searchRequestId || !res) return;

		fileItems = (res.items ?? []).map((file) => {
			return {
				...file,
				type: 'file' as const,
				name: file.meta?.name || file.filename || '',
				description: file.description || ''
			};
		});
	};

	onMount(() => {
		void getItems();
	});
</script>

<Dropdown
	bind:show
	onOpenChange={(state: boolean) => {
		if (!state) {
			onClose();
			query = '';
		}
	}}
>
	<slot />

	<div slot="content">
		<div
			class="z-[10000] text-black dark:text-white rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-850 w-70 p-1.5"
		>
			<div class=" flex w-full space-x-2 px-2 pb-0.5">
				<div class="flex flex-1">
					<div class=" self-center mr-2">
						<Search className="size-3.5" />
					</div>
					<input
						class=" w-full text-sm pr-4 py-1 rounded-r-xl outline-hidden bg-transparent"
						bind:value={query}
						placeholder={$i18n.t('Search')}
					/>
				</div>
			</div>

			<div class="max-h-56 overflow-y-scroll gap-0.5 flex flex-col">
				{#if items.length === 0}
					<div class="text-center text-xs text-gray-500 dark:text-gray-400 pt-4 pb-6">
						{$i18n.t('No knowledge found')}
					</div>
				{:else}
					{#each items as item, i}
						{#if i === 0 || item?.type !== items[i - 1]?.type}
							<div class="px-2 text-xs text-gray-500 py-1">
								{#if item?.type === 'note'}
									{$i18n.t('Notes')}
								{:else if item?.type === 'collection'}
									{$i18n.t('Collections')}
								{:else if item?.type === 'file'}
									{$i18n.t('Files')}
								{/if}
							</div>
						{/if}

						<div
							class=" px-2.5 py-1 rounded-xl w-full text-left flex justify-between items-center text-sm hover:bg-gray-50 hover:dark:bg-gray-800 hover:dark:text-gray-100 selected-command-option-button"
						>
							<button
								class="w-full flex-1"
								type="button"
								on:click={() => {
									dispatch('select', item);
									show = false;
								}}
							>
								<div class="  text-black dark:text-gray-100 flex items-center gap-1 shrink-0">
										{#if item.type === 'note'}
											<Tooltip
												content={$i18n.t('Note')}
												placement="top"
											>
												<PageEdit className="size-4" />
											</Tooltip>
										{:else if item.type === 'collection'}
											<Tooltip
												content={$i18n.t('Collection')}
												placement="top"
											>
												<Database className="size-4" />
											</Tooltip>
										{:else if item.type === 'file'}
											<Tooltip
												content={$i18n.t('File')}
												placement="top"
											>
												<DocumentPage className="size-4" />
											</Tooltip>
										{/if}

										<Tooltip
											content={item.description || decodeString(item?.name)}
											placement="top-start"
										>
											<div class="line-clamp-1 flex-1 text-sm text-left">
												{decodeString(item?.name)}
											</div>
									</Tooltip>
								</div>
							</button>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</Dropdown>
