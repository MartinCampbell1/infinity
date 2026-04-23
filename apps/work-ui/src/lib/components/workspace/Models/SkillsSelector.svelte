<script lang="ts">
	import Checkbox from '$lib/components/common/Checkbox.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import { getContext, onMount } from 'svelte';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';

	import { getSkillItems } from '$lib/apis/skills';

	type SkillItem = {
		id: string;
		name: string;
		description?: string;
		selected?: boolean;
	};

	type SkillMap = Record<string, SkillItem>;

	export let selectedSkillIds: string[] = [];

	let _skills: SkillMap = {};
	let skillEntries: [string, SkillItem][] = [];

	const i18n = getContext('i18n');
	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	onMount(async () => {
		const res = await getSkillItems(getWorkspaceAuthToken()).catch(() => null);
		const skills = (res?.items ?? []) as SkillItem[];
		_skills = skills.reduce((acc: SkillMap, skill) => {
			acc[skill.id] = {
				...skill,
				selected: selectedSkillIds.includes(skill.id)
			};

			return acc;
		}, {} as SkillMap);
	});

	$: skillEntries = Object.entries(_skills) as [string, SkillItem][];
</script>

<div>
	<div class="flex w-full justify-between mb-1">
		<div class=" self-center text-xs font-medium text-gray-500">{$i18n.t('Skills')}</div>
	</div>

	<div class="flex flex-col mb-1">
		{#if skillEntries.length > 0}
			<div class=" flex items-center flex-wrap">
				{#each skillEntries as [, skill]}
					<div class=" flex items-center gap-2 mr-3">
						<div class="self-center flex items-center">
							<Checkbox
								state={skill.selected ? 'checked' : 'unchecked'}
								on:change={(e) => {
									skill.selected = e.detail === 'checked';
									selectedSkillIds = skillEntries
										.filter(([, item]) => item.selected)
										.map(([id]) => id);
								}}
							/>
						</div>

						<Tooltip content={skill.description ?? skill.id}>
							<div class=" py-0.5 text-sm w-full capitalize font-medium">
								{skill.name}
							</div>
						</Tooltip>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class=" text-xs dark:text-gray-700">
		{$i18n.t('To select skills here, add them to the "Skills" workspace first.')}
	</div>
</div>
