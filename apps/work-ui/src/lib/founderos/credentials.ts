export interface FounderosEmbeddedSessionGrant {
	token: string;
	issuedAt: string;
	expiresAt: string;
}

export interface FounderosEmbeddedAccessTokenOptions {
	fallbackToken?: string | null;
	allowLegacyToken?: boolean;
}

const SESSION_TOKEN_STORAGE_KEY = 'founderos.workspace.sessionToken';
const SESSION_GRANT_STORAGE_KEY = 'founderos.workspace.sessionGrant';
const PREVIOUS_TOKEN_STORAGE_KEY = 'founderos.workspace.previousToken';
let embeddedSessionTokenMemory: string | null = null;
let embeddedSessionGrantMemory: FounderosEmbeddedSessionGrant | null = null;
let previousLegacyTokenMemory: string | null = null;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const getSessionStorageBucket = (): StorageLike | null =>
	typeof sessionStorage === 'undefined' ? null : sessionStorage;

const getLegacyStorageBucket = (): StorageLike | null =>
	typeof localStorage === 'undefined' ? null : localStorage;

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
		typeof candidate.token === 'string' &&
		candidate.token.trim().length > 0 &&
		typeof candidate.issuedAt === 'string' &&
		candidate.issuedAt.trim().length > 0 &&
		typeof candidate.expiresAt === 'string' &&
		candidate.expiresAt.trim().length > 0
	);
};

export const readFounderosEmbeddedSessionGrant = (): FounderosEmbeddedSessionGrant | null => {
	if (embeddedSessionGrantMemory) {
		return embeddedSessionGrantMemory;
	}

	for (const storage of [getSessionStorageBucket(), getLegacyStorageBucket()]) {
		try {
			const raw = readStoredString(storage, SESSION_GRANT_STORAGE_KEY);
			if (!raw) {
				continue;
			}

			const parsed = JSON.parse(raw);
			if (isSessionGrant(parsed)) {
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
		readStoredString(getSessionStorageBucket(), SESSION_TOKEN_STORAGE_KEY) ??
		readStoredString(getLegacyStorageBucket(), SESSION_TOKEN_STORAGE_KEY)
	);
};

export const resolveFounderosEmbeddedAccessToken = (
	options: string | FounderosEmbeddedAccessTokenOptions | null = null
): string => {
	const fallbackToken =
		typeof options === 'string'
			? options
			: options && typeof options === 'object'
				? (options.fallbackToken ?? null)
				: null;
	const allowLegacyToken =
		typeof options === 'string'
			? true
			: options && typeof options === 'object'
				? options.allowLegacyToken !== false
				: true;
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
}) => {
	if (params.token !== undefined) {
		embeddedSessionTokenMemory =
			params.token && String(params.token).trim().length > 0 ? String(params.token) : null;
	}
	if (params.sessionGrant !== undefined) {
		embeddedSessionGrantMemory = params.sessionGrant ?? null;
	}

	const sessionBucket = getSessionStorageBucket();
	const legacyBucket = getLegacyStorageBucket();

	if (params.token) {
		const nextToken = String(params.token);
		sessionBucket?.setItem(SESSION_TOKEN_STORAGE_KEY, nextToken);
		const currentToken =
			legacyBucket && typeof localStorage.token === 'string' ? String(localStorage.token) : '';

		if (currentToken && currentToken !== nextToken) {
			previousLegacyTokenMemory = currentToken;
			sessionBucket?.setItem(PREVIOUS_TOKEN_STORAGE_KEY, currentToken);
		} else if (!currentToken && !previousLegacyTokenMemory) {
			sessionBucket?.removeItem(PREVIOUS_TOKEN_STORAGE_KEY);
		}

		if (legacyBucket) {
			localStorage.token = nextToken;
		}
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
	const previousToken =
		previousLegacyTokenMemory ??
		readStoredString(sessionBucket, PREVIOUS_TOKEN_STORAGE_KEY) ??
		readStoredString(getLegacyStorageBucket(), PREVIOUS_TOKEN_STORAGE_KEY);
	previousLegacyTokenMemory = null;
	sessionBucket?.removeItem(PREVIOUS_TOKEN_STORAGE_KEY);
	sessionBucket?.removeItem(SESSION_TOKEN_STORAGE_KEY);
	sessionBucket?.removeItem(SESSION_GRANT_STORAGE_KEY);

	if (!legacyBucket) {
		return;
	}

	if (previousToken) {
		localStorage.token = previousToken;
	} else {
		localStorage.removeItem('token');
		localStorage.token = '';
	}
	localStorage.removeItem(PREVIOUS_TOKEN_STORAGE_KEY);
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
