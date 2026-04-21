type ContinuityContext = {
	shellOrigin?: string | null;
	fetchImpl?: typeof fetch;
};

export type InitiativeContinuitySummary = {
	initiative: { id: string; status?: string };
	briefs: Array<{ id: string }>;
	taskGraphs: Array<{ id: string }>;
	batches: Array<{ id: string; status?: string; taskGraphId?: string }>;
	assembly: { id: string } | null;
	verification: { id: string; overallStatus?: string } | null;
	delivery: { id: string; status?: string } | null;
	relatedApprovals: Array<{ id: string }>;
	relatedRecoveries: Array<{ id: string }>;
	memoryAdapter: {
		baseUrl?: string | null;
		healthPath?: string | null;
	};
	links: {
		continuityHref: string;
		approvalsHref: string;
		recoveriesHref: string;
		deliveryHref?: string | null;
		taskGraphHref?: string | null;
		batchHref?: string | null;
	};
};

export const loadInitiativeContinuity = async (
	initiativeId: string,
	context: ContinuityContext = {}
): Promise<InitiativeContinuitySummary> => {
	const base = context.shellOrigin ? context.shellOrigin.replace(/\/$/, '') : '';
	const fetchImpl = context.fetchImpl ?? fetch;
	const response = await fetchImpl(
		`${base}/api/control/orchestration/continuity/${encodeURIComponent(initiativeId)}`,
		{
			method: 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			cache: 'no-store'
		}
	).catch(() => null);

	if (!response) {
		throw new Error('Continuity API is unavailable.');
	}

	const payload = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(
			payload && typeof payload.detail === 'string'
				? payload.detail
				: `Continuity request failed: ${response.status}`
		);
	}

	return payload as InitiativeContinuitySummary;
};
