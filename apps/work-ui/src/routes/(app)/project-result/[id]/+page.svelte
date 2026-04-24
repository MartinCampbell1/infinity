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
	const titleCase = (value: string | null | undefined) =>
		value
			? value
					.split(/[_\s-]+/)
					.filter(Boolean)
					.map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
					.join(' ')
			: 'Unknown';
	const compactEvidenceValue = (value: string) => {
		if (value.length <= 46) {
			return value;
		}

		try {
			const url = new URL(value);
			const pathParts = url.pathname.split('/').filter(Boolean);
			const lastPart = pathParts.at(-1);
			if (lastPart && pathParts.length > 1) {
				return `${url.origin}/.../${lastPart}`;
			}
		} catch {
			// Local paths and command strings are compacted below.
		}

		const pathParts = value.split('/').filter(Boolean);
		const lastPart = pathParts.at(-1);
		if (value.startsWith('/') && lastPart && pathParts.length > 2) {
			return `/${pathParts.slice(0, 2).join('/')}/.../${lastPart}`;
		}

		return `${value.slice(0, 30)}...${value.slice(-18)}`;
	};
	$: verificationPassedChecks =
		verification?.checks.filter((check) => check.status === 'passed').length ?? 0;
	$: verificationTotalChecks = verification?.checks.length ?? 0;
	$: deliveryReady = delivery?.status === 'ready' || delivery?.status === 'delivered';
	$: resultOutcome = delivery
		? deliveryReady
			? 'Handoff ready'
			: titleCase(delivery.status)
		: verification?.overallStatus === 'passed'
			? 'Delivery pending'
			: assembly?.status === 'assembled'
				? 'Verification pending'
				: 'Assembly pending';
	$: resultSummaryCards = [
		{
			label: 'Outcome',
			value: resultOutcome,
			detail: delivery?.resultSummary ?? 'Result proof appears here after verification and delivery.'
		},
		{
			label: 'Preview',
			value: delivery?.previewUrl ? 'Available' : 'Pending',
			detail: delivery?.previewUrl ? compactEvidenceValue(delivery.previewUrl) : 'No runnable preview yet.'
		},
		{
			label: 'Verification',
			value: verification
				? `${verificationPassedChecks}/${verificationTotalChecks}`
				: assembly
					? 'Ready'
					: 'Pending',
			detail: verification ? titleCase(verification.overallStatus) : 'Verification has not run yet.'
		},
		{
			label: 'Continuity',
			value: continuity
				? `${continuity.relatedApprovals.length} approvals · ${continuity.relatedRecoveries.length} recoveries`
				: 'Unavailable',
			detail: continuity
				? `${continuity.briefs.length} briefs · ${continuity.batches.length} batches`
				: 'Continuity summary is unavailable right now.'
		}
	];
	$: deliveryProofRows = delivery
		? [
				{ label: 'Summary', value: delivery.resultSummary },
				{ label: 'Preview URL', value: delivery.previewUrl ?? 'n/a' },
				{ label: 'Output path', value: delivery.localOutputPath ?? 'n/a' },
				{ label: 'Delivery manifest', value: delivery.manifestPath ?? 'n/a' },
				{ label: 'Launch manifest', value: delivery.launchManifestPath ?? 'n/a' },
				{ label: 'Launch proof URL', value: delivery.launchProofUrl ?? 'n/a' },
				{ label: 'Launch command', value: delivery.command ?? 'n/a' },
				{ label: 'Proof kind', value: delivery.launchProofKind ?? 'n/a' }
			]
		: [];

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
					<div class="grid gap-3 md:grid-cols-2" data-result-primary-summary>
						{#each resultSummaryCards as card}
							<div class="rounded-2xl border border-white/8 bg-slate-950/45 px-4 py-4">
								<div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
									{card.label}
								</div>
								<div class="mt-2 text-lg font-semibold tracking-[-0.02em] text-slate-50">
									{card.value}
								</div>
								<p class="mt-2 text-sm leading-6 text-slate-300">
									{card.detail}
								</p>
							</div>
						{/each}
					</div>

					{#if delivery}
						<div class="rounded-2xl border border-sky-500/15 bg-sky-500/10 px-4 py-4">
							<div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-200/70">
								Primary result
							</div>
							<div class="mt-2 text-base font-semibold text-sky-50">
								{deliveryReady ? 'Preview and handoff are ready.' : 'Delivery record exists, but handoff is not ready yet.'}
							</div>
							<div class="mt-3 flex flex-wrap gap-2">
								{#if delivery.previewUrl}
									<a
										class="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-300/15"
										href={delivery.previewUrl}
										target="_blank"
										rel="noreferrer"
									>
										Open preview
									</a>
								{/if}
								{#if shellReturnHref}
									<a
										class="rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-900"
										href={shellReturnHref}
										target="_top"
									>
										Return to shell workspace
									</a>
								{/if}
							</div>
						</div>
					{/if}

					<details
						class="rounded-2xl border border-white/8 bg-slate-950/45 px-4 py-4"
						data-result-proof-details
					>
						<summary class="cursor-pointer list-none">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<div>
									<div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
										Secondary proof details
									</div>
									<div class="mt-1 text-sm text-slate-300">
										Assembly, verification, delivery, and continuity internals
									</div>
								</div>
								<span class="font-mono text-[11px] text-slate-400">
									{deliveryProofRows.length} proof rows
								</span>
							</div>
						</summary>

						<div class="mt-4 grid gap-4 text-sm text-slate-200">
							<div class="rounded-xl border border-white/8 bg-slate-950/55 px-4 py-4">
								<div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
									Assembly
								</div>
								{#if assembly}
									<div class="mt-2 font-medium">{assembly.status} · {assembly.artifactUris.length} artifact{assembly.artifactUris.length === 1 ? '' : 's'}</div>
									<p class="mt-2 leading-6 text-slate-300">{assembly.summary}</p>
									<code class="mt-2 block select-all break-all font-mono text-[11px] leading-5 text-slate-400">
										{assembly.outputLocation ?? 'n/a'}
									</code>
								{:else}
									<p class="mt-2 leading-6 text-slate-300">
										No assembly has been created yet.
									</p>
								{/if}
							</div>

							<div class="rounded-xl border border-white/8 bg-slate-950/55 px-4 py-4">
								<div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
									Verification
								</div>
								{#if verification}
									<div class="mt-2 font-medium">{verification.overallStatus} · {verificationPassedChecks}/{verificationTotalChecks} checks passed</div>
									<div class="mt-3 grid gap-2 md:grid-cols-2">
										{#each verification.checks as check}
											<div class="rounded-lg border border-white/7 bg-slate-900/80 px-3 py-2">
												<span class="font-mono text-[11px]">{check.name}</span>: {check.status}
											</div>
										{/each}
									</div>
								{:else}
									<p class="mt-2 leading-6 text-slate-300">
										Verification has not been surfaced yet.
									</p>
								{/if}
							</div>

							{#if delivery}
								<div class="rounded-xl border border-white/8 bg-slate-950/55 px-4 py-4">
									<div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
										Delivery evidence
									</div>
									<div class="mt-3 grid gap-3 md:grid-cols-2">
										{#each deliveryProofRows as row}
											<div class="rounded-lg border border-white/7 bg-slate-900/80 px-3 py-3">
												<div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
													{row.label}
												</div>
												<code class="mt-2 block select-all break-all font-mono text-[11px] leading-5 text-slate-300">
													{row.value}
												</code>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<div class="rounded-xl border border-white/8 bg-slate-950/55 px-4 py-4">
								<div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
									Continuity internals
								</div>
								{#if continuity}
									<p class="mt-2 leading-6 text-slate-300">
										Approvals: {continuity.relatedApprovals.length}. Recoveries: {continuity.relatedRecoveries.length}. Briefs: {continuity.briefs.length}. Batches: {continuity.batches.length}.
									</p>
									<code class="mt-2 block select-all break-all font-mono text-[11px] leading-5 text-slate-400">
										Memory sidecar: {continuity.memoryAdapter.baseUrl ?? 'n/a'}
									</code>
								{:else}
									<p class="mt-2 leading-6 text-slate-300">
										Continuity summary is unavailable right now.
									</p>
								{/if}
							</div>
						</div>
					</details>

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
						Use this page only to inspect proof, replay blocked steps, or recover a stalled result. The shell remains the primary place to continue the session.
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
							on:click={runVerification}
							disabled={actionState === 'running' || !canVerify}
						>
							Replay verification as recovery
						</button>
						<button
							type="button"
							class="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
							on:click={createDelivery}
							disabled={actionState === 'running' || !canDeliver}
						>
							Replay delivery as recovery
						</button>
						<a
							class="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-900"
							href={projectRunHref ?? '#'}
						>
							Open local recovery run view
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
