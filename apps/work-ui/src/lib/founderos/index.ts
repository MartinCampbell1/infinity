import { page } from '$app/stores';
import { derived, type Readable } from 'svelte/store';

export type FounderosLaunchSource = 'standalone' | 'founderos_launch' | 'founderos_embedded';

export interface FounderosLaunchContext {
	enabled: boolean;
	embedded: boolean;
	projectId: string | null;
	sessionId: string | null;
	groupId: string | null;
	accountId: string | null;
	workspaceId: string | null;
	launchToken: string | null;
	hostOrigin: string | null;
	rawParams: Record<string, string>;
	launchSource: FounderosLaunchSource;
}

const STORED_LAUNCH_TOKEN_KEY = 'founderos.workspace.launchToken';

const toNullIfBlank = (value: string | null | undefined) => {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
};

const isLaunchEnabled = (value: string | null) => value === '1' || value === 'true';

const toTrustedOrigin = (value: string | null) => {
	const normalized = toNullIfBlank(value);
	if (!normalized) {
		return null;
	}

	try {
		const parsed = new URL(normalized);
		if (!['http:', 'https:'].includes(parsed.protocol)) {
			return null;
		}
		return parsed.origin;
	} catch {
		return null;
	}
};

type StoredLaunchToken = {
	token: string;
	projectId: string;
	sessionId: string;
	hostOrigin: string | null;
};

const readStoredLaunchToken = (
	projectId: string | null,
	sessionId: string | null,
	hostOrigin: string | null
) => {
	if (typeof sessionStorage === 'undefined' || !projectId || !sessionId) {
		return null;
	}

	try {
		const raw = sessionStorage.getItem(STORED_LAUNCH_TOKEN_KEY);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as Partial<StoredLaunchToken>;
		if (
			typeof parsed.token !== 'string' ||
			typeof parsed.projectId !== 'string' ||
			typeof parsed.sessionId !== 'string'
		) {
			return null;
		}
		if (parsed.projectId !== projectId || parsed.sessionId !== sessionId) {
			return null;
		}
		if ((parsed.hostOrigin ?? null) !== hostOrigin) {
			return null;
		}
		return parsed.token;
	} catch {
		return null;
	}
};

const persistLaunchToken = (
	token: string | null,
	projectId: string | null,
	sessionId: string | null,
	hostOrigin: string | null
) => {
	if (typeof sessionStorage === 'undefined') {
		return;
	}

	if (!token || !projectId || !sessionId) {
		sessionStorage.removeItem(STORED_LAUNCH_TOKEN_KEY);
		return;
	}

	sessionStorage.setItem(
		STORED_LAUNCH_TOKEN_KEY,
		JSON.stringify({
			token,
			projectId,
			sessionId,
			hostOrigin
		} satisfies StoredLaunchToken)
	);
};

export const parseFounderosLaunchContext = (url: URL): FounderosLaunchContext => {
	const params = url.searchParams;
	const launchEnabled = isLaunchEnabled(params.get('founderos_launch'));
	const embedded = isLaunchEnabled(params.get('embedded'));
	const enabled = launchEnabled || embedded;
	const projectId = toNullIfBlank(params.get('project_id'));
	const sessionId = toNullIfBlank(params.get('session_id'));
	const hostOrigin = toTrustedOrigin(params.get('host_origin'));
	const explicitLaunchToken = toNullIfBlank(params.get('launch_token'));
	const storedLaunchToken =
		enabled && !explicitLaunchToken
			? readStoredLaunchToken(projectId, sessionId, hostOrigin)
			: null;
	const launchToken = explicitLaunchToken ?? storedLaunchToken;

	if (enabled) {
		persistLaunchToken(launchToken, projectId, sessionId, hostOrigin);
	}

	return {
		enabled,
		embedded,
		projectId,
		sessionId,
		groupId: toNullIfBlank(params.get('group_id')),
		accountId: toNullIfBlank(params.get('account_id')),
		workspaceId: toNullIfBlank(params.get('workspace_id')),
		launchToken,
		hostOrigin,
		rawParams: Object.fromEntries(params.entries()),
		launchSource: embedded ? 'founderos_embedded' : launchEnabled ? 'founderos_launch' : 'standalone'
	};
};

export const founderosLaunchContext: Readable<FounderosLaunchContext> = derived(
	page,
	($page) => parseFounderosLaunchContext($page.url)
);
