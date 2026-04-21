import { describe, expect, test } from 'vitest';

import { buildProjectBriefUpdateRequest } from './brief-builder';

describe('brief builder helpers', () => {
	test('normalizes multiline fields and drops blank clarification rows', () => {
		expect(
			buildProjectBriefUpdateRequest({
				summary: '  Approved brief for the project factory.  ',
				goalsText: `Capture the user request

Preserve clarification history`,
				nonGoalsText: 'Planner execution',
				constraintsText: 'Stay inside /Users/martin/infinity',
				assumptionsText: 'Hermes remains the intake layer',
				acceptanceCriteriaText: `Approved brief is durable
Visible in work-ui and shell`,
				repoScopeText: `/Users/martin/infinity/apps/shell
/Users/martin/infinity/apps/work-ui`,
				deliverablesText: `Initiative record
Brief record`,
				clarificationLog: [
					{
						question: '  What is the first slice?  ',
						answer: '  Initiative and brief flow only.  '
					},
					{
						question: '   ',
						answer: 'ignored'
					}
				],
				status: 'approved'
			})
		).toEqual({
			summary: 'Approved brief for the project factory.',
			goals: ['Capture the user request', 'Preserve clarification history'],
			nonGoals: ['Planner execution'],
			constraints: ['Stay inside /Users/martin/infinity'],
			assumptions: ['Hermes remains the intake layer'],
			acceptanceCriteria: ['Approved brief is durable', 'Visible in work-ui and shell'],
			repoScope: [
				'/Users/martin/infinity/apps/shell',
				'/Users/martin/infinity/apps/work-ui'
			],
			deliverables: ['Initiative record', 'Brief record'],
			clarificationLog: [
				{
					question: 'What is the first slice?',
					answer: 'Initiative and brief flow only.'
				}
			],
			status: 'approved'
		});
	});
});
