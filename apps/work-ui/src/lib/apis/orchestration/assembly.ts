import type { AssembliesDirectoryResponse, AssemblyMutationResponse } from './types';
import type { ShellApiContext } from './shared';
import { requestShellOrchestration } from './shared';

export const getOrchestrationAssemblies = (
	filters?: { initiativeId?: string | null },
	context?: ShellApiContext
) => {
	const searchParams = new URLSearchParams();
	if (filters?.initiativeId) {
		searchParams.set('initiative_id', filters.initiativeId);
	}

	const query = searchParams.toString();
	return requestShellOrchestration<AssembliesDirectoryResponse>(
		`/assembly${query ? `?${query}` : ''}`,
		{ context }
	);
};

export const createOrchestrationAssembly = (
	body: { initiativeId: string },
	context?: ShellApiContext
) =>
	requestShellOrchestration<AssemblyMutationResponse>('/assembly', {
		method: 'POST',
		body,
		context
	});
