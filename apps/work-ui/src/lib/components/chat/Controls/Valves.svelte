<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';

	import { functions, tools } from '$lib/stores';
	import { createEventDispatcher, getContext, tick } from 'svelte';

	import {
		getUserValvesSpecById as getToolUserValvesSpecById,
		getUserValvesById as getToolUserValvesById,
		updateUserValvesById as updateToolUserValvesById,
		getTools
	} from '$lib/apis/tools';
	import {
		getUserValvesSpecById as getFunctionUserValvesSpecById,
		getUserValvesById as getFunctionUserValvesById,
		updateUserValvesById as updateFunctionUserValvesById,
		getFunctions
	} from '$lib/apis/functions';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import Valves from '$lib/components/common/Valves.svelte';

	const dispatch = createEventDispatcher();

	const i18n = getContext('i18n');

	export let show = false;

	type ValveValue = string | string[] | boolean | number | null;
	type ValveRecord = Record<string, ValveValue>;
	type ValvePropertySpec = {
		type?: string | null;
		title?: string | null;
		description?: string | null;
		default?: unknown;
		enum?: unknown[] | null;
		input?: {
			type?: string | null;
			options?: unknown[] | null;
		} | null;
	};
	type ValveSpec = {
		properties: Record<string, ValvePropertySpec>;
		required?: string[] | null;
	};
	type ChoiceItem = {
		id: string;
		name?: string | null;
	};

	let tab: 'tools' | 'functions' = 'tools';
	let selectedId = '';

	let loading = false;

	let valvesSpec: ValveSpec | null = null;
	let valves: ValveRecord = {};

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	let availableTools: ChoiceItem[] = [];
	let availableFunctions: ChoiceItem[] = [];
	let toolChoices: ChoiceItem[] = [];
	let functionChoices: ChoiceItem[] = [];

	const sortByName = (a: ChoiceItem, b: ChoiceItem) =>
		(a.name ?? '').localeCompare(b.name ?? '');

	const isArraySpec = (propertySpec?: ValvePropertySpec | null) =>
		(propertySpec?.type ?? null) === 'array';

	const isChoiceItem = (item: ChoiceItem | null | undefined): item is ChoiceItem =>
		Boolean(item?.id);

	const normalizeArrayFieldToString = (value: ValveValue) => {
		if (Array.isArray(value)) {
			return value.join(',');
		}

		if (value == null) {
			return '';
		}

		return String(value);
	};

	const normalizeArrayFieldToList = (value: ValveValue) => {
		if (Array.isArray(value)) {
			return value.map((item) => String(item).trim());
		}

		if (typeof value === 'string') {
			return value
				.split(',')
				.map((item) => item.trim())
				.filter((item) => item.length > 0);
		}

		return [];
	};

	const normalizeValvesForDisplay = (nextValves: ValveRecord, spec: ValveSpec | null) => {
		const normalized: ValveRecord = { ...nextValves };

		if (spec) {
			for (const property of Object.keys(spec.properties ?? {})) {
				if (isArraySpec(spec.properties[property])) {
					normalized[property] = normalizeArrayFieldToString(normalized[property]);
				}
			}
		}

		return normalized;
	};

	const normalizeValvesForSubmit = (nextValves: ValveRecord, spec: ValveSpec | null) => {
		const normalized: ValveRecord = { ...nextValves };

		if (spec) {
			for (const property of Object.keys(spec.properties ?? {})) {
				if (isArraySpec(spec.properties[property])) {
					normalized[property] = normalizeArrayFieldToList(normalized[property]);
				}
			}
		}

		return normalized;
	};

	const debounceSubmitHandler = async () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		// Set a new timer
		debounceTimer = setTimeout(() => {
			submitHandler();
		}, 500); // 0.5 second debounce
	};

	const getUserValves = async () => {
		loading = true;
		if (tab === 'tools') {
			valves = (await getToolUserValvesById(getWorkspaceAuthToken(), selectedId)) ?? {};
			valvesSpec = await getToolUserValvesSpecById(getWorkspaceAuthToken(), selectedId);
		} else if (tab === 'functions') {
			valves = (await getFunctionUserValvesById(getWorkspaceAuthToken(), selectedId)) ?? {};
			valvesSpec = await getFunctionUserValvesSpecById(getWorkspaceAuthToken(), selectedId);
		}

		valves = normalizeValvesForDisplay(valves, valvesSpec);

		loading = false;
	};

	const submitHandler = async () => {
		if (valvesSpec) {
			const payload = normalizeValvesForSubmit(valves, valvesSpec);

			if (tab === 'tools') {
				const res = await updateToolUserValvesById(
					getWorkspaceAuthToken(),
					selectedId,
					payload
				).catch((error) => {
					toast.error(`${error}`);
					return null;
				});

				if (res) {
					toast.success($i18n.t('Valves updated'));
					valves = normalizeValvesForDisplay(res, valvesSpec);
				}
			} else if (tab === 'functions') {
				const res = await updateFunctionUserValvesById(
					getWorkspaceAuthToken(),
					selectedId,
					payload
				).catch((error) => {
					toast.error(`${error}`);
					return null;
				});

				if (res) {
					toast.success($i18n.t('Valves updated'));
					valves = normalizeValvesForDisplay(res, valvesSpec);
				}
			}
		}
	};

	$: if (tab) {
		selectedId = '';
	}

	$: if (selectedId) {
		getUserValves();
	}

	$: if (show) {
		init();
	}

	const init = async () => {
		loading = true;

		if ($functions === null) {
			functions.set(await getFunctions(getWorkspaceAuthToken()));
		}
		if ($tools === null) {
			tools.set(await getTools(getWorkspaceAuthToken()));
		}

		loading = false;
	};

	$: toolChoices = Array.isArray($tools) ? (($tools as unknown) as ChoiceItem[]) : [];
	$: functionChoices = Array.isArray($functions) ? (($functions as unknown) as ChoiceItem[]) : [];
	$: availableTools = toolChoices.filter(isChoiceItem).filter((tool) => !tool.id.startsWith('server:')).slice().sort(sortByName);
	$: availableFunctions = functionChoices.filter(isChoiceItem).slice().sort(sortByName);
</script>

{#if show && !loading}
	<form
		class="flex flex-col h-full justify-between space-y-3 text-sm"
		on:submit|preventDefault={() => {
			submitHandler();
			dispatch('save');
		}}
	>
		<div class="flex flex-col">
			<div class="space-y-1">
				<div class="flex gap-2">
					<div class="flex-1">
						<select
							class="  w-full rounded-sm text-xs py-2 px-1 bg-transparent outline-hidden"
							bind:value={tab}
							placeholder={$i18n.t('Select')}
						>
							<option value="tools" class="bg-gray-100 dark:bg-gray-800">{$i18n.t('Tools')}</option>
							<option value="functions" class="bg-gray-100 dark:bg-gray-800"
								>{$i18n.t('Functions')}</option
							>
						</select>
					</div>

					<div class="flex-1">
						<select
							class="w-full rounded-sm py-2 px-1 text-xs bg-transparent outline-hidden"
							bind:value={selectedId}
							on:change={async () => {
								await tick();
							}}
						>
							{#if tab === 'tools'}
								<option value="" selected disabled class="bg-gray-100 dark:bg-gray-800"
									>{$i18n.t('Select a tool')}</option
								>

								{#each availableTools as tool}
									<option value={tool.id} class="bg-gray-100 dark:bg-gray-800">{tool.name}</option>
								{/each}
							{:else if tab === 'functions'}
								<option value="" selected disabled class="bg-gray-100 dark:bg-gray-800"
									>{$i18n.t('Select a function')}</option
								>

								{#each availableFunctions as func}
									<option value={func.id} class="bg-gray-100 dark:bg-gray-800">{func.name}</option>
								{/each}
							{/if}
						</select>
					</div>
				</div>
			</div>

			{#if selectedId}
				<hr class="border-gray-50/30 dark:border-gray-800/30 my-1 w-full" />

				<div class="my-2 text-xs">
					{#if !loading}
						<Valves
							{valvesSpec}
							bind:valves
							on:change={() => {
								debounceSubmitHandler();
							}}
						/>
					{:else}
						<Spinner className="size-5" />
					{/if}
				</div>
			{/if}
		</div>
	</form>
{:else}
	<Spinner className="size-4" />
{/if}
