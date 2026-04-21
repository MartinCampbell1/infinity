<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import Checkbox from '$lib/components/common/Checkbox.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';

	const i18n = getContext('i18n');

	type FilterRecord = {
		id: string;
		name: string;
		meta?: {
			description?: string;
		};
	};

	type SelectedFilterRecord = FilterRecord & {
		selected: boolean;
	};

	export let filters: FilterRecord[] = [];
	export let selectedFilterIds: string[] = [];

	let _filters: Record<string, SelectedFilterRecord> = {};

	onMount(() => {
		_filters = filters.reduce<Record<string, SelectedFilterRecord>>((acc, filter) => {
			acc[filter.id] = {
				...filter,
				selected: selectedFilterIds.includes(filter.id)
			};

			return acc;
		}, {});
	});
</script>

<div>
	<div class="flex w-full justify-between mb-1">
		<div class=" self-center text-xs text-gray-500 font-medium">{$i18n.t('Default Filters')}</div>
	</div>

	<div class="flex flex-col">
			{#if filters.length > 0}
				<div class=" flex items-center flex-wrap">
					{#each Object.keys(_filters) as filter, filterIdx}
						{@const filterEntry = _filters[filter]}
						<div class=" flex items-center gap-2 mr-3">
							<div class="self-center flex items-center">
								<Checkbox
									state={filterEntry.selected ? 'checked' : 'unchecked'}
									on:change={(e) => {
										filterEntry.selected = e.detail === 'checked';
										selectedFilterIds = Object.keys(_filters).filter((t) => _filters[t].selected);
									}}
								/>
							</div>

							<div class=" py-0.5 text-sm w-full capitalize font-medium">
								<Tooltip content={filterEntry.meta?.description}>
									{filterEntry.name}
								</Tooltip>
							</div>
						</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
