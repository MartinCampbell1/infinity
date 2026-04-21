<script lang="ts">
	import Checkbox from '$lib/components/common/Checkbox.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import { getContext, onMount } from 'svelte';

	type ToolItem = {
		id: string;
		name: string;
		meta?: {
			description?: string;
		};
		selected?: boolean;
	};

	type ToolMap = Record<string, ToolItem>;

	export let tools: ToolItem[] = [];
	export let selectedToolIds: string[] = [];

	let _tools: ToolMap = {};
	let toolEntries: [string, ToolItem][] = [];

	const i18n = getContext('i18n');

	onMount(() => {
		_tools = tools.reduce((acc: ToolMap, tool) => {
			acc[tool.id] = {
				...tool,
				selected: selectedToolIds.includes(tool.id)
			};

			return acc;
		}, {} as ToolMap);
	});

	$: toolEntries = Object.entries(_tools) as [string, ToolItem][];
</script>

<div>
	<div class="flex w-full justify-between mb-1">
		<div class=" self-center text-xs font-medium text-gray-500">{$i18n.t('Tools')}</div>
	</div>

	<div class="flex flex-col mb-1">
		{#if tools.length > 0}
			<div class=" flex items-center flex-wrap">
				{#each toolEntries as [, tool]}
					<div class=" flex items-center gap-2 mr-3">
						<div class="self-center flex items-center">
							<Checkbox
								state={tool.selected ? 'checked' : 'unchecked'}
								on:change={(e) => {
									tool.selected = e.detail === 'checked';
									selectedToolIds = toolEntries
										.filter(([, item]) => item.selected)
										.map(([id]) => id);
								}}
							/>
						</div>

						<Tooltip content={tool.meta?.description ?? tool.id}>
							<div class=" py-0.5 text-sm w-full capitalize font-medium">
								{tool.name}
							</div>
						</Tooltip>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class=" text-xs dark:text-gray-700">
		{$i18n.t('To select toolkits here, add them to the "Tools" workspace first.')}
	</div>
</div>
