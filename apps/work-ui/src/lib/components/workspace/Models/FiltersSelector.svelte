<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import Checkbox from '$lib/components/common/Checkbox.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';

	const i18n = getContext('i18n');

	type FilterItem = {
		id: string;
		name: string;
		is_global?: boolean;
		selected?: boolean;
		meta?: {
			description?: string;
		};
	};

	type FilterMap = Record<string, FilterItem>;

	export let filters: FilterItem[] = [];
	export let selectedFilterIds: string[] = [];

	let _filters: FilterMap = {};
	let filterEntries: [string, FilterItem][] = [];

	onMount(() => {
		_filters = filters.reduce((acc: FilterMap, filter) => {
			acc[filter.id] = {
				...filter,
				selected: selectedFilterIds.includes(filter.id)
			};

			return acc;
		}, {} as FilterMap);
	});

	$: filterEntries = Object.entries(_filters) as [string, FilterItem][];
</script>

{#if filters.length > 0}
	<div>
		<div class="flex w-full justify-between mb-1">
			<div class=" self-center text-xs font-medium text-gray-500">{$i18n.t('Filters')}</div>
		</div>

		<!-- TODO: Filer order matters -->
		<div class="flex flex-col">
			<div class=" flex items-center flex-wrap">
				{#each filterEntries as [, filter]}
					<div class=" flex items-center gap-2 mr-3">
						<div class="self-center flex items-center">
							<Checkbox
								state={filter.is_global
									? 'checked'
									: filter.selected
										? 'checked'
										: 'unchecked'}
								disabled={filter.is_global}
								on:change={(e) => {
									if (!filter.is_global) {
										filter.selected = e.detail === 'checked';
										selectedFilterIds = filterEntries
											.filter(([, item]) => item.selected)
											.map(([id]) => id);
									}
								}}
							/>
						</div>

						<div class=" py-0.5 text-sm w-full capitalize font-medium">
							<Tooltip content={filter.meta?.description ?? filter.name}>
								{filter.name}
							</Tooltip>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
