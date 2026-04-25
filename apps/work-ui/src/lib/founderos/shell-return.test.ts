import { describe, expect, test } from 'vitest';

import { resolveFounderosShellReturnPath } from './shell-return';
import type { SessionWorkspaceHostContext } from './types';

const hostContext = (
	overrides: Partial<SessionWorkspaceHostContext> = {}
): SessionWorkspaceHostContext => ({
	projectId: 'project-atlas',
	projectName: 'Atlas',
	sessionId: 'session 001',
	groupId: 'group-ops',
	accountId: 'account-primary',
	workspaceId: 'workspace-main',
	openedFrom: 'execution_board',
	...overrides
});

describe('resolveFounderosShellReturnPath', () => {
	test('returns a scoped workspace route when a session is present', () => {
		expect(resolveFounderosShellReturnPath(hostContext())).toBe(
			'/execution/workspace/session%20001?project_id=project-atlas&session_id=session+001&group_id=group-ops&account_id=account-primary&workspace_id=workspace-main&opened_from=execution_board'
		);
	});

	test('routes non-session contexts back to their source board', () => {
		expect(
			resolveFounderosShellReturnPath(
				hostContext({ sessionId: '', openedFrom: 'review' }) as SessionWorkspaceHostContext
			)
		).toBe('/execution/review');
		expect(
			resolveFounderosShellReturnPath(
				hostContext({ sessionId: '', openedFrom: 'group_board' }) as SessionWorkspaceHostContext
			)
		).toBe('/execution/groups');
		expect(
			resolveFounderosShellReturnPath(
				hostContext({ sessionId: '', openedFrom: 'deep_link' }) as SessionWorkspaceHostContext
			)
		).toBe('/execution/sessions');
	});

	test('uses the execution board as the fallback route', () => {
		expect(resolveFounderosShellReturnPath(null)).toBe('/execution');
		expect(
			resolveFounderosShellReturnPath(
				hostContext({ sessionId: '', openedFrom: 'unknown' }) as SessionWorkspaceHostContext
			)
		).toBe('/execution');
	});
});
