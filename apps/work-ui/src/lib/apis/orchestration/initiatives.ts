import type {
	CreateInitiativeRequest,
	InitiativeDetailResponse,
	InitiativeMutationResponse,
	InitiativesDirectoryResponse,
	UpdateInitiativeRequest
} from './types';
import type { ShellApiContext } from './shared';
import { requestShellOrchestration } from './shared';

export const getOrchestrationInitiatives = (context?: ShellApiContext) =>
	requestShellOrchestration<InitiativesDirectoryResponse>('/initiatives', {
		context
	});

export const getOrchestrationInitiative = (initiativeId: string, context?: ShellApiContext) =>
	requestShellOrchestration<InitiativeDetailResponse>(
		`/initiatives/${encodeURIComponent(initiativeId)}`,
		{
			context
		}
	);

export const createOrchestrationInitiative = (
	body: CreateInitiativeRequest,
	context?: ShellApiContext
) =>
	requestShellOrchestration<InitiativeMutationResponse>('/initiatives', {
		method: 'POST',
		body,
		context
	});

export const updateOrchestrationInitiative = (
	initiativeId: string,
	body: UpdateInitiativeRequest,
	context?: ShellApiContext
) =>
	requestShellOrchestration<InitiativeMutationResponse>(
		`/initiatives/${encodeURIComponent(initiativeId)}`,
		{
			method: 'PATCH',
			body,
			context
		}
	);
