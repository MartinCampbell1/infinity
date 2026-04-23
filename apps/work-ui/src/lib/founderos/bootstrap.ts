import type { SessionWorkspaceHostContext } from '$lib/founderos/types';
import type { FounderosLaunchContext } from '$lib/founderos';

export interface FounderosLaunchBootstrapUser {
	id: string;
	email: string;
	name: string;
	role: 'user' | 'admin';
	profile_image_url: string;
	permissions: {
		chat?: {
			temporary?: boolean;
		};
	};
}

export type FounderosLaunchBootstrapAuthMode = 'bootstrap_only' | 'session_exchange';

export interface FounderosLaunchBootstrapAuthState {
	mode: FounderosLaunchBootstrapAuthMode;
	note: string;
	sessionExchangePath: string;
	sessionBearerExchangePath?: string | null;
}

export interface FounderosLaunchBootstrapPayload {
	accepted: boolean;
	canonicalTruth: 'sessionId';
	note: string;
	user: FounderosLaunchBootstrapUser;
	hostContext: SessionWorkspaceHostContext;
	auth: FounderosLaunchBootstrapAuthState;
	ui: {
		showSidebar: boolean;
		showControls: boolean;
		selectedTerminalId: string | null;
		temporaryChatEnabled: boolean;
		settings: {
			showChangelog: boolean;
			showUpdateToast: boolean;
			models: string[];
			toolServers: Array<{
				url: string;
				auth_type?: string;
				key?: string;
				path?: string;
				config?: { enable?: boolean };
			}>;
			terminalServers: Array<{
				id?: string;
				name?: string;
				url: string;
				enabled?: boolean;
				auth_type?: string;
				key?: string;
				path?: string;
			}>;
		};
		models: Array<{
			id: string;
			name: string;
			owned_by: 'openai';
			external: boolean;
			source?: string;
		}>;
		toolServers: Array<{
			url: string;
			auth_type?: string;
			key?: string;
			path?: string;
			config?: { enable?: boolean };
		}>;
		terminalServers: Array<{
			id?: string;
			name?: string;
			url: string;
			enabled?: boolean;
			auth_type?: string;
			key?: string;
			path?: string;
		}>;
		banners: Array<{
			id: string;
			type: string;
			title?: string;
			content: string;
			url?: string;
			dismissible?: boolean;
			timestamp: number;
		}>;
		tools: null;
	};
}

export interface FounderosLaunchBootstrapResult {
	accepted: boolean;
	note: string;
	payload: FounderosLaunchBootstrapPayload | null;
}

export interface FounderosLaunchSessionExchangeResult {
	accepted: boolean;
	note: string;
	token: string | null;
	user: FounderosLaunchBootstrapUser | null;
	sessionGrant: {
		token: string;
		issuedAt: string;
		expiresAt: string;
	} | null;
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const isToolServerConfig = (
	value: unknown
): value is FounderosLaunchBootstrapPayload['ui']['toolServers'][number] => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as FounderosLaunchBootstrapPayload['ui']['toolServers'][number];
	return isString(candidate.url);
};

const isTerminalServerConfig = (
	value: unknown
): value is FounderosLaunchBootstrapPayload['ui']['terminalServers'][number] => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as FounderosLaunchBootstrapPayload['ui']['terminalServers'][number];
	return isString(candidate.url);
};

const isModelDescriptor = (
	value: unknown
): value is FounderosLaunchBootstrapPayload['ui']['models'][number] => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as FounderosLaunchBootstrapPayload['ui']['models'][number];
	return (
		isString(candidate.id) &&
		isString(candidate.name) &&
		candidate.owned_by === 'openai' &&
		isBoolean(candidate.external)
	);
};

const isBannerDescriptor = (
	value: unknown
): value is FounderosLaunchBootstrapPayload['ui']['banners'][number] => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as FounderosLaunchBootstrapPayload['ui']['banners'][number];
	return (
		isString(candidate.id) &&
		isString(candidate.type) &&
		isString(candidate.content) &&
		typeof candidate.timestamp === 'number'
	);
};

const isBootstrapUiState = (
	value: unknown
): value is FounderosLaunchBootstrapPayload['ui'] => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as FounderosLaunchBootstrapPayload['ui'];
	return (
		isBoolean(candidate.showSidebar) &&
		isBoolean(candidate.showControls) &&
		(candidate.selectedTerminalId === null || isString(candidate.selectedTerminalId)) &&
		isBoolean(candidate.temporaryChatEnabled) &&
		!!candidate.settings &&
		isBoolean(candidate.settings.showChangelog) &&
		isBoolean(candidate.settings.showUpdateToast) &&
		Array.isArray(candidate.settings.models) &&
		candidate.settings.models.every(isString) &&
		Array.isArray(candidate.settings.toolServers) &&
		candidate.settings.toolServers.every(isToolServerConfig) &&
		Array.isArray(candidate.settings.terminalServers) &&
		candidate.settings.terminalServers.every(isTerminalServerConfig) &&
		Array.isArray(candidate.models) &&
		candidate.models.every(isModelDescriptor) &&
		Array.isArray(candidate.toolServers) &&
		candidate.toolServers.every(isToolServerConfig) &&
		Array.isArray(candidate.terminalServers) &&
		candidate.terminalServers.every(isTerminalServerConfig) &&
		Array.isArray(candidate.banners) &&
		candidate.banners.every(isBannerDescriptor) &&
		candidate.tools === null
	);
};

const isHostContext = (value: unknown): value is SessionWorkspaceHostContext => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as SessionWorkspaceHostContext;
	return (
		isString(candidate.projectId) &&
		isString(candidate.projectName) &&
		isString(candidate.sessionId) &&
		isString(candidate.openedFrom)
	);
};

const isBootstrapAuthState = (value: unknown): value is FounderosLaunchBootstrapAuthState => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as FounderosLaunchBootstrapAuthState;

	return (
		(candidate.mode === 'bootstrap_only' || candidate.mode === 'session_exchange') &&
		isString(candidate.note) &&
		((isString(candidate.sessionExchangePath) && candidate.sessionExchangePath.trim().length > 0) ||
			(isString(candidate.sessionBearerExchangePath) &&
				candidate.sessionBearerExchangePath.trim().length > 0))
	);
};

const isBootstrapPayload = (value: unknown): value is FounderosLaunchBootstrapPayload => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as FounderosLaunchBootstrapPayload;
	return (
		candidate.accepted === true &&
		candidate.canonicalTruth === 'sessionId' &&
		isString(candidate.note) &&
		!!candidate.user &&
		isString(candidate.user.id) &&
		isString(candidate.user.email) &&
		isString(candidate.user.name) &&
		(candidate.user.role === 'user' || candidate.user.role === 'admin') &&
		isHostContext(candidate.hostContext) &&
		isBootstrapAuthState(candidate.auth) &&
		isBootstrapUiState(candidate.ui)
	);
};

export const resolveFounderosLaunchBootstrapUrl = (context: FounderosLaunchContext) => {
	if (!context.hostOrigin || !context.sessionId) {
		return null;
	}

	return `${context.hostOrigin}/api/control/execution/workspace/${encodeURIComponent(context.sessionId)}/bootstrap`;
};

export const fetchFounderosLaunchBootstrap = async (
	context: FounderosLaunchContext,
	fetchImpl: typeof fetch = fetch
): Promise<FounderosLaunchBootstrapResult> => {
	if (!context.enabled) {
		return {
			accepted: false,
			note: 'FounderOS bootstrap is not required for standalone mode.',
			payload: null
		};
	}

	const bootstrapUrl = resolveFounderosLaunchBootstrapUrl(context);
	if (!bootstrapUrl || !context.projectId || !context.launchToken) {
		return {
			accepted: false,
			note: 'FounderOS bootstrap requires hostOrigin, sessionId, projectId, and launchToken.',
			payload: null
		};
	}

	const response = await fetchImpl(bootstrapUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			token: context.launchToken,
			projectId: context.projectId,
			sessionId: context.sessionId,
			groupId: context.groupId,
			accountId: context.accountId,
			workspaceId: context.workspaceId,
			openedFrom: context.rawParams.opened_from
		})
	}).catch(() => null);

	if (!response) {
		return {
			accepted: false,
			note: 'FounderOS bootstrap request failed.',
			payload: null
		};
	}

	const payload = await response.json().catch(() => null);
	if (!response.ok || !isBootstrapPayload(payload)) {
		const invalidBootstrapShape =
			response.ok && payload && typeof payload === 'object' && !isBootstrapPayload(payload);
		return {
			accepted: false,
			note:
				invalidBootstrapShape
					? 'FounderOS bootstrap returned an invalid response.'
					: payload && typeof payload.note === 'string'
					? payload.note
					: 'FounderOS bootstrap returned an invalid response.',
			payload: null
		};
	}

	return {
		accepted: true,
		note: payload.note,
		payload
	};
};

export const resolveFounderosLaunchSessionUrl = (
	context: FounderosLaunchContext,
	authState?: Partial<
		Pick<
		FounderosLaunchBootstrapAuthState,
		'sessionExchangePath' | 'sessionBearerExchangePath'
		>
	>
) => {
	if (!context.hostOrigin) {
		return null;
	}

	const exchangePath = authState?.sessionExchangePath ?? null;
	const compatibilityExchangePath =
		!context.embedded ? authState?.sessionBearerExchangePath ?? null : null;

	if (exchangePath?.startsWith('http://') || exchangePath?.startsWith('https://')) {
		return exchangePath;
	}

	if (exchangePath) {
		return `${context.hostOrigin}${exchangePath}`;
	}

	if (compatibilityExchangePath?.startsWith('http://') || compatibilityExchangePath?.startsWith('https://')) {
		return compatibilityExchangePath;
	}

	if (compatibilityExchangePath) {
		return `${context.hostOrigin}${compatibilityExchangePath}`;
	}

	if (!context.sessionId) {
		return null;
	}

	return `${context.hostOrigin}/api/control/execution/workspace/${encodeURIComponent(
		context.sessionId
	)}/session`;
};

export const exchangeFounderosLaunchSession = async (
	context: FounderosLaunchContext,
	authState: Partial<
		Pick<
		FounderosLaunchBootstrapAuthState,
		'sessionExchangePath' | 'sessionBearerExchangePath'
		>
	>,
	fetchImpl: typeof fetch = fetch
): Promise<FounderosLaunchSessionExchangeResult> => {
	if (!context.enabled) {
				return {
					accepted: false,
					note: 'FounderOS session exchange is not required for standalone mode.',
					token: null,
					user: null,
					sessionGrant: null
				};
			}

	const exchangeUrl = resolveFounderosLaunchSessionUrl(context, authState);
	if (!exchangeUrl || !context.projectId || !context.launchToken) {
				return {
					accepted: false,
					note: 'FounderOS session exchange requires hostOrigin, sessionId, projectId, and a valid launch token.',
					token: null,
					user: null,
					sessionGrant: null
				};
			}

	const response = await fetchImpl(exchangeUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			token: context.launchToken,
			projectId: context.projectId,
			sessionId: context.sessionId,
			groupId: context.groupId,
			accountId: context.accountId,
			workspaceId: context.workspaceId,
			openedFrom: context.rawParams.opened_from
		})
	}).catch(() => null);

	if (!response) {
				return {
					accepted: false,
					note: 'FounderOS session exchange request failed.',
					token: null,
					user: null,
					sessionGrant: null
				};
			}

	const payload = await response.json().catch(() => null);
	const payloadRecord = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
	const sessionCandidate =
		payloadRecord?.session && typeof payloadRecord.session === 'object'
			? (payloadRecord.session as Record<string, unknown>)
			: null;
	const sessionGrantCandidate =
		payloadRecord?.sessionGrant && typeof payloadRecord.sessionGrant === 'object'
			? (payloadRecord.sessionGrant as Record<string, unknown>)
			: null;
	const sessionGrant =
		typeof sessionGrantCandidate?.token === 'string' &&
		typeof sessionGrantCandidate?.issuedAt === 'string' &&
		typeof sessionGrantCandidate?.expiresAt === 'string'
			? {
					token: sessionGrantCandidate.token,
					issuedAt: sessionGrantCandidate.issuedAt,
					expiresAt: sessionGrantCandidate.expiresAt
				}
			: null;
	const token =
		typeof sessionCandidate?.token === 'string' && sessionCandidate.token.trim().length > 0
			? sessionCandidate.token
			: null;
	const userCandidate =
		payloadRecord?.user && typeof payloadRecord.user === "object"
			? (payloadRecord.user as Record<string, unknown>)
			: null;
	const user =
		typeof userCandidate?.id === 'string' &&
		typeof userCandidate?.email === 'string' &&
		typeof userCandidate?.name === 'string' &&
		(userCandidate?.role === 'user' || userCandidate?.role === 'admin')
			? {
					id: userCandidate.id,
					email: userCandidate.email,
					name: userCandidate.name,
					role: userCandidate.role as 'user' | 'admin',
					profile_image_url:
						typeof userCandidate.profile_image_url === 'string' ? userCandidate.profile_image_url : '',
					permissions:
						userCandidate.permissions && typeof userCandidate.permissions === 'object'
							? (userCandidate.permissions as FounderosLaunchBootstrapUser['permissions'])
							: {}
				}
			: null;
	if (!response.ok || !token) {
		return {
			accepted: false,
			note:
				typeof payloadRecord?.note === 'string'
						? payloadRecord.note
						: 'FounderOS session exchange returned an invalid response.',
			token: null,
			user,
			sessionGrant
		};
	}

	return {
		accepted: true,
		note:
				typeof payloadRecord?.note === 'string'
					? payloadRecord.note
					: 'FounderOS embedded session exchange succeeded.',
			token,
			user,
			sessionGrant
		};
};
