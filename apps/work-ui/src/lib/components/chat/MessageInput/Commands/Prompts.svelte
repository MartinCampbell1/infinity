<script lang="ts">
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import { getContext, onDestroy } from 'svelte';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';

	import { getPrompts } from '$lib/apis/prompts';
	import type { PromptItem } from '$lib/apis/prompts';

	const i18n = getContext('i18n');
	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	export let query = '';
	export let onSelect: (event: { type: 'prompt'; data: PromptItem }) => void = () => {};

	let selectedPromptIdx = 0;
	export let filteredItems: PromptItem[] = [];
	let searchDebounceTimer: ReturnType<typeof setTimeout>;

	let items: PromptItem[] = [];

	$: if (query !== undefined) {
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			getItems();
		}, 200);
	}

	onDestroy(() => {
		clearTimeout(searchDebounceTimer);
	});

	$: filteredItems = items
		.filter((p) => p.command.toLowerCase().includes(query.toLowerCase()))
		.sort((a, b) => a.name.localeCompare(b.name));

	$: if (query) {
		selectedPromptIdx = 0;
	}

	const getItems = async () => {
		const res = (await getPrompts(getWorkspaceAuthToken()).catch(() => null)) as PromptItem[] | null;
		if (res) {
			items = res;
		}
	};

	export const selectUp = () => {
		selectedPromptIdx = Math.max(0, selectedPromptIdx - 1);
	};
	export const selectDown = () => {
		selectedPromptIdx = Math.min(selectedPromptIdx + 1, filteredItems.length - 1);
	};

	export const select = async () => {
		const command = filteredItems[selectedPromptIdx];
		if (command) {
			onSelect({ type: 'prompt', data: command });
		}
	};
</script>

<div class="px-2 text-xs text-gray-500 py-1">
	{$i18n.t('Prompts')}
</div>

{#if filteredItems.length > 0}
	<div class=" space-y-0.5 scrollbar-hidden">
		{#each filteredItems as promptItem, promptIdx}
			<Tooltip content={promptItem.name} placement="top-start">
				<button
					class=" px-3 py-1 rounded-xl w-full text-left {promptIdx === selectedPromptIdx
						? '  bg-gray-50 dark:bg-gray-800 selected-command-option-button'
						: ''} truncate"
					type="button"
					on:click={() => {
						onSelect({ type: 'prompt', data: promptItem });
					}}
					on:mousemove={() => {
						selectedPromptIdx = promptIdx;
					}}
					on:focus={() => {}}
					data-selected={promptIdx === selectedPromptIdx}
				>
					<span class=" font-medium text-black dark:text-gray-100">
						{promptItem.command}
					</span>

					<span class=" text-xs text-gray-600 dark:text-gray-100">
						{promptItem.name}
					</span>
				</button>
			</Tooltip>
		{/each}
	</div>
{/if}
