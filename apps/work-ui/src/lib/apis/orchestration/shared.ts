type ShellApiContext = {
	shellOrigin?: string | null;
	fetchImpl?: typeof fetch;
};

const resolveOrchestrationBaseUrl = (shellOrigin?: string | null) => {
	const normalizedOrigin = shellOrigin ? shellOrigin.replace(/\/$/, '') : '';
	return `${normalizedOrigin}/api/control/orchestration`;
};

export const requestShellOrchestration = async <T>(
	path: string,
	options: {
		method?: 'GET' | 'POST' | 'PATCH';
		body?: unknown;
		context?: ShellApiContext;
	} = {}
) => {
	const fetchImpl = options.context?.fetchImpl ?? fetch;
	const response = await fetchImpl(
		`${resolveOrchestrationBaseUrl(options.context?.shellOrigin)}${path}`,
		{
			method: options.method ?? 'GET',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			cache: 'no-store',
			body: options.body === undefined ? undefined : JSON.stringify(options.body)
		}
	).catch(() => null);

	if (!response) {
		throw new Error('FounderOS orchestration API is unavailable.');
	}

	const payload = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(
			payload && typeof payload.detail === 'string'
				? payload.detail
				: `FounderOS orchestration request failed: ${response.status}`
		);
	}

	return payload as T;
};

export type { ShellApiContext };
