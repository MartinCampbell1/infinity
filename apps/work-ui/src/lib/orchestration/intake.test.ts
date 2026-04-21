import { describe, expect, test } from 'vitest';

import {
	buildInitialBriefCreateRequest,
	buildInitiativeCreateRequest
} from './intake';

describe('intake orchestration helpers', () => {
	test('builds a trimmed initiative create request from intake input', () => {
		expect(
			buildInitiativeCreateRequest({
				title: '  Atlas Factory  ',
				userRequest: '  Build the Infinity-native project factory intake.  ',
				requestedBy: '  martin  ',
				priority: 'high',
				workspaceSessionId: 'workspace-session-atlas'
			})
		).toEqual({
			title: 'Atlas Factory',
			userRequest: 'Build the Infinity-native project factory intake.',
			requestedBy: 'martin',
			priority: 'high',
			workspaceSessionId: 'workspace-session-atlas'
		});
	});

	test('builds the first clarifying brief from initiative intake context', () => {
		expect(
			buildInitialBriefCreateRequest({
				initiativeId: 'initiative-atlas',
				userRequest: 'Build the Infinity-native project factory intake.',
				authoredBy: 'hermes-intake'
			})
		).toEqual(
			expect.objectContaining({
				initiativeId: 'initiative-atlas',
				summary: 'Build the Infinity-native project factory intake.',
				status: 'clarifying',
				authoredBy: 'hermes-intake',
				goals: [],
				clarificationLog: []
			})
		);
	});
});
