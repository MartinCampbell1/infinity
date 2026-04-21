import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
	clearFounderosEmbeddedCredentials,
	getFounderosEmbeddedSessionAuthHeaders,
	persistFounderosEmbeddedCredentials,
	readFounderosEmbeddedSessionGrant
} from '$lib/founderos/credentials';

describe('founderos embedded credentials', () => {
	beforeEach(() => {
		const storage = new Map<string, string>();
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
		localStorage.clear();
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
		expect(getFounderosEmbeddedSessionAuthHeaders()).toEqual({
			authorization: 'Bearer bearer.session.token',
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
