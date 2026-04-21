<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	import HermesEmbeddedWorkspaceFrame from '$lib/components/hermes/workspace/HermesEmbeddedWorkspaceFrame.svelte';
	import { founderosHostContext } from '$lib/founderos/bridge';
	import { founderosLaunchContext } from '$lib/founderos';
	import { createOrchestrationDelivery } from '$lib/apis/orchestration/delivery';
	import { buildFounderosScopedHref, buildFounderosShellHref } from '$lib/founderos/navigation';
	import { resolveFounderosShellOrigin } from '$lib/founderos/shell-origin';
	import { createOrchestrationVerification } from '$lib/apis/orchestration/verification';
	import { createAutoRefreshLoop } from '$lib/orchestration/auto-refresh';
	import { loadInitiativeContinuity, type InitiativeContinuitySummary } from '$lib/orchestration/continuity';
	import {
		canCreateDelivery,
		canRunVerification,
		getDeliveryBlockReason,
		getVerificationBlockReason
	} from '$lib/orchestration/execution-gates';
	import { loadProjectResult } from '$lib/orchestration/project-result';
	import type {
		AssemblyRecord,
		DeliveryRecord,
		VerificationRunRecord
	} from '$lib/apis/orchestration/types';

	let loadState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
	let actionState: 'idle' | 'running' = 'idle';
	let errorMessage = '';
	let loadedInitiativeId = '';
	let initiativeId = '';
	let assembly: AssemblyRecord | null = null;
	let verification: VerificationRunRecord | null = null;
	let delivery: DeliveryRecord | null = null;
	let continuity: InitiativeContinuitySummary | null = null;
	let loadRevision = 0;

	$: shellOrigin = resolveFounderosShellOrigin(
		$founderosLaunchContext,
		browser ? window.location.origin : null
	);
	$: currentInitiativeId = $page.params.id;
	$: metaItems = [
		currentInitiativeId ?? '',
		verification?.overallStatus ?? assembly?.status ?? 'pending'
	];
	$: projectRunHref = initiativeId
		? buildFounderosScopedHref(`/project-run/${encodeURIComponent(initiativeId)}`, $founderosLaunchContext)
		: null;
	$: taskGraphShellHref = continuity?.links.taskGraphHref && shellOrigin
		? buildFounderosShellHref(
				continuity.links.taskGraphHref,
				$founderosLaunchContext,
				shellOrigin
			)
		: null;
	$: batchShellHref = continuity?.links.batchHref && shellOrigin
		? buildFounderosShellHref(
				continuity.links.batchHref,
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
	$: canVerify = canRunVerification(assembly);
	$: canDeliver = canCreateDelivery(verification);
	$: verificationBlockReason = getVerificationBlockReason(assembly);
	$: deliveryBlockReason = getDeliveryBlockReason(verification);
	$: verificationBlockedTitle = !assembly
		? 'Verification is blocked until assembly exists.'
		: 'Verification is blocked until assembly finishes successfully.';
	$: deliveryBlockedTitle = !verification
		? 'Delivery is blocked because verification has not run yet.'
		: verification.overallStatus === 'failed'
			? 'Delivery is blocked because verification failed.'
			: verification.overallStatus === 'running'
				? 'Delivery is blocked while verification is still running.'
				: 'Delivery is blocked until verification passes.';
	$: deliveryBlockedCta = !verification
		? 'Verification becomes available after assembly is ready.'
		: verification.overallStatus === 'failed'
			? 'Review the failed verification, fix the blocking issue, and rerun verification.'
			: verification.overallStatus === 'running'
				? 'Wait for verification to finish before creating delivery.'
				: 'Delivery becomes available after verification passes.';

	type ResultSnapshot = {
		initiativeId: string;
		assembly: AssemblyRecord | null;
		verification: VerificationRunRecord | null;
		delivery: DeliveryRecord | null;
		continuity: InitiativeContinuitySummary | null;
	};

	const readResultSnapshot = async (nextInitiativeId: string): Promise<ResultSnapshot> => {
		const result = await loadProjectResult(nextInitiativeId, { shellOrigin });
		return {
			initiativeId: nextInitiativeId,
			assembly: result.assembly,
			verification: result.verification,
			delivery: result.delivery,
			continuity: await loadInitiativeContinuity(nextInitiativeId, { shellOrigin }).catch(() => null)
		};
	};

	const applyResultSnapshot = (snapshot: ResultSnapshot) => {
		initiativeId = snapshot.initiativeId;
		assembly = snapshot.assembly;
		verification = snapshot.verification;
		delivery = snapshot.delivery;
		continuity = snapshot.continuity;
	};

	const loadResult = async (nextInitiativeId: string) => {
		const revision = ++loadRevision;
		loadState = 'loading';
		errorMessage = '';

		try {
			const snapshot = await readResultSnapshot(nextInitiativeId);
			if (revision !== loadRevision || currentInitiativeId !== nextInitiativeId) {
				return;
			}
			applyResultSnapshot(snapshot);
			loadState = 'ready';
		} catch (error) {
			if (revision !== loadRevision || currentInitiativeId !== nextInitiativeId) {
				return;
			}
			loadState = 'error';
			errorMessage = error instanceof Error ? error.message : 'Failed to load the project result.';
		}
	};

	const refreshResult = async () => {
		if (!initiativeId || loadState === 'loading' || actionState === 'running') {
			return;
		}

		const targetInitiativeId = initiativeId;
		const revision = ++loadRevision;
		try {
			const snapshot = await readResultSnapshot(targetInitiativeId);
			if (revision !== loadRevision || initiativeId !== targetInitiativeId) {
				return;
			}
			applyResultSnapshot(snapshot);
			if (loadState !== 'ready') {
				loadState = 'ready';
			}
		} catch {
			// Preserve the last loaded result if a background refresh fails.
		}
	};

	$: if (currentInitiativeId && currentInitiativeId !== loadedInitiativeId) {
		loadedInitiativeId = currentInitiativeId;
		void loadResult(currentInitiativeId);
	}

	onMount(() => {
		const loop = createAutoRefreshLoop(() => refreshResult(), {
			intervalMs: 8000,
			immediate: false,
			enabled: () => loadState === 'ready' && actionState !== 'running' && !!initiativeId
		});

		return loop.start();
	});

	const runVerification = async () => {
		if (!initiativeId) {
			return;
		}

		actionState = 'running';
		errorMessage = '';
		try {
			const response = await createOrchestrationVerification({ initiativeId }, { shellOrigin });
			assembly = response.assembly;
			verification = response.verification;
			delivery = null;
			continuity = await loadInitiativeContinuity(initiativeId, { shellOrigin }).catch(() => continuity);
			void refreshResult();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to run verification.';
		} finally {
			actionState = 'idle';
		}
	};

	const createDelivery = async () => {
		if (!initiativeId) {
			return;
		}

		actionState = 'running';
		errorMessage = '';
		try {
			const response = await createOrchestrationDelivery({ initiativeId }, { shellOrigin });
			delivery = response.delivery;
			verification = response.verification;
			assembly = response.assembly;
			continuity = await loadInitiativeContinuity(initiativeId, { shellOrigin }).catch(() => continuity);
			void refreshResult();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to create delivery.';
		} finally {
			actionState = 'idle';
		}
	};
</script>

<svelte:head>
	<title>Project Result</title>
</svelte:head>

<HermesEmbeddedWorkspaceFrame
	title="Project result"
	subtitle="Secondary verification and delivery drill-down while the shell workspace stays the canonical outcome surface."
	badge={actionState === 'running' ? 'Verifying' : loadState === 'ready' ? 'Ready' : 'Loading'}
	metaItems={metaItems}
>
			{#if loadState === 'loading' || loadState === 'idle'}
				<div class="rounded-[24px] border border-white/8 bg-slate-900/80 px-5 py-5 text-sm text-slate-200">
					Loading project result…
				</div>
			{:else if loadState === 'error'}
				<div class="rounded-[24px] border border-rose-500/20 bg-rose-500/10 px-5 py-5 text-sm text-rose-200">
					{errorMessage}
				</div>
			{:else}
				<section class="grid gap-5 rounded-[28px] border border-white/8 bg-slate-900/80 px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
					<div>
						<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
							Assembly
						</div>
						<div class="mt-2 text-sm leading-7 text-slate-200">
								{#if assembly}
									{assembly.id} · {assembly.status} · {assembly.artifactUris.length} artifact{assembly.artifactUris.length === 1 ? '' : 's'}
								{:else}
									No assembly has been created yet. It is usually published automatically once assembly completes.
								{/if}
						</div>
						{#if assembly}
							<div class="mt-2 text-sm leading-7 text-slate-200">
								{assembly.summary}
							</div>
							<div class="mt-2 text-sm leading-7 text-slate-200">
								Output: {assembly.outputLocation ?? 'n/a'}
							</div>
						{/if}
					</div>

					<div>
						<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
							Verification
						</div>
						<div class="mt-2 text-sm leading-7 text-slate-200">
							{#if verification}
								{verification.id} · {verification.overallStatus}
								{:else}
									Verification has not been surfaced yet. It normally appears automatically after assembly is ready.
								{/if}
						</div>
						{#if verification}
							<ul class="mt-3 space-y-2 text-sm text-slate-200">
								{#each verification.checks as check}
									<li>{check.name}: {check.status}</li>
								{/each}
							</ul>
						{/if}
					</div>

					<div>
						<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
							Delivery
						</div>
						<div class="mt-2 text-sm leading-7 text-slate-200">
							{#if delivery}
								{delivery.id} · {delivery.status}
								{:else}
									Delivery has not been created yet. It normally appears automatically after verification passes.
								{/if}
						</div>
						{#if delivery}
							<ul class="mt-3 space-y-2 text-sm text-slate-200">
								<li>Summary: {delivery.resultSummary}</li>
								<li>Path: {delivery.localOutputPath ?? 'n/a'}</li>
								<li>Preview URL: {delivery.previewUrl ?? 'n/a'}</li>
								<li>Command: {delivery.command ?? 'n/a'}</li>
							</ul>
						{/if}
					</div>

					<div>
						<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
							Continuity
						</div>
						<div class="mt-2 text-sm leading-7 text-slate-200">
							{#if continuity}
								Approvals: {continuity.relatedApprovals.length}. Recoveries: {continuity.relatedRecoveries.length}. Briefs: {continuity.briefs.length}. Batches: {continuity.batches.length}.
							{:else}
								Continuity summary is unavailable right now.
							{/if}
						</div>
						{#if continuity}
							<div class="mt-2 text-sm leading-7 text-slate-200">
								Memory sidecar: {continuity.memoryAdapter.baseUrl ?? 'n/a'}
							</div>
						{/if}
					</div>

					{#if errorMessage}
						<div class="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
							{errorMessage}
						</div>
					{/if}

					{#if !canVerify && verificationBlockReason}
						<div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
							<div class="font-medium">{verificationBlockedTitle}</div>
							<div class="mt-1">{verificationBlockReason}</div>
						</div>
					{/if}

					{#if !canDeliver && deliveryBlockReason && canVerify}
						<div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
							<div class="font-medium">{deliveryBlockedTitle}</div>
							<div class="mt-1">{deliveryBlockReason}</div>
							<div class="mt-1">{deliveryBlockedCta}</div>
						</div>
					{/if}

					<div class="rounded-2xl border border-white/8 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
						Use this page to inspect proof, rerun blocked steps, or recover a stalled result. The shell remains the primary place to continue the session.
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
							class="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
							on:click={runVerification}
							disabled={actionState === 'running' || !canVerify}
						>
							Run verification override
						</button>
						<button
							type="button"
							class="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
							on:click={createDelivery}
							disabled={actionState === 'running' || !canDeliver}
						>
							Create delivery override
						</button>
						<a
							class="rounded-full border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-900"
							href={projectRunHref ?? '#'}
						>
							Open local run drill-down
						</a>
						{#if !shellReturnHref && (batchShellHref || continuityShellHref || continuity)}
							<a
								class="rounded-full border border-sky-500/20 bg-sky-500/15 px-4 py-2.5 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20"
								href={continuityShellHref ?? batchShellHref ?? buildFounderosShellHref(
									continuity?.links.approvalsHref ?? '/execution/approvals',
									$founderosLaunchContext,
									shellOrigin
								)}
								target="_top"
							>
								Open shell automation
							</a>
						{/if}
					</div>
				</section>
			{/if}
		</HermesEmbeddedWorkspaceFrame>
