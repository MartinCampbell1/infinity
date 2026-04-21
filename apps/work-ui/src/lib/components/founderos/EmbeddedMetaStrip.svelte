<script lang="ts">
	import type { SessionWorkspaceHostContext } from '$lib/founderos/types';

	export let projectName: string | null = null;
	export let sessionId: string | null = null;
	export let accountLabel: string | null = null;
	export let accountId: string | null = null;
	export let executionMode: SessionWorkspaceHostContext['executionMode'] = 'unknown';
	export let quotaState: SessionWorkspaceHostContext['quotaState'] | null = null;
	export let pendingApprovals: number | null = null;
	export let openedFrom: SessionWorkspaceHostContext['openedFrom'] | null = null;
	export let shellReturnHref: string | null = null;

	const OPENED_FROM_LABELS: Record<SessionWorkspaceHostContext['openedFrom'], string> = {
		dashboard: 'Dashboard',
		execution_board: 'Execution board',
		review: 'Review queue',
		group_board: 'Group board',
		deep_link: 'Deep link',
		unknown: 'Shell'
	};

	const EXECUTION_MODE_LABELS: Record<NonNullable<SessionWorkspaceHostContext['executionMode']>, string> = {
		local: 'Local runtime',
		worktree: 'Worktree runtime',
		cloud: 'Cloud runtime',
		hermes: 'Hermes runtime',
		unknown: 'Workspace runtime'
	};

	const QUOTA_PRESSURE_LABELS: Record<
		NonNullable<SessionWorkspaceHostContext['quotaState']>['pressure'],
		string
	> = {
		low: 'low',
		medium: 'watch',
		high: 'high',
		exhausted: 'exhausted',
		unknown: 'unknown'
	};

	const formatQuotaLabel = (state: SessionWorkspaceHostContext['quotaState'] | null) => {
		if (!state) {
			return null;
		}

		const parts = [`Quota ${QUOTA_PRESSURE_LABELS[state.pressure] ?? 'unknown'}`];
		if (typeof state.usedPercent === 'number' && Number.isFinite(state.usedPercent)) {
			parts.push(`${Math.round(state.usedPercent)}% used`);
		}

		return parts.join(' · ');
	};

	$: accountValue = accountLabel ?? accountId;
	$: openedFromLabel = OPENED_FROM_LABELS[openedFrom ?? 'unknown'] ?? 'Shell';
	$: executionModeLabel = EXECUTION_MODE_LABELS[executionMode ?? 'unknown'] ?? 'Workspace runtime';
	$: quotaLabel = formatQuotaLabel(quotaState);
	$: quotaPressure = quotaState?.pressure ?? 'unknown';
	$: showOpenedFromLabel = (openedFrom ?? 'unknown') !== 'unknown';
	$: showExecutionModeLabel = (executionMode ?? 'unknown') !== 'unknown';
	$: showQuotaLabel =
		quotaState?.pressure === 'medium' ||
		quotaState?.pressure === 'high' ||
		quotaState?.pressure === 'exhausted';
	$: approvalsLabel =
		typeof pendingApprovals === 'number'
			? pendingApprovals > 0
				? pendingApprovals === 1
					? '1 pending approval'
					: `${pendingApprovals} pending approvals`
				: null
			: null;
	$: shellReturnLabel =
		shellReturnHref?.includes('/execution/workspace/')
			? 'Return to session'
			: shellReturnHref?.includes('/execution/review')
				? 'Return to review'
				: shellReturnHref?.includes('/execution')
					? 'Return to control plane'
					: 'Return to shell';
</script>

<div class="founderos-work-banner">
	<div class="founderos-work-banner__summary">
		<div class="founderos-work-banner__headline">
			<span class="founderos-work-banner__project">{projectName ?? 'Workspace'}</span>
			{#if sessionId}
				<span class="founderos-work-banner__session monospace">{sessionId}</span>
			{/if}
		</div>
		<div class="founderos-work-banner__pills">
			{#if showOpenedFromLabel}
				<span class="founderos-pill">Opened from {openedFromLabel}</span>
			{/if}
			{#if showExecutionModeLabel}
				<span class="founderos-pill">{executionModeLabel}</span>
			{/if}
			{#if accountValue}
				<span class="founderos-pill">{accountValue}</span>
			{/if}
			{#if approvalsLabel}
				<span class="founderos-pill">{approvalsLabel}</span>
			{/if}
			{#if quotaLabel && showQuotaLabel}
				<span class="founderos-pill founderos-pill--quota" data-pressure={quotaPressure}>
					{quotaLabel}
				</span>
			{/if}
		</div>
	</div>

	{#if shellReturnHref}
		<a class="founderos-work-banner__action" href={shellReturnHref} target="_top" rel="noreferrer">
			{shellReturnLabel}
		</a>
	{/if}
</div>

<style>
	.founderos-work-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.9rem;
		padding: 0.6rem 0.85rem;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
		background: linear-gradient(180deg, rgb(15 23 42 / 0.88), rgb(15 23 42 / 0.7));
		backdrop-filter: blur(10px);
		position: sticky;
		top: 0;
		z-index: 20;
	}

	.founderos-work-banner__summary {
		min-width: 0;
		display: flex;
		flex: 1 1 auto;
		flex-direction: column;
		gap: 0.3rem;
	}

	.founderos-work-banner__headline {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		flex-wrap: wrap;
	}

	.founderos-work-banner__project {
		font-size: 0.88rem;
		line-height: 1.2rem;
		font-weight: 600;
		color: rgb(248 250 252 / 0.96);
	}

	.founderos-work-banner__session {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.45rem;
		border-radius: 9999px;
		border: 1px solid rgb(255 255 255 / 0.08);
		background: rgb(255 255 255 / 0.06);
		font-size: 0.68rem;
		line-height: 1rem;
		color: rgb(226 232 240 / 0.78);
	}

	.founderos-work-banner__pills {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex-wrap: wrap;
	}

	.founderos-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		border: 1px solid rgb(255 255 255 / 0.08);
		background: rgb(255 255 255 / 0.06);
		font-size: 0.68rem;
		line-height: 1rem;
		color: rgb(226 232 240 / 0.78);
	}

	.founderos-pill--quota[data-pressure='medium'] {
		border-color: rgb(251 191 36 / 0.2);
		background: rgb(245 158 11 / 0.14);
		color: rgb(253 224 71);
	}

	.founderos-pill--quota[data-pressure='high'],
	.founderos-pill--quota[data-pressure='exhausted'] {
		border-color: rgb(248 113 113 / 0.24);
		background: rgb(239 68 68 / 0.12);
		color: rgb(254 202 202);
	}

	.founderos-work-banner__action {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.38rem 0.72rem;
		border-radius: 9999px;
		border: 1px solid rgb(255 255 255 / 0.12);
		background: rgb(255 255 255 / 0.06);
		font-size: 0.75rem;
		line-height: 1rem;
		font-weight: 600;
		color: rgb(226 232 240 / 0.92);
		text-decoration: none;
		transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
	}

	.founderos-work-banner__action:hover {
		background: rgb(255 255 255 / 0.12);
		border-color: rgb(255 255 255 / 0.24);
	}

	.monospace {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
			'Courier New', monospace;
	}

	@media (max-width: 640px) {
		.founderos-work-banner {
			align-items: flex-start;
			flex-direction: column;
		}

		.founderos-work-banner__action {
			width: 100%;
		}
	}
</style>
