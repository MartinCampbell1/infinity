<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	import HermesEmbeddedWorkspaceFrame from '$lib/components/hermes/workspace/HermesEmbeddedWorkspaceFrame.svelte';
	import { founderosHostContext } from '$lib/founderos/bridge';
	import { founderosLaunchContext } from '$lib/founderos';
	import { buildFounderosScopedHref, buildFounderosShellHref } from '$lib/founderos/navigation';
	import { resolveFounderosShellOrigin } from '$lib/founderos/shell-origin';
	import { getOrchestrationBrief, updateOrchestrationBrief } from '$lib/apis/orchestration/briefs';
	import type { TaskGraphRecord } from '$lib/apis/orchestration/types';
	import { createAutoRefreshLoop } from '$lib/orchestration/auto-refresh';
	import { buildProjectBriefUpdateRequest } from '$lib/orchestration/brief-builder';
	import { loadLatestBatchProgress, summarizeBatchProgress } from '$lib/orchestration/batch-progress';
	import { launchPlannerForBrief, loadTaskGraphForBrief } from '$lib/orchestration/planner-launch';
	import type {
		ExecutionBatchDetailResponse,
		ProjectBriefClarificationEntry,
		ProjectBriefRecord,
		ProjectBriefStatus
	} from '$lib/apis/orchestration/types';

	let loadState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
	let saveState: 'idle' | 'saving' = 'idle';
	let errorMessage = '';
	let loadedBriefId = '';
	let brief: ProjectBriefRecord | null = null;
	let initiativeId = '';
	let initiativeTitle = '';
	let initiativeStatus = '';
	let taskGraph: TaskGraphRecord | null = null;
	let latestBatchProgress: ExecutionBatchDetailResponse | null = null;
	let summary = '';
	let goalsText = '';
	let nonGoalsText = '';
	let constraintsText = '';
	let assumptionsText = '';
	let acceptanceCriteriaText = '';
	let repoScopeText = '';
	let deliverablesText = '';
	let clarificationLog: ProjectBriefClarificationEntry[] = [];
	let briefStatus: ProjectBriefStatus = 'clarifying';

	$: briefId = $page.params.id;
	$: shellOrigin = resolveFounderosShellOrigin(
		$founderosLaunchContext,
		browser ? window.location.origin : null
	);
	$: metaItems = [
		initiativeTitle || $founderosHostContext?.projectName || 'Infinity',
		(taskGraph?.status ?? initiativeStatus) || briefStatus
	];
	$: taskGraphShellHref =
		taskGraph && shellOrigin
			? buildFounderosShellHref(
					`/execution/task-graphs/${encodeURIComponent(taskGraph.id)}?initiative_id=${encodeURIComponent(taskGraph.initiativeId)}`,
					$founderosLaunchContext,
					shellOrigin
				)
			: null;
	$: continuityShellHref =
		initiativeId && shellOrigin
			? buildFounderosShellHref(
					`/execution/continuity/${encodeURIComponent(initiativeId)}`,
					$founderosLaunchContext,
					shellOrigin
				)
			: null;
	$: shellReturnHref = shellOrigin
		? buildFounderosShellHref(
				$founderosHostContext?.sessionId
					? `/execution/workspace/${encodeURIComponent($founderosHostContext.sessionId)}`
					: '/execution',
				$founderosLaunchContext,
				shellOrigin
			)
		: null;
	$: projectRunHref = initiativeId
		? buildFounderosScopedHref(`/project-run/${encodeURIComponent(initiativeId)}`, $founderosLaunchContext)
		: null;
	$: projectResultHref = initiativeId
		? buildFounderosScopedHref(`/project-result/${encodeURIComponent(initiativeId)}`, $founderosLaunchContext)
		: null;
	$: batchSummary = summarizeBatchProgress(latestBatchProgress);

	const linesToText = (values: string[]) => values.join('\n');

	const syncBrief = async (nextBriefId: string) => {
		const response = await getOrchestrationBrief(nextBriefId, { shellOrigin });
		brief = response.brief;
		initiativeId = response.initiative?.id ?? '';
		initiativeTitle = response.initiative?.title ?? '';
		initiativeStatus = response.initiative?.status ?? '';
		applyBrief(response.brief);
		taskGraph = await loadTaskGraphForBrief(response.brief.id, { shellOrigin });
		latestBatchProgress = taskGraph
			? await loadLatestBatchProgress(taskGraph.id, { shellOrigin })
			: null;

		return response;
	};

	const applyBrief = (record: ProjectBriefRecord) => {
		summary = record.summary;
		goalsText = linesToText(record.goals);
		nonGoalsText = linesToText(record.nonGoals);
		constraintsText = linesToText(record.constraints);
		assumptionsText = linesToText(record.assumptions);
		acceptanceCriteriaText = linesToText(record.acceptanceCriteria);
		repoScopeText = linesToText(record.repoScope);
		deliverablesText = linesToText(record.deliverables);
		clarificationLog = record.clarificationLog.length > 0 ? [...record.clarificationLog] : [];
		briefStatus = record.status;
	};

	const loadBrief = async (nextBriefId: string) => {
		loadState = 'loading';
		errorMessage = '';

		try {
			await syncBrief(nextBriefId);
			loadState = 'ready';
		} catch (error) {
			loadState = 'error';
			errorMessage = error instanceof Error ? error.message : 'Failed to load the brief.';
		}
	};

	const refreshBrief = async () => {
		if (!briefId || loadState === 'loading' || saveState === 'saving') {
			return;
		}

		try {
			await syncBrief(briefId);
			if (loadState !== 'ready') {
				loadState = 'ready';
			}
		} catch {
			// Keep the last loaded state visible if a background refresh fails.
		}
	};

	$: if (briefId && briefId !== loadedBriefId) {
		loadedBriefId = briefId;
		void loadBrief(briefId);
	}

	onMount(() => {
		const loop = createAutoRefreshLoop(() => refreshBrief(), {
			intervalMs: 8000,
			immediate: false,
			enabled: () => loadState === 'ready' && saveState !== 'saving' && !!briefId
		});

		return loop.start();
	});

	const saveBrief = async (status: ProjectBriefStatus) => {
		if (!brief) {
			return;
		}

		saveState = 'saving';
		errorMessage = '';

		try {
			const response = await updateOrchestrationBrief(
				brief.id,
				buildProjectBriefUpdateRequest({
					summary,
					goalsText,
					nonGoalsText,
					constraintsText,
					assumptionsText,
					acceptanceCriteriaText,
					repoScopeText,
					deliverablesText,
					clarificationLog,
					status
				}),
				{ shellOrigin }
			);
			brief = response.brief;
			initiativeId = response.initiative?.id ?? initiativeId;
			initiativeTitle = response.initiative?.title ?? initiativeTitle;
			initiativeStatus = response.initiative?.status ?? initiativeStatus;
			applyBrief(response.brief);
			taskGraph =
				response.taskGraph ??
				(await loadTaskGraphForBrief(response.brief.id, {
					shellOrigin
				}));
			latestBatchProgress = taskGraph
				? await loadLatestBatchProgress(taskGraph.id, { shellOrigin })
				: null;
			void refreshBrief();
			saveState = 'idle';
		} catch (error) {
			saveState = 'idle';
			errorMessage = error instanceof Error ? error.message : 'Failed to save the brief.';
		}
	};

	const addClarificationRow = () => {
		clarificationLog = [...clarificationLog, { question: '', answer: '' }];
	};

	const triggerPlanner = async () => {
		if (!brief) {
			return;
		}

		saveState = 'saving';
		errorMessage = '';

		try {
			taskGraph = await launchPlannerForBrief(brief.id, { shellOrigin });
			initiativeStatus = 'planning';
			latestBatchProgress = taskGraph
				? await loadLatestBatchProgress(taskGraph.id, { shellOrigin })
				: null;
			void refreshBrief();
		} catch (error) {
			errorMessage =
				error instanceof Error ? error.message : 'Failed to launch the planner.';
		} finally {
			saveState = 'idle';
		}
	};

	const updateClarificationRow = (
		index: number,
		field: 'question' | 'answer',
		value: string
	) => {
		clarificationLog = clarificationLog.map((entry, entryIndex) =>
			entryIndex === index ? { ...entry, [field]: value } : entry
		);
	};
</script>

<svelte:head>
	<title>Project Brief</title>
</svelte:head>

<HermesEmbeddedWorkspaceFrame
	title="Project brief"
	subtitle="Secondary brief drill-down for clarification, inspection, and recovery while the shell stays primary."
	badge={saveState === 'saving' ? 'Saving' : loadState === 'ready' ? 'Ready' : 'Loading'}
	metaItems={metaItems}
>
			{#if loadState === 'loading' || loadState === 'idle'}
				<div class="rounded-[24px] border border-white/8 bg-slate-900/80 px-5 py-5 text-sm text-slate-200">
					Loading brief…
				</div>
			{:else if loadState === 'error' || !brief}
				<div class="rounded-[24px] border border-rose-500/20 bg-rose-500/10 px-5 py-5 text-sm text-rose-200">
					{errorMessage || 'Brief is unavailable.'}
				</div>
			{:else}
				<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
					<form
						class="grid gap-5 rounded-[28px] border border-white/8 bg-slate-900/80 px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
						on:submit|preventDefault={() => saveBrief('reviewing')}
					>
						<div>
							<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="brief-summary">
								Summary
							</label>
							<textarea
								id="brief-summary"
								class="mt-2 min-h-[120px] w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition focus:border-slate-500"
								bind:value={summary}
							></textarea>
						</div>

						<div class="grid gap-4 md:grid-cols-2">
							<div>
								<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="brief-goals">Goals</label>
								<textarea id="brief-goals" class="mt-2 min-h-[120px] w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition focus:border-slate-500" bind:value={goalsText}></textarea>
							</div>
							<div>
								<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="brief-nongoals">Non-goals</label>
								<textarea id="brief-nongoals" class="mt-2 min-h-[120px] w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition focus:border-slate-500" bind:value={nonGoalsText}></textarea>
							</div>
							<div>
								<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="brief-constraints">Constraints</label>
								<textarea id="brief-constraints" class="mt-2 min-h-[120px] w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition focus:border-slate-500" bind:value={constraintsText}></textarea>
							</div>
							<div>
								<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="brief-assumptions">Assumptions</label>
								<textarea id="brief-assumptions" class="mt-2 min-h-[120px] w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition focus:border-slate-500" bind:value={assumptionsText}></textarea>
							</div>
							<div>
								<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="brief-acceptance">Acceptance criteria</label>
								<textarea id="brief-acceptance" class="mt-2 min-h-[120px] w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition focus:border-slate-500" bind:value={acceptanceCriteriaText}></textarea>
							</div>
							<div>
								<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="brief-deliverables">Deliverables</label>
								<textarea id="brief-deliverables" class="mt-2 min-h-[120px] w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition focus:border-slate-500" bind:value={deliverablesText}></textarea>
							</div>
						</div>

						<div>
							<label class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400" for="brief-reposcope">Repo scope</label>
							<textarea id="brief-reposcope" class="mt-2 min-h-[100px] w-full rounded-[24px] border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100 outline-none transition focus:border-slate-500" bind:value={repoScopeText}></textarea>
						</div>

						<div class="rounded-[24px] border border-white/8 bg-slate-950/70 px-4 py-4">
							<div class="flex items-center justify-between gap-3">
								<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
									Clarification log
								</div>
								<button
									type="button"
									class="rounded-full border border-white/10 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
									on:click={addClarificationRow}
								>
									Add row
								</button>
							</div>

							<div class="mt-4 space-y-3">
								{#if clarificationLog.length === 0}
									<div class="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-slate-400">
										No clarifications yet. Add the first question/answer pair if the shell needs extra context before an approval override.
									</div>
								{/if}
								{#each clarificationLog as entry, index}
									<div class="grid gap-3 rounded-2xl border border-white/10 bg-slate-900 px-3 py-3">
										<input
											class="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-slate-500"
											value={entry.question}
											on:input={(event) =>
												updateClarificationRow(
													index,
													'question',
													(event.currentTarget as HTMLInputElement).value
												)}
											placeholder="Clarifying question"
										/>
										<textarea
											class="min-h-[96px] w-full rounded-2xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm leading-7 text-slate-100 outline-none transition focus:border-slate-500"
											on:input={(event) =>
												updateClarificationRow(
													index,
													'answer',
													(event.currentTarget as HTMLTextAreaElement).value
												)}
											placeholder="Answer"
										>{entry.answer}</textarea>
									</div>
								{/each}
							</div>
						</div>

						{#if errorMessage}
							<div class="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
								{errorMessage}
							</div>
						{/if}

						<div class="flex flex-wrap gap-3">
							{#if shellReturnHref}
								<a
									class="rounded-full border border-sky-500/20 bg-sky-500/15 px-4 py-2.5 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20"
									href={shellReturnHref}
									target="_top"
								>
									Return to shell workspace
								</a>
							{/if}
							<button
								type="submit"
								class="rounded-full border border-white/10 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
								disabled={saveState === 'saving'}
							>
								Save as reviewing
							</button>
							<button
								type="button"
								class="rounded-full border border-white/10 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
								on:click={() => saveBrief('approved')}
								disabled={saveState === 'saving'}
							>
								Force approval
							</button>
						</div>
					</form>

					<aside class="grid gap-4">
						<div class="rounded-[24px] border border-white/8 bg-slate-900/80 px-4 py-4">
							<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
								Initiative
							</div>
							<div class="mt-2 text-lg font-semibold text-slate-100">
								{initiativeTitle || 'Untitled initiative'}
							</div>
							<div class="mt-2 text-sm text-slate-300">
								Status: {initiativeStatus || 'unknown'}
							</div>
						</div>

						<div class="rounded-[24px] border border-white/8 bg-slate-900/80 px-4 py-4">
							<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
								Planning
							</div>
							<div class="mt-2 text-sm leading-7 text-slate-200">
								Brief status: {briefStatus}. Initiative status: {initiativeStatus || 'unknown'}.
							</div>
							<div class="mt-2 text-sm leading-7 text-slate-200">
								{#if taskGraph}
									Task graph <code class="rounded bg-white/10 px-1 py-0.5 text-[12px]">{taskGraph.id}</code>
									is {taskGraph.status} with {taskGraph.nodeIds.length} node{taskGraph.nodeIds.length === 1 ? '' : 's'}.
								{:else}
									No task graph is attached yet. Brief approval moves this initiative to <code class="rounded bg-white/10 px-1 py-0.5 text-[12px]">brief_ready</code>; shell automation normally launches the planner after that.
								{/if}
							</div>
							<div class="mt-2 text-sm leading-7 text-slate-300">
								Use this page for clarification capture or recovery-only overrides, then return to the shell workspace for the canonical run.
							</div>
							<div class="mt-4 flex flex-wrap gap-3">
								{#if shellReturnHref}
									<a
										class="rounded-full border border-sky-500/20 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20"
										href={shellReturnHref}
										target="_top"
									>
										Return to shell workspace
									</a>
								{/if}
								{#if briefStatus === 'approved' && !taskGraph}
									<button
										type="button"
										class="rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
										on:click={triggerPlanner}
										disabled={saveState === 'saving'}
									>
										Trigger planner override
									</button>
								{/if}
								{#if taskGraphShellHref && !shellReturnHref}
									<a
										class="rounded-full border border-sky-500/20 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20"
										href={taskGraphShellHref}
										target="_top"
									>
										Open shell automation
									</a>
								{/if}
								{#if projectRunHref && projectResultHref}
									<a
										class="rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
										href={projectRunHref}
									>
										Open local drill-down
									</a>
								{/if}
							</div>
						</div>

						<div class="rounded-[24px] border border-white/8 bg-slate-900/80 px-4 py-4">
							<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
								Batch progress
							</div>
							{#if latestBatchProgress && batchSummary}
								<div class="mt-2 text-sm leading-7 text-slate-200">
									Batch <code class="rounded bg-white/10 px-1 py-0.5 text-[12px]">{latestBatchProgress.batch.id}</code>
									is {batchSummary.label}.
								</div>
								<div class="mt-2 text-sm leading-7 text-slate-200">
									Attempts: {batchSummary.attempts}. Failures: {batchSummary.failures}. Supervisor actions: {batchSummary.supervisorActions}.
								</div>
							{:else}
								<div class="mt-2 text-sm leading-7 text-slate-200">
									No batch progress is attached to this task graph yet.
								</div>
							{/if}
						</div>
					</aside>
				</div>
			{/if}
		</HermesEmbeddedWorkspaceFrame>
