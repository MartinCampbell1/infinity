import type {
	CreateProjectBriefRequest,
	ProjectBriefDetailResponse,
	ProjectBriefMutationResponse,
	ProjectBriefsDirectoryResponse,
	UpdateProjectBriefRequest
} from './types';
import type { ShellApiContext } from './shared';
import { requestShellOrchestration } from './shared';

export const getOrchestrationBriefs = (context?: ShellApiContext) =>
	requestShellOrchestration<ProjectBriefsDirectoryResponse>('/briefs', {
		context
	});

export const getOrchestrationBrief = (briefId: string, context?: ShellApiContext) =>
	requestShellOrchestration<ProjectBriefDetailResponse>(`/briefs/${encodeURIComponent(briefId)}`, {
		context
	});

export const createOrchestrationBrief = (
	body: CreateProjectBriefRequest,
	context?: ShellApiContext
) =>
	requestShellOrchestration<ProjectBriefMutationResponse>('/briefs', {
		method: 'POST',
		body,
		context
	});

export const updateOrchestrationBrief = (
	briefId: string,
	body: UpdateProjectBriefRequest,
	context?: ShellApiContext
) =>
	requestShellOrchestration<ProjectBriefMutationResponse>(
		`/briefs/${encodeURIComponent(briefId)}`,
		{
			method: 'PATCH',
			body,
			context
		}
	);
