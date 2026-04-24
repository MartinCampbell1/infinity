export interface FounderosEmbeddedSessionGrant {
	token?: string | null;
	grantId?: string | null;
	issuedAt: string;
	expiresAt: string;
	refreshAfter?: string | null;
	revokedAt?: string | null;
}

export interface FounderosEmbeddedAccessTokenOptions {
	fallbackToken?: string | null;
	allowLegacyToken?: boolean;
}

export type FounderosEmbeddedCredentialStorageMode =
	| 'http_only_cookie'
	| 'local_dev_session_storage';

const isLaunchEnabled = (value: string | null) => value === '1' || value === 'true';

const SESSION_TOKEN_STORAGE_KEY = 'founderos.workspace.sessionToken';
const SESSION_GRANT_STORAGE_KEY = 'founderos.workspace.sessionGrant';
let embeddedSessionTokenMemory: string | null = null;
let embeddedSessionGrantMemory: FounderosEmbeddedSessionGrant | null = null;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const getSessionStorageBucket = (): StorageLike | null =>
	typeof sessionStorage === 'undefined' ? null : sessionStorage;

const isFounderosLocalDevCredentialStorageEnabled = () => {
	if (typeof window === 'undefined') {
		return false;
	}

	try {
		const url = new URL(window.location.href);
		const localHostname =
			url.hostname === 'localhost' ||
			url.hostname === '127.0.0.1' ||
			url.hostname === '::1' ||
			url.hostname === '0.0.0.0';
		return localHostname && isLaunchEnabled(url.searchParams.get('founderos_local_dev_storage'));
	} catch {
		return false;
	}
};

const getCredentialSessionStorageBucket = (): StorageLike | null =>
	isFounderosEmbeddedRuntime() && !isFounderosLocalDevCredentialStorageEnabled()
		? null
		: getSessionStorageBucket();

const getLegacyStorageBucket = (): StorageLike | null =>
	typeof localStorage === 'undefined' ? null : localStorage;

const getLegacyCompatibilityStorageBucket = (): StorageLike | null =>
	isFounderosEmbeddedRuntime() ? null : getLegacyStorageBucket();

const isFounderosEmbeddedRuntime = () => {
	if (typeof window === 'undefined') {
		return false;
	}

	try {
		const params = new URL(window.location.href).searchParams;
		return isLaunchEnabled(params.get('embedded')) || isLaunchEnabled(params.get('founderos_launch'));
	} catch {
		return false;
	}
};

const readStoredString = (storage: StorageLike | null, key: string): string | null => {
	if (!storage) {
		return null;
	}

	const raw = storage.getItem(key);
	return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
};

const isSessionGrant = (value: unknown): value is FounderosEmbeddedSessionGrant => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as FounderosEmbeddedSessionGrant;
	return (
		typeof candidate.issuedAt === 'string' &&
		candidate.issuedAt.trim().length > 0 &&
		typeof candidate.expiresAt === 'string' &&
		candidate.expiresAt.trim().length > 0 &&
		(candidate.token === undefined ||
			candidate.token === null ||
			(typeof candidate.token === 'string' && candidate.token.trim().length > 0)) &&
		(candidate.grantId === undefined ||
			candidate.grantId === null ||
			(typeof candidate.grantId === 'string' && candidate.grantId.trim().length > 0))
	);
};

export const readFounderosEmbeddedSessionGrant = (): FounderosEmbeddedSessionGrant | null => {
	if (embeddedSessionGrantMemory) {
		return embeddedSessionGrantMemory;
	}

	for (const storage of [getCredentialSessionStorageBucket(), getLegacyCompatibilityStorageBucket()]) {
		try {
			const raw = readStoredString(storage, SESSION_GRANT_STORAGE_KEY);
			if (!raw) {
				continue;
			}

			const parsed = JSON.parse(raw);
			if (isSessionGrant(parsed)) {
				embeddedSessionGrantMemory = parsed;
				return parsed;
			}
		} catch {
			// Try the next compatibility store.
		}
	}

	return null;
};

export const readFounderosEmbeddedSessionToken = (): string | null => {
	if (embeddedSessionTokenMemory) {
		return embeddedSessionTokenMemory;
	}

	return (
		readStoredString(getCredentialSessionStorageBucket(), SESSION_TOKEN_STORAGE_KEY) ??
		readStoredString(getLegacyCompatibilityStorageBucket(), SESSION_TOKEN_STORAGE_KEY)
	);
};

export const resolveFounderosEmbeddedAccessToken = (
	options: string | FounderosEmbeddedAccessTokenOptions | null = null
): string => {
	const shellIssuedSessionGrant = readFounderosEmbeddedSessionGrant();
	const fallbackToken =
		typeof options === 'string'
			? options
			: options && typeof options === 'object'
				? (options.fallbackToken ?? null)
				: null;
	const allowLegacyByOption =
		typeof options === 'string'
			? true
			: options && typeof options === 'object'
				? options.allowLegacyToken !== false
				: true;
	const allowLegacyToken =
		allowLegacyByOption && !shellIssuedSessionGrant && !isFounderosEmbeddedRuntime();
	const embeddedToken = readFounderosEmbeddedSessionToken();
	if (embeddedToken) {
		return embeddedToken;
	}

	const normalizedFallback =
		typeof fallbackToken === 'string' && fallbackToken.trim().length > 0 ? fallbackToken : '';
	if (normalizedFallback) {
		return normalizedFallback;
	}

	if (!allowLegacyToken) {
		return '';
	}

	return typeof localStorage !== 'undefined' && typeof localStorage.token === 'string'
		? String(localStorage.token)
		: '';
};

export const persistFounderosEmbeddedCredentials = (params: {
	token?: string | null;
	sessionGrant?: FounderosEmbeddedSessionGrant | null;
	storageMode?: FounderosEmbeddedCredentialStorageMode;
}) => {
	const storageMode = params.storageMode ?? 'local_dev_session_storage';
	const shouldPersistToSessionStorage = storageMode === 'local_dev_session_storage';

	if (params.token !== undefined) {
		embeddedSessionTokenMemory =
			shouldPersistToSessionStorage && params.token && String(params.token).trim().length > 0
				? String(params.token)
				: null;
	}
	if (params.sessionGrant !== undefined) {
		embeddedSessionGrantMemory =
			params.sessionGrant && !shouldPersistToSessionStorage
				? { ...params.sessionGrant, token: null }
				: (params.sessionGrant ?? null);
	}

	const sessionBucket = getCredentialSessionStorageBucket();
	const rawSessionBucket = getSessionStorageBucket();

	if (!shouldPersistToSessionStorage) {
		rawSessionBucket?.removeItem(SESSION_TOKEN_STORAGE_KEY);
		rawSessionBucket?.removeItem(SESSION_GRANT_STORAGE_KEY);
		return;
	}

	if (params.token) {
		const nextToken = String(params.token);
		sessionBucket?.setItem(SESSION_TOKEN_STORAGE_KEY, nextToken);
	} else if (params.token === null) {
		embeddedSessionTokenMemory = null;
		sessionBucket?.removeItem(SESSION_TOKEN_STORAGE_KEY);
	}

	if (params.sessionGrant) {
		sessionBucket?.setItem(SESSION_GRANT_STORAGE_KEY, JSON.stringify(params.sessionGrant));
	} else {
		embeddedSessionGrantMemory = null;
		sessionBucket?.removeItem(SESSION_GRANT_STORAGE_KEY);
	}
};

export const clearFounderosEmbeddedCredentials = () => {
	embeddedSessionTokenMemory = null;
	embeddedSessionGrantMemory = null;
	const sessionBucket = getSessionStorageBucket();
	const legacyBucket = getLegacyStorageBucket();
	sessionBucket?.removeItem(SESSION_TOKEN_STORAGE_KEY);
	sessionBucket?.removeItem(SESSION_GRANT_STORAGE_KEY);

	if (!legacyBucket) {
		return;
	}

	localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
	localStorage.removeItem(SESSION_GRANT_STORAGE_KEY);
};

export const getFounderosEmbeddedSessionAuthHeaders = () => {
	const grant = readFounderosEmbeddedSessionGrant();
	const token = resolveFounderosEmbeddedAccessToken({
		allowLegacyToken: !grant
	});

	return {
		...(token ? { authorization: `Bearer ${token}` } : {}),
		...(grant?.token ? { 'x-founderos-workspace-session-grant': grant.token } : {})
	};
};
