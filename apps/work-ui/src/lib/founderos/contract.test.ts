import { describe, expect, test } from 'vitest';

import {
	isHostToWorkspaceMessage,
	isSessionWorkspaceHostContextPatch,
	isSessionWorkspaceHostContext
} from '$lib/founderos/contract';

describe('founderos contract guards', () => {
	test('accepts a valid bootstrap message', () => {
		const message = {
			type: 'founderos.bootstrap',
			payload: {
				projectId: 'project-atlas',
				projectName: 'Atlas Launch',
				sessionId: 'session-001',
				openedFrom: 'execution_board',
				quotaState: {
					pressure: 'medium',
					usedPercent: 63
				}
			}
		};

		expect(isHostToWorkspaceMessage(message)).toBe(true);
		expect(isSessionWorkspaceHostContext(message.payload)).toBe(true);
	});

	test('rejects unknown host message types and malformed payloads', () => {
		expect(
			isHostToWorkspaceMessage({
				type: 'founderos.unknown.event',
				payload: {}
			})
		).toBe(false);

		expect(
			isHostToWorkspaceMessage({
				type: 'founderos.session.retry',
				payload: { retryMode: 'random' }
			})
		).toBe(false);

		expect(
			isHostToWorkspaceMessage({
				type: 'founderos.bootstrap',
				payload: {
					projectId: 'project-atlas',
					projectName: 'Atlas Launch',
					openedFrom: 'execution_board'
				}
			})
		).toBe(false);
	});

	test('rejects invalid session.meta patch core field types', () => {
		expect(
			isSessionWorkspaceHostContextPatch({
				projectName: 42
			})
		).toBe(false);

		expect(
			isHostToWorkspaceMessage({
				type: 'founderos.session.meta',
				payload: {
					sessionId: 7
				}
			})
		).toBe(false);
	});

	test('rejects malformed quota patches and accepts nested quota updates', () => {
		expect(
			isSessionWorkspaceHostContext({
				projectId: 'project-atlas',
				projectName: 'Atlas Launch',
				sessionId: 'session-001',
				openedFrom: 'execution_board',
				quotaState: {
					pressure: 'high',
					usedPercent: 87,
					resetsAt: '2026-04-11T00:00:00.000Z'
				}
			})
		).toBe(true);

		expect(
			isSessionWorkspaceHostContext({
				projectId: 'project-atlas',
				projectName: 'Atlas Launch',
				sessionId: 'session-001',
				openedFrom: 'execution_board',
				quotaState: {
					pressure: 'burst'
				}
			})
		).toBe(false);

		expect(
			isSessionWorkspaceHostContextPatch({
				quotaState: {
					pressure: 'medium',
					usedPercent: 51
				}
			})
		).toBe(true);
	});
});
