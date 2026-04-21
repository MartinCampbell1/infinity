<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import Checkbox from '$lib/components/common/Checkbox.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';

	const i18n = getContext('i18n');

	type ActionItem = {
		id: string;
		name: string;
		is_global?: boolean;
		selected?: boolean;
		meta?: {
			description?: string;
		};
	};

	type ActionMap = Record<string, ActionItem>;

	export let actions: ActionItem[] = [];
	export let selectedActionIds: string[] = [];

	let _actions: ActionMap = {};
	let actionEntries: [string, ActionItem][] = [];

	onMount(() => {
		_actions = actions.reduce((acc: ActionMap, action) => {
			acc[action.id] = {
				...action,
				selected: selectedActionIds.includes(action.id)
			};

			return acc;
		}, {} as ActionMap);
	});

	$: actionEntries = Object.entries(_actions) as [string, ActionItem][];
</script>

{#if actions.length > 0}
	<div>
		<div class="flex w-full justify-between mb-1">
			<div class=" self-center text-xs font-medium text-gray-500">{$i18n.t('Actions')}</div>
		</div>

	<div class="flex flex-col">
			<div class=" flex items-center flex-wrap">
				{#each actionEntries as [, action]}
					<div class=" flex items-center gap-2 mr-3">
						<div class="self-center flex items-center">
							<Checkbox
								state={action.is_global
									? 'checked'
									: action.selected
										? 'checked'
										: 'unchecked'}
								disabled={action.is_global}
								on:change={(e) => {
									if (!action.is_global) {
										action.selected = e.detail === 'checked';
										selectedActionIds = actionEntries
											.filter(([, item]) => item.selected)
											.map(([id]) => id);
									}
								}}
							/>
						</div>

						<div class=" py-0.5 text-sm w-full capitalize font-medium">
							<Tooltip content={action.meta?.description ?? action.name}>
								{action.name}
							</Tooltip>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
