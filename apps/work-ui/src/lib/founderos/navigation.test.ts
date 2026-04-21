import { describe, expect, test } from 'vitest';

import {
	buildFounderosChatHref,
	buildFounderosRootHref,
	buildFounderosScopedHref,
	buildFounderosShellHref
} from './navigation';
import type { FounderosLaunchContext } from './index';

function launchContext(overrides: Partial<FounderosLaunchContext> = {}): FounderosLaunchContext {
	return {
		enabled: true,
		embedded: true,
		projectId: 'project-atlas',
		sessionId: 'session-001',
		groupId: 'group-ops-01',
		accountId: 'account-chatgpt-01',
		workspaceId: 'workspace-atlas-main',
		launchToken: 'signed-launch-token',
		hostOrigin: 'https://ops.example.com',
		rawParams: {
			founderos_launch: '1',
			embedded: '1',
			project_id: 'project-atlas',
			session_id: 'session-001',
			group_id: 'group-ops-01',
			account_id: 'account-chatgpt-01',
			workspace_id: 'workspace-atlas-main',
			launch_token: 'signed-launch-token',
			host_origin: 'https://ops.example.com',
			opened_from: 'execution_board'
		},
		launchSource: 'founderos_embedded',
		...overrides
	};
}

describe('buildFounderosScopedHref', () => {
	test('preserves launch params when navigating inside embedded FounderOS mode', () => {
		expect(buildFounderosScopedHref('/project-intake', launchContext())).toBe(
			'/project-intake?founderos_launch=1&embedded=1&project_id=project-atlas&session_id=session-001&group_id=group-ops-01&account_id=account-chatgpt-01&workspace_id=workspace-atlas-main&host_origin=https%3A%2F%2Fops.example.com&opened_from=execution_board'
		);
	});

describe('buildFounderosRootHref', () => {
	test('preserves launch params when navigating to the root workspace route', () => {
		expect(buildFounderosRootHref(launchContext())).toBe(
			'/?founderos_launch=1&embedded=1&project_id=project-atlas&session_id=session-001&group_id=group-ops-01&account_id=account-chatgpt-01&workspace_id=workspace-atlas-main&host_origin=https%3A%2F%2Fops.example.com&opened_from=execution_board'
		);
	});
});

describe('buildFounderosChatHref', () => {
	test('preserves launch params when navigating to a chat route', () => {
		expect(buildFounderosChatHref('chat-123', launchContext())).toBe(
			'/c/chat-123?founderos_launch=1&embedded=1&project_id=project-atlas&session_id=session-001&group_id=group-ops-01&account_id=account-chatgpt-01&workspace_id=workspace-atlas-main&host_origin=https%3A%2F%2Fops.example.com&opened_from=execution_board'
		);
	});
});

	test('merges additional params without dropping the launch context', () => {
		expect(
			buildFounderosScopedHref('/project-brief/brief-001', launchContext(), {
				initiative_id: 'initiative-001'
			})
		).toBe(
			'/project-brief/brief-001?founderos_launch=1&embedded=1&project_id=project-atlas&session_id=session-001&group_id=group-ops-01&account_id=account-chatgpt-01&workspace_id=workspace-atlas-main&host_origin=https%3A%2F%2Fops.example.com&opened_from=execution_board&initiative_id=initiative-001'
		);
	});

	test('returns a plain route when FounderOS launch context is not enabled', () => {
		expect(
			buildFounderosScopedHref(
				'/project-intake',
				launchContext({
					enabled: false,
					embedded: false,
					rawParams: {},
					launchSource: 'standalone'
				})
			)
		).toBe('/project-intake');
	});

	test('preserves launch scope when building absolute shell hrefs', () => {
		expect(
			buildFounderosShellHref(
				'/execution/task-graphs/task-graph-001?initiative_id=initiative-001',
				launchContext(),
				'https://ops.example.com'
			)
		).toBe(
			'https://ops.example.com/execution/task-graphs/task-graph-001?founderos_launch=1&embedded=1&project_id=project-atlas&session_id=session-001&group_id=group-ops-01&account_id=account-chatgpt-01&workspace_id=workspace-atlas-main&host_origin=https%3A%2F%2Fops.example.com&opened_from=execution_board&initiative_id=initiative-001'
		);
	});
});
