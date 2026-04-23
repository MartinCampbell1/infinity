import { describe, expect, test } from 'vitest';

import type { FounderosLaunchContext } from '$lib/founderos';
import { resolveFounderosShellOrigin } from './shell-origin';

function launchContext(overrides: Partial<FounderosLaunchContext> = {}): FounderosLaunchContext {
	return {
		enabled: false,
		embedded: false,
		projectId: null,
		sessionId: null,
		groupId: null,
		accountId: null,
		workspaceId: null,
		launchToken: null,
		hostOrigin: null,
		rawParams: {},
		launchSource: 'standalone',
		...overrides
	};
}

describe('resolveFounderosShellOrigin', () => {
	test('prefers explicit host origin from launch context', () => {
		expect(
			resolveFounderosShellOrigin(
				launchContext({
					hostOrigin: 'https://ops.example.com'
				}),
				'http://127.0.0.1:3101'
			)
		).toBe('https://ops.example.com');
	});

	test('falls back to current origin when not running on local work-ui preview', () => {
		expect(
			resolveFounderosShellOrigin(launchContext(), 'https://app.example.com')
		).toBe('https://app.example.com');
	});

	test('uses the local shell default when running from local work-ui preview without host origin', () => {
		expect(
			resolveFounderosShellOrigin(launchContext(), 'http://127.0.0.1:3101')
		).toBe('http://127.0.0.1:3737');
	});

	test('treats the canonical local work-ui origin as an embedded origin that resolves back to the shell', () => {
		expect(
			resolveFounderosShellOrigin(launchContext(), 'http://localhost:3101')
		).toBe('http://127.0.0.1:3737');
	});
});
