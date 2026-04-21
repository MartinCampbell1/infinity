import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
	clearFounderosEmbeddedCredentials,
	getFounderosEmbeddedSessionAuthHeaders,
	persistFounderosEmbeddedCredentials,
	readFounderosEmbeddedSessionGrant,
	readFounderosEmbeddedSessionToken,
	resolveFounderosEmbeddedAccessToken
} from '$lib/founderos/credentials';

describe('founderos embedded credentials', () => {
	beforeEach(() => {
		const storage = new Map<string, string>();
		const sessionStorageState = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			token: '',
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => {
				storage.set(key, value);
			},
			removeItem: (key: string) => {
				storage.delete(key);
			},
			clear: () => {
				storage.clear();
				(globalThis.localStorage as { token?: string }).token = '';
			}
		});
		vi.stubGlobal('sessionStorage', {
			getItem: (key: string) => sessionStorageState.get(key) ?? null,
			setItem: (key: string, value: string) => {
				sessionStorageState.set(key, value);
			},
			removeItem: (key: string) => {
				sessionStorageState.delete(key);
			},
			clear: () => {
				sessionStorageState.clear();
			}
		});
		clearFounderosEmbeddedCredentials();
		localStorage.clear();
		sessionStorage.clear();
	});

	test('persists and reads session grant metadata', () => {
		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: {
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			}
		});

		expect(readFounderosEmbeddedSessionGrant()).toEqual({
			token: 'grant.token',
			issuedAt: '2026-04-12T00:00:00.000Z',
			expiresAt: '2026-04-12T00:30:00.000Z'
		});
		expect(readFounderosEmbeddedSessionToken()).toBe('bearer.session.token');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			authorization: 'Bearer bearer.session.token',
			'x-founderos-workspace-session-grant': 'grant.token'
		});
	});

	test('prefers the embedded session token over a legacy localStorage token', () => {
		localStorage.token = 'legacy.browser.token';

		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: null
		});

		expect(resolveFounderosEmbeddedAccessToken()).toBe('bearer.session.token');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			authorization: 'Bearer bearer.session.token'
		});
	});

	test('keeps the embedded session token in memory even if compatibility storage is cleared', () => {
		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: {
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			}
		});

		sessionStorage.removeItem('founderos.workspace.sessionToken');
		sessionStorage.removeItem('founderos.workspace.sessionGrant');
		localStorage.removeItem('founderos.workspace.sessionToken');
		localStorage.removeItem('founderos.workspace.sessionGrant');
		localStorage.token = '';

		expect(readFounderosEmbeddedSessionToken()).toBe('bearer.session.token');
		expect(readFounderosEmbeddedSessionGrant()).toEqual({
			token: 'grant.token',
			issuedAt: '2026-04-12T00:00:00.000Z',
			expiresAt: '2026-04-12T00:30:00.000Z'
		});
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			authorization: 'Bearer bearer.session.token',
			'x-founderos-workspace-session-grant': 'grant.token'
		});
	});

	test('stores embedded session state in sessionStorage while leaving localStorage session keys empty', () => {
		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: {
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			}
		});

		expect(sessionStorage.getItem('founderos.workspace.sessionToken')).toBe('bearer.session.token');
		expect(sessionStorage.getItem('founderos.workspace.sessionGrant')).toContain('grant.token');
		expect(localStorage.getItem('founderos.workspace.sessionToken')).toBeNull();
		expect(localStorage.getItem('founderos.workspace.sessionGrant')).toBeNull();
		expect(localStorage.token).toBe('bearer.session.token');
	});

	test('falls back to the legacy localStorage token when no embedded token exists', () => {
		localStorage.token = 'legacy.browser.token';

		expect(readFounderosEmbeddedSessionToken()).toBeNull();
		expect(resolveFounderosEmbeddedAccessToken()).toBe('legacy.browser.token');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			authorization: 'Bearer legacy.browser.token'
		});
	});

	test('fails closed in shell-issued session mode when embedded token is missing', () => {
		localStorage.token = 'legacy.browser.token';

		expect(
			resolveFounderosEmbeddedAccessToken({
				allowLegacyToken: false
			})
		).toBe('');
	});

	test('does not revive legacy browser token when a shell-issued session grant exists without an embedded token', () => {
		localStorage.token = 'legacy.browser.token';
		localStorage.setItem(
			'founderos.workspace.sessionGrant',
			JSON.stringify({
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			})
		);

		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			'x-founderos-workspace-session-grant': 'grant.token'
		});
	});

	test('clears embedded bearer and session grant state when there is no prior token', () => {
		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: {
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			}
		});

		clearFounderosEmbeddedCredentials();

		expect(readFounderosEmbeddedSessionGrant()).toBeNull();
		expect(localStorage.token).toBe('');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({});
	});

	test('restores the previous bearer token when clearing embedded credentials', () => {
		localStorage.token = 'user.session.token';

		persistFounderosEmbeddedCredentials({
			token: 'bearer.session.token',
			sessionGrant: {
				token: 'grant.token',
				issuedAt: '2026-04-12T00:00:00.000Z',
				expiresAt: '2026-04-12T00:30:00.000Z'
			}
		});

		clearFounderosEmbeddedCredentials();

		expect(readFounderosEmbeddedSessionGrant()).toBeNull();
		expect(localStorage.token).toBe('user.session.token');
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			authorization: 'Bearer user.session.token'
		});
	});
});
