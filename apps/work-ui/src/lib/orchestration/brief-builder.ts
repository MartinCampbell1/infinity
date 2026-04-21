import type {
	ProjectBriefClarificationEntry,
	ProjectBriefStatus,
	UpdateProjectBriefRequest
} from '$lib/apis/orchestration/types';

type ProjectBriefFormInput = {
	summary: string;
	goalsText: string;
	nonGoalsText: string;
	constraintsText: string;
	assumptionsText: string;
	acceptanceCriteriaText: string;
	repoScopeText: string;
	deliverablesText: string;
	clarificationLog: ProjectBriefClarificationEntry[];
	status: ProjectBriefStatus;
};

const requireValue = (value: string, field: string) => {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`${field} is required.`);
	}
	return trimmed;
};

const splitLines = (value: string) =>
	value
		.split(/\r?\n/g)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

export const buildProjectBriefUpdateRequest = (
	input: ProjectBriefFormInput
): UpdateProjectBriefRequest => ({
	summary: requireValue(input.summary, 'summary'),
	goals: splitLines(input.goalsText),
	nonGoals: splitLines(input.nonGoalsText),
	constraints: splitLines(input.constraintsText),
	assumptions: splitLines(input.assumptionsText),
	acceptanceCriteria: splitLines(input.acceptanceCriteriaText),
	repoScope: splitLines(input.repoScopeText),
	deliverables: splitLines(input.deliverablesText),
	clarificationLog: input.clarificationLog
		.map((entry) => ({
			question: entry.question.trim(),
			answer: entry.answer.trim()
		}))
		.filter((entry) => entry.question.length > 0 && entry.answer.length > 0),
	status: input.status
});
