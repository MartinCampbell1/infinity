import type {
	VerificationMutationResponse,
	VerificationRunsDirectoryResponse
} from './types';
import type { ShellApiContext } from './shared';
import { requestShellOrchestration } from './shared';

export const getOrchestrationVerifications = (
	filters?: { initiativeId?: string | null },
	context?: ShellApiContext
) => {
	const searchParams = new URLSearchParams();
	if (filters?.initiativeId) {
		searchParams.set('initiative_id', filters.initiativeId);
	}

	const query = searchParams.toString();
	return requestShellOrchestration<VerificationRunsDirectoryResponse>(
		`/verification${query ? `?${query}` : ''}`,
		{ context }
	);
};

export const createOrchestrationVerification = (
	body: { initiativeId: string },
	context?: ShellApiContext
) =>
	requestShellOrchestration<VerificationMutationResponse>('/verification', {
		method: 'POST',
		body,
		context
	});
