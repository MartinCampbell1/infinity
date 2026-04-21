import type {
	CreateInitiativeRequest,
	CreateProjectBriefRequest,
	InitiativePriority
} from '$lib/apis/orchestration/types';

type InitiativeIntakeInput = {
	title: string;
	userRequest: string;
	requestedBy: string;
	priority?: InitiativePriority;
	workspaceSessionId?: string | null;
};

type InitialBriefInput = {
	initiativeId: string;
	userRequest: string;
	authoredBy: string;
};

const requireValue = (value: string, field: string) => {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`${field} is required.`);
	}
	return trimmed;
};

export const buildInitiativeCreateRequest = (
	input: InitiativeIntakeInput
): CreateInitiativeRequest => ({
	title: requireValue(input.title, 'title'),
	userRequest: requireValue(input.userRequest, 'userRequest'),
	requestedBy: requireValue(input.requestedBy, 'requestedBy'),
	priority: input.priority ?? 'normal',
	workspaceSessionId: input.workspaceSessionId?.trim() || undefined
});

export const buildInitialBriefCreateRequest = (
	input: InitialBriefInput
): CreateProjectBriefRequest => ({
	initiativeId: requireValue(input.initiativeId, 'initiativeId'),
	summary: requireValue(input.userRequest, 'userRequest'),
	goals: [],
	nonGoals: [],
	constraints: [],
	assumptions: [],
	acceptanceCriteria: [],
	repoScope: [],
	deliverables: [],
	clarificationLog: [],
	status: 'clarifying',
	authoredBy: requireValue(input.authoredBy, 'authoredBy')
});
