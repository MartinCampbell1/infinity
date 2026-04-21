<script lang="ts">
	import Sortable from 'sortablejs';

	import { getContext, onDestroy, tick } from 'svelte';
	const i18n = getContext('i18n');

	import { models } from '$lib/stores';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import EllipsisVertical from '$lib/components/icons/EllipsisVertical.svelte';

	type SortableUpdateEvent = {
		oldIndex: number | null;
		newIndex: number | null;
		item: HTMLElement;
	};

	export let modelIds: string[] = [];

	let sortable: Sortable | null = null;
	let modelListElement: HTMLDivElement | null = null;

	const positionChangeHandler = (event: SortableUpdateEvent) => {
		const { oldIndex, newIndex, item } = event;
		if (oldIndex === null || newIndex === null) {
			return;
		}

		// Revert SortableJS's DOM manipulation so Svelte doesn't get out of sync.
		// Svelte expects the DOM to match its virtual DOM before it applies state updates.
		const parent = item.parentElement;
		if (!parent) {
			return;
		}
		const target = parent.children[oldIndex < newIndex ? oldIndex : oldIndex + 1];
		parent.insertBefore(item, target ?? null);

		// Now apply the logical state update, letting Svelte handle the real DOM move.
		const updatedIds = [...modelIds];
		const [movedId] = updatedIds.splice(oldIndex, 1);
		updatedIds.splice(newIndex, 0, movedId);
		modelIds = updatedIds;
	};

	const initSortable = () => {
		if (sortable) {
			sortable.destroy();
			sortable = null;
		}

		if (modelListElement) {
			sortable = new Sortable(modelListElement, {
				animation: 150,
				handle: '.model-item-handle',
				onUpdate: (...args: unknown[]) => {
					const event = args[0] as SortableUpdateEvent | undefined;
					if (event) {
						positionChangeHandler(event);
					}
				}
			});
		}
	};

	$: if (modelIds && modelListElement) {
		tick().then(() => {
			initSortable();
		});
	}

	onDestroy(() => {
		if (sortable) {
			sortable.destroy();
		}
	});
</script>

{#if modelIds.length > 0}
		<div class="flex flex-col -translate-x-1" bind:this={modelListElement}>
			{#each modelIds as modelId (modelId)}
				{@const modelRecord = $models.find((model) => model.id === modelId)}
				<div class=" flex gap-2 w-full justify-between items-center" id="model-item-{modelId}">
					<Tooltip content={modelId} placement="top-start">
						<div class="flex items-center gap-1">
							<EllipsisVertical className="size-4 cursor-move model-item-handle" />

							<div class=" text-sm flex-1 py-1 rounded-lg line-clamp-1">
								{#if modelRecord}
									{modelRecord.name}
								{:else}
									{modelId}
								{/if}
						</div>
					</div>
				</Tooltip>
			</div>
		{/each}
	</div>
{:else}
	<div class="text-gray-500 text-xs text-center py-2">
		{$i18n.t('No models found')}
	</div>
{/if}
