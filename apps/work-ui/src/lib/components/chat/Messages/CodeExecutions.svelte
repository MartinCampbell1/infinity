<!-- @ts-nocheck -->
<script lang="ts">
	// @ts-nocheck
	import { getContext } from 'svelte';

	import { chatControlsOpenTarget, showControls } from '$lib/stores';
	import CodeExecutionModal from './CodeExecutionModal.svelte';
	import HermesToolActivityRow from '$lib/components/hermes/transcript/HermesToolActivityRow.svelte';
	import { getValidHermesGeneratedFiles } from '$lib/utils/hermesWorkspace';

	const i18n = getContext<any>('i18n');

	export let codeExecutions: any[] = [];
	export let compact = false;

	let selectedCodeExecution: any = null;
	let showCodeExecutionModal = false;

	$: if (codeExecutions) {
		updateSelectedCodeExecution();
	}

	const updateSelectedCodeExecution = () => {
		if (selectedCodeExecution) {
			selectedCodeExecution =
				codeExecutions.find((execution) => execution.id === selectedCodeExecution?.id) ?? null;
		}
	};

	const getExecutionState = (execution: any) => {
		if (!execution?.result) {
			return 'running';
		}

		if (execution.result?.error) {
			return 'failed';
		}

		return 'done';
	};

	const getExecutionSummary = (execution: any) => {
		if (!execution?.result) {
			const livePreview = execution?.preview || execution?.message || execution?.command;
			return livePreview || $i18n.t('Waiting for result');
		}

		if (execution.result?.error) {
			return execution.result.error;
		}

		const generatedFiles = getGeneratedFiles(execution);
		if (generatedFiles.length > 0) {
			return $i18n.t('Generated {{COUNT}} files', {
				COUNT: generatedFiles.length
			});
		}

		if (execution.result?.output) {
			return $i18n.t('Output ready');
		}

		if (execution.result?.message) {
			return execution.result.message;
		}

		if (execution.result?.content) {
			return execution.result.content;
		}

		return $i18n.t('Completed');
	};

	const getGeneratedFiles = (execution: any) =>
		getValidHermesGeneratedFiles(execution?.result?.files);

	const getGeneratedFileCount = (execution: any) => getGeneratedFiles(execution).length;

	const openWorkspace = () => {
		chatControlsOpenTarget.set('workspace');
		showControls.set(true);
	};
</script>

<CodeExecutionModal
	bind:show={showCodeExecutionModal}
	codeExecution={selectedCodeExecution as any}
/>

{#if codeExecutions.length > 0}
	<div class="w-full flex flex-col gap-1 {compact ? '' : 'mt-1 mb-2'}">
		{#each codeExecutions as execution (execution.id)}
			<HermesToolActivityRow
				name={execution.name}
				summary={getExecutionSummary(execution)}
				state={getExecutionState(execution)}
				actionLabel={getGeneratedFileCount(execution) > 0 ? $i18n.t('Workspace') : ''}
				actionAriaLabel={$i18n.t('Open generated files in workspace')}
				onClick={() => {
					selectedCodeExecution = execution;
					showCodeExecutionModal = true;
				}}
				onActionClick={openWorkspace}
			/>
		{/each}
	</div>
{/if}
