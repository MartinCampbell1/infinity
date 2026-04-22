<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	import HermesEmbeddedWorkspaceFrame from '$lib/components/hermes/workspace/HermesEmbeddedWorkspaceFrame.svelte';
	import { founderosHostContext } from '$lib/founderos/bridge';
	import { founderosLaunchContext } from '$lib/founderos';
	import { buildFounderosScopedHref, buildFounderosShellHref } from '$lib/founderos/navigation';
	import { resolveFounderosShellOrigin } from '$lib/founderos/shell-origin';
	import { createOrchestrationAssembly, getOrchestrationAssemblies } from '$lib/apis/orchestration/assembly';
	import { getOrchestrationTaskGraphs } from '$lib/apis/orchestration/task-graphs';
	import { createAutoRefreshLoop } from '$lib/orchestration/auto-refresh';
	import { loadInitiativeContinuity, type InitiativeContinuitySummary } from '$lib/orchestration/continuity';
	import { loadLatestBatchProgress, summarizeBatchProgress } from '$lib/orchestration/batch-progress';
	import { canCreateAssembly, getAssemblyBlockReason } from '$lib/orchestration/execution-gates';
	import type { AssemblyRecord, ExecutionBatchDetailResponse, TaskGraphRecord } from '$lib/apis/orchestration/types';

	let loadState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
	let actionState: 'idle' | 'running' = 'idle';
	let errorMessage = '';
	let loadedInitiativeId = '';
	let initiativeId = '';
	let taskGraph: TaskGraphRecord | null = null;
	let assembly: AssemblyRecord | null = null;
	let batchProgress: ExecutionBatchDetailResponse | null = null;
	let continuity: InitiativeContinuitySummary | null = null;
	let loadRevision = 0;

	$: shellOrigin = resolveFounderosShellOrigin(
		$founderosLaunchContext,
		browser ? window.location.origin : null
	);
	$: currentInitiativeId = $page.params.id;
	$: metaItems = [
		currentInitiativeId ?? '',
		taskGraph?.status ?? batchProgress?.batch.status ?? 'pending'
	];
	$: projectResultHref = initiativeId
		? buildFounderosScopedHref(`/project-result/${encodeURIComponent(initiativeId)}`, $founderosLaunchContext)
		: null;
	$: taskGraphShellHref =
		taskGraph && shellOrigin
			? buildFounderosShellHref(
					`/execution/task-graphs/${encodeURIComponent(taskGraph.id)}?initiative_id=${encodeURIComponent(taskGraph.initiativeId)}`,
					$founderosLaunchContext,
					shellOrigin
				)
			: null;
	$: batchShellHref = continuity?.links.batchHref && shellOrigin
		? buildFounderosShellHref(continuity.links.batchHref, $founderosLaunchContext, shellOrigin)
		: batchProgress && shellOrigin
			? buildFounderosShellHref(
					`/execution/batches/${encodeURIComponent(batchProgress.batch.id)}?initiative_id=${encodeURIComponent(batchProgress.batch.initiativeId)}&task_graph_id=${encodeURIComponent(batchProgress.batch.taskGraphId)}`,
					$founderosLaunchContext,
					shellOrigin
				)
			: null;
	$: continuityShellHref = continuity && shellOrigin
		? buildFounderosShellHref(
				continuity.links.continuityHref,
				$founderosLaunchContext,
				shellOrigin
			)
		: initiativeId && shellOrigin
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
	$: batchSummary = summarizeBatchProgress(batchProgress);
	$: canAssemble = canCreateAssembly(taskGraph);
	$: assemblyBlockReason = getAssemblyBlockReason(taskGraph, batchProgress);

	type RunSnapshot = {
		initiativeId: string;
		taskGraph: TaskGraphRecord | null;
		assembly: AssemblyRecord | null;
		batchProgress: ExecutionBatchDetailResponse | null;
		continuity: InitiativeContinuitySummary | null;
	};

	const readRunSnapshot = async (nextInitiativeId: string): Promise<RunSnapshot> => {
		const [taskGraphsResponse, assembliesResponse] = await Promise.all([
			getOrchestrationTaskGraphs({ initiativeId: nextInitiativeId }, { shellOrigin }),
			getOrchestrationAssemblies({ initiativeId: nextInitiativeId }, { shellOrigin })
		]);
		const nextTaskGraph = taskGraphsResponse.taskGraphs[0] ?? null;
		return {
			initiativeId: nextInitiativeId,
			taskGraph: nextTaskGraph,
			assembly: assembliesResponse.assemblies[0] ?? null,
			batchProgress: nextTaskGraph
				? await loadLatestBatchProgress(nextTaskGraph.id, { shellOrigin })
				: null,
			continuity: await loadInitiativeContinuity(nextInitiativeId, { shellOrigin }).catch(() => null)
		};
	};

	const applyRunSnapshot = (snapshot: RunSnapshot) => {
		initiativeId = snapshot.initiativeId;
		taskGraph = snapshot.taskGraph;
		assembly = snapshot.assembly;
		batchProgress = snapshot.batchProgress;
		continuity = snapshot.continuity;
	};

	const loadRun = async (nextInitiativeId: string) => {
		const revision = ++loadRevision;
		loadState = 'loading';
		errorMessage = '';

		try {
			const snapshot = await readRunSnapshot(nextInitiativeId);
			if (revision !== loadRevision || currentInitiativeId !== nextInitiativeId) {
				return;
			}
			applyRunSnapshot(snapshot);
			loadState = 'ready';
		} catch (error) {
			if (revision !== loadRevision || currentInitiativeId !== nextInitiativeId) {
				return;
			}
			loadState = 'error';
			errorMessage = error instanceof Error ? error.message : 'Failed to load the project run.';
		}
	};

	const refreshRun = async () => {
		if (!initiativeId || loadState === 'loading' || actionState === 'running') {
			return;
		}

		const targetInitiativeId = initiativeId;
		const revision = ++loadRevision;
		try {
			const snapshot = await readRunSnapshot(targetInitiativeId);
			if (revision !== loadRevision || initiativeId !== targetInitiativeId) {
				return;
			}
			applyRunSnapshot(snapshot);
			if (loadState !== 'ready') {
				loadState = 'ready';
			}
		} catch {
			// Preserve the last known run state during background refresh failures.
		}
	};

	$: if (currentInitiativeId && currentInitiativeId !== loadedInitiativeId) {
		loadedInitiativeId = currentInitiativeId;
		void loadRun(currentInitiativeId);
	}

	onMount(() => {
		const loop = createAutoRefreshLoop(() => refreshRun(), {
			intervalMs: 8000,
			immediate: false,
			enabled: () => loadState === 'ready' && actionState !== 'running' && !!initiativeId
		});

		return loop.start();
	});

	const createAssembly = async () => {
		if (!initiativeId) {
			return;
		}

		actionState = 'running';
		errorMessage = '';
		try {
			const response = await createOrchestrationAssembly({ initiativeId }, { shellOrigin });
			assembly = response.assembly;
			void refreshRun();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to create assembly.';
		} finally {
			actionState = 'idle';
		}
	};
</script>

<svelte:head>
	<title>Project Run</title>
</svelte:head>

<HermesEmbeddedWorkspaceFrame
	title="Project run"
	subtitle="Secondary planner and assembly drill-down while the shell workspace remains the canonical run surface."
	badge={actionState === 'running' ? 'Working' : loadState === 'ready' ? 'Ready' : 'Loading'}
	metaItems={metaItems}
>
			{#if loadState === 'loading' || loadState === 'idle'}
				<div class="rounded-[24px] border border-white/8 bg-slate-900/80 px-5 py-5 text-sm text-slate-200">
					Loading project run…
				</div>
			{:else if loadState === 'error'}
				<div class="rounded-[24px] border border-rose-500/20 bg-rose-500/10 px-5 py-5 text-sm text-rose-200">
					{errorMessage}
				</div>
			{:else}
				<div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
					<section class="grid gap-5 rounded-[28px] border border-white/8 bg-slate-900/80 px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
						<div>
							<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
								Task graph
							</div>
							<div class="mt-2 text-sm leading-7 text-slate-200">
								{#if taskGraph}
									{taskGraph.id} · {taskGraph.status} · {taskGraph.nodeIds.length} node{taskGraph.nodeIds.length === 1 ? '' : 's'}
								{:else}
									No task graph is attached yet. It is usually created automatically after the brief is approved.
								{/if}
							</div>
						</div>

						<div>
							<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
								Latest batch
							</div>
							<div class="mt-2 text-sm leading-7 text-slate-200">
								{#if batchSummary}
									Status: {batchSummary.label}. Attempts: {batchSummary.attempts}. Failures: {batchSummary.failures}. Supervisor actions: {batchSummary.supervisorActions}.
								{:else}
									No batch progress is attached yet. The first batch normally appears once execution starts.
								{/if}
							</div>
						</div>

						<div>
							<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
								Assembly
							</div>
							<div class="mt-2 text-sm leading-7 text-slate-200">
								{#if assembly}
									{assembly.id} · {assembly.status} · {assembly.summary}
								{:else}
									Assembly has not been created yet. It is normally produced automatically when the task graph finishes.
								{/if}
							</div>
							{#if assembly?.outputLocation}
								<div class="mt-2 text-sm leading-7 text-slate-200">
									Output: {assembly.outputLocation}
								</div>
							{/if}
						</div>

						<div>
							<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
								Continuity
							</div>
							<div class="mt-2 text-sm leading-7 text-slate-200">
								{#if continuity}
									Approvals: {continuity.relatedApprovals.length}. Recoveries: {continuity.relatedRecoveries.length}. Briefs: {continuity.briefs.length}. Deliveries: {continuity.delivery ? 1 : 0}.
								{:else}
									Continuity summary is unavailable right now.
								{/if}
							</div>
						</div>

						{#if errorMessage}
							<div class="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
								{errorMessage}
							</div>
						{/if}

						{#if !assembly && assemblyBlockReason}
							<div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
								{assemblyBlockReason}
							</div>
						{/if}

						<div class="rounded-2xl border border-white/8 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
							Use this page only for operator inspection, replay, or recovery overrides. The shell workspace remains the primary place to continue the run.
						</div>

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
								type="button"
								class="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
								on:click={createAssembly}
								disabled={actionState === 'running' || !canAssemble}
							>
								{assembly ? 'Replay assembly as recovery' : 'Trigger assembly recovery'}
							</button>
							{#if batchShellHref && !shellReturnHref}
								<a
									class="rounded-full border border-white/10 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
									href={batchShellHref ?? taskGraphShellHref ?? continuityShellHref ?? '#'}
									target="_top"
								>
									Open shell automation
								</a>
							{/if}
							<a
								class="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-900"
								href={projectResultHref ?? '#'}
							>
								Open local recovery result view
							</a>
						</div>
					</section>
				</div>
			{/if}
		</HermesEmbeddedWorkspaceFrame>
