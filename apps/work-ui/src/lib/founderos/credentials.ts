export interface FounderosEmbeddedSessionGrant {
	token: string;
	issuedAt: string;
	expiresAt: string;
}

const SESSION_TOKEN_STORAGE_KEY = 'founderos.workspace.sessionToken';
const SESSION_GRANT_STORAGE_KEY = 'founderos.workspace.sessionGrant';
const PREVIOUS_TOKEN_STORAGE_KEY = 'founderos.workspace.previousToken';

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
	if (typeof localStorage === 'undefined') {
		return null;
	}

	try {
		const raw = localStorage.getItem(SESSION_GRANT_STORAGE_KEY);
		if (!raw) {
			return null;
		}

		const parsed = JSON.parse(raw);
		return isSessionGrant(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

export const readFounderosEmbeddedSessionToken = (): string | null => {
	if (typeof localStorage === 'undefined') {
		return null;
	}

	const raw = localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
	return typeof raw === 'string' && raw.trim().length > 0 ? raw : null;
};

export const resolveFounderosEmbeddedAccessToken = (
	fallbackToken: string | null = null
): string => {
	const embeddedToken = readFounderosEmbeddedSessionToken();
	if (embeddedToken) {
		return embeddedToken;
	}

	const normalizedFallback =
		typeof fallbackToken === 'string' && fallbackToken.trim().length > 0 ? fallbackToken : '';
	if (normalizedFallback) {
		return normalizedFallback;
	}

	return typeof localStorage !== 'undefined' && typeof localStorage.token === 'string'
		? String(localStorage.token)
		: '';
};

export const persistFounderosEmbeddedCredentials = (params: {
	token?: string | null;
	sessionGrant?: FounderosEmbeddedSessionGrant | null;
}) => {
	if (typeof localStorage === 'undefined') {
		return;
	}

	if (params.token) {
		const nextToken = String(params.token);
		localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, nextToken);
		const currentToken =
			typeof localStorage.token === 'string' ? String(localStorage.token) : '';

		if (currentToken && currentToken !== nextToken) {
			localStorage.setItem(PREVIOUS_TOKEN_STORAGE_KEY, currentToken);
		} else if (!currentToken) {
			localStorage.removeItem(PREVIOUS_TOKEN_STORAGE_KEY);
		}

		localStorage.token = nextToken;
	} else if (params.token === null) {
		localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
	}

	if (params.sessionGrant) {
		localStorage.setItem(SESSION_GRANT_STORAGE_KEY, JSON.stringify(params.sessionGrant));
	} else {
		localStorage.removeItem(SESSION_GRANT_STORAGE_KEY);
	}
};

export const clearFounderosEmbeddedCredentials = () => {
	if (typeof localStorage === 'undefined') {
		return;
	}

	const previousToken = localStorage.getItem(PREVIOUS_TOKEN_STORAGE_KEY);
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
	const token = resolveFounderosEmbeddedAccessToken();

	return {
		...(token ? { authorization: `Bearer ${token}` } : {}),
		...(grant?.token ? { 'x-founderos-workspace-session-grant': grant.token } : {})
	};
};
