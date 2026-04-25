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
		gap: var(--space-6);
		padding: var(--space-5) var(--space-6);
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
		gap: var(--space-1);
	}

	.founderos-work-banner__headline {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		flex-wrap: wrap;
	}

	.founderos-work-banner__project {
		font-size: var(--font-size-small);
		line-height: 1.2rem;
		font-weight: 600;
		color: rgb(248 250 252 / 0.96);
	}

	.founderos-work-banner__session {
		display: inline-flex;
		align-items: center;
		padding: 2px var(--space-2);
		border-radius: var(--radius-pill);
		border: 1px solid rgb(255 255 255 / 0.08);
		background: rgb(255 255 255 / 0.06);
		font-size: var(--font-size-micro);
		line-height: 1rem;
		color: rgb(226 232 240 / 0.78);
	}

	.founderos-work-banner__pills {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.founderos-pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 2px var(--space-3);
		border-radius: var(--radius-pill);
		border: 1px solid rgb(255 255 255 / 0.08);
		background: rgb(255 255 255 / 0.06);
		font-size: var(--font-size-micro);
		line-height: 1rem;
		color: rgb(226 232 240 / 0.78);
	}

	.founderos-pill--quota[data-pressure='medium'] {
		border-color: var(--status-pending-border);
		background: var(--status-pending-bg);
		color: var(--status-pending-fg);
	}

	.founderos-pill--quota[data-pressure='high'],
	.founderos-pill--quota[data-pressure='exhausted'] {
		border-color: var(--status-failed-border);
		background: var(--status-failed-bg);
		color: var(--status-failed-fg);
	}

	.founderos-work-banner__action {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-2) var(--space-5);
		border-radius: var(--radius-pill);
		border: 1px solid rgb(255 255 255 / 0.12);
		background: rgb(255 255 255 / 0.06);
		font-size: var(--font-size-mini);
		line-height: 1rem;
		font-weight: 600;
		color: rgb(226 232 240 / 0.92);
		text-decoration: none;
		transition: background-color var(--transition-fade), border-color var(--transition-fade),
			color var(--transition-fade);
	}

	.founderos-work-banner__action:hover {
		background: rgb(255 255 255 / 0.12);
		border-color: rgb(255 255 255 / 0.24);
	}

	.monospace {
		font-family: var(--font-mono);
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
