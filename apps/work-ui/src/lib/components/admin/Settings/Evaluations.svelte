<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { models, settings, user, config } from '$lib/stores';
	import { createEventDispatcher, onMount, getContext } from 'svelte';
	import { resolveFounderosEmbeddedAccessToken } from '$lib/founderos/credentials';

	const dispatch = createEventDispatcher();
	import { getModels } from '$lib/apis';
	import { getConfig, updateConfig } from '$lib/apis/evaluations';
	import type { DirectConnectionsConfig } from '$lib/components/connection-types';

	import Switch from '$lib/components/common/Switch.svelte';
	import Spinner from '$lib/components/common/Spinner.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Plus from '$lib/components/icons/Plus.svelte';
	import Model from './Evaluations/Model.svelte';
	import ArenaModelModal from './Evaluations/ArenaModelModal.svelte';

	const i18n = getContext('i18n');

	type EvaluationArenaModel = {
		id: string;
		name: string;
		[key: string]: unknown;
	};

	type EvaluationConfig = {
		ENABLE_EVALUATION_ARENA_MODELS: boolean;
		EVALUATION_ARENA_MODELS: EvaluationArenaModel[];
		[key: string]: unknown;
	};

	type DirectConnections = DirectConnectionsConfig | object | null;

	const getDirectConnections = (): DirectConnections =>
		$config?.features?.enable_direct_connections ? ($settings?.directConnections ?? null) : null;
	const getWorkspaceAuthToken = () => resolveFounderosEmbeddedAccessToken();

	let evaluationConfig: EvaluationConfig | null = null;
	let showAddModel = false;

	const refreshModels = async () => {
		models.set(await getModels(getWorkspaceAuthToken(), getDirectConnections()));
	};

	const submitHandler = async () => {
		if (!evaluationConfig) {
			return;
		}

		evaluationConfig = await updateConfig(getWorkspaceAuthToken(), evaluationConfig).catch((err) => {
			toast.error(err);
			return null;
		});

		if (evaluationConfig) {
			toast.success($i18n.t('Settings saved successfully!'));
			await refreshModels();
		}
	};

	const addModelHandler = async (model: EvaluationArenaModel) => {
		if (!evaluationConfig) {
			return;
		}

		evaluationConfig.EVALUATION_ARENA_MODELS.push(model);
		evaluationConfig.EVALUATION_ARENA_MODELS = [...evaluationConfig.EVALUATION_ARENA_MODELS];

		await submitHandler();
		await refreshModels();
	};

	const editModelHandler = async (model: EvaluationArenaModel, modelIdx: number) => {
		if (!evaluationConfig) {
			return;
		}

		evaluationConfig.EVALUATION_ARENA_MODELS[modelIdx] = model;
		evaluationConfig.EVALUATION_ARENA_MODELS = [...evaluationConfig.EVALUATION_ARENA_MODELS];

		await submitHandler();
		await refreshModels();
	};

	const deleteModelHandler = async (modelIdx: number) => {
		if (!evaluationConfig) {
			return;
		}

		evaluationConfig.EVALUATION_ARENA_MODELS = evaluationConfig.EVALUATION_ARENA_MODELS.filter(
			(m, mIdx) => mIdx !== modelIdx
		);

		await submitHandler();
		await refreshModels();
	};

	const loadConfig = async () => {
		if ($user?.role === 'admin') {
			evaluationConfig = await getConfig(getWorkspaceAuthToken()).catch((err) => {
				toast.error(err);
				return null;
			});
		}
	};

	onMount(() => {
		void loadConfig();
	});
</script>

<ArenaModelModal
	bind:show={showAddModel}
	on:submit={(e: CustomEvent<EvaluationArenaModel>) => {
		addModelHandler(e.detail);
	}}
/>

<form
	class="flex flex-col h-full justify-between text-sm"
	on:submit|preventDefault={() => {
		submitHandler();
		dispatch('save');
	}}
>
	<div class="overflow-y-scroll scrollbar-hidden h-full">
		{#if evaluationConfig !== null}
			<div class="">
				<div class="mb-3">
					<div class=" mt-0.5 mb-2.5 text-base font-medium">{$i18n.t('General')}</div>

					<hr class=" border-gray-100/30 dark:border-gray-850/30 my-2" />

					<div class="mb-2.5 flex w-full justify-between">
						<div class=" text-xs font-medium">{$i18n.t('Arena Models')}</div>

						<Tooltip content={$i18n.t(`Message rating should be enabled to use this feature`)}>
							<Switch bind:state={evaluationConfig.ENABLE_EVALUATION_ARENA_MODELS} />
						</Tooltip>
					</div>
				</div>

				{#if evaluationConfig.ENABLE_EVALUATION_ARENA_MODELS}
					<div class="mb-3">
						<div class=" mt-0.5 mb-2.5 text-base font-medium flex justify-between items-center">
							<div>
								{$i18n.t('Manage')}
							</div>

							<div>
								<Tooltip content={$i18n.t('Add Arena Model')}>
									<button
										class="p-1"
										type="button"
										on:click={() => {
											showAddModel = true;
										}}
									>
										<Plus />
									</button>
								</Tooltip>
							</div>
						</div>

						<hr class=" border-gray-100/30 dark:border-gray-850/30 my-2" />

						<div class="flex flex-col gap-2">
							{#if (evaluationConfig?.EVALUATION_ARENA_MODELS ?? []).length > 0}
								{#each evaluationConfig.EVALUATION_ARENA_MODELS as model, index}
									<Model
										{model}
										on:edit={(e: CustomEvent<EvaluationArenaModel>) => {
											editModelHandler(e.detail, index);
										}}
										on:delete={() => {
											deleteModelHandler(index);
										}}
									/>
								{/each}
							{:else}
								<div class=" text-center text-xs text-gray-500">
									{$i18n.t(
										`Using the default arena model with all models. Click the plus button to add custom models.`
									)}
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="flex h-full justify-center">
				<div class="my-auto">
					<Spinner className="size-6" />
				</div>
			</div>
		{/if}
	</div>

	<div class="flex justify-end pt-3 text-sm font-medium">
		<button
			class="px-3.5 py-1.5 text-sm font-medium bg-black hover:bg-gray-900 text-white dark:bg-white dark:text-black dark:hover:bg-gray-100 transition rounded-full"
			type="submit"
		>
			{$i18n.t('Save')}
		</button>
	</div>
</form>
