import { describe, expect, test } from 'vitest';

import { parseFounderosLaunchContext } from '$lib/founderos';

describe('founderos launch context parsing', () => {
	test('normalizes trusted host origin and preserves raw params', () => {
		const context = parseFounderosLaunchContext(
			new URL(
				'https://example.test/work?founderos_launch=1&project_id=project-atlas&session_id=session-001&launch_token=signed-token&host_origin=https://ops.example.com/path?x=1'
			)
		);

		expect(context.enabled).toBe(true);
		expect(context.embedded).toBe(false);
		expect(context.hostOrigin).toBe('https://ops.example.com');
		expect(context.launchToken).toBe('signed-token');
		expect(context.rawParams.project_id).toBe('project-atlas');
		expect(context.launchSource).toBe('founderos_launch');
	});

	test('enables embedded mode even without explicit launch token and rejects unsafe origins', () => {
		const context = parseFounderosLaunchContext(
			new URL(
				'https://example.test/work?embedded=true&workspace_id=workspace-7&host_origin=javascript:alert(1)'
			)
		);

		expect(context.enabled).toBe(true);
		expect(context.embedded).toBe(true);
		expect(context.hostOrigin).toBe(null);
		expect(context.workspaceId).toBe('workspace-7');
		expect(context.launchSource).toBe('founderos_embedded');
	});

	test('reuses the stored launch token when embedded routes drop it from the URL', () => {
		const store = new Map<string, string>();
		(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItem: (key: string) => {
				store.delete(key);
			}
		} as Storage;

		parseFounderosLaunchContext(
			new URL(
				'https://example.test/work?embedded=1&project_id=project-atlas&session_id=session-001&launch_token=signed-token&host_origin=https://ops.example.com'
			)
		);

		const context = parseFounderosLaunchContext(
			new URL(
				'https://example.test/work?embedded=1&project_id=project-atlas&session_id=session-001&host_origin=https://ops.example.com'
			)
		);

		expect(context.launchToken).toBe('signed-token');
	});
});
