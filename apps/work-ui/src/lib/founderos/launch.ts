import { buildWorkspaceLaunchTokenUrl } from '@founderos/api-clients/workspace-launch-routes';

import type { FounderosLaunchContext } from '$lib/founderos';

export type FounderosLaunchIntegrityState =
	| 'not_applicable'
	| 'valid'
	| 'missing'
	| 'invalid'
	| 'expired';

export interface FounderosLaunchIntegrityResult {
	valid: boolean;
	state: FounderosLaunchIntegrityState;
	note: string;
}

type WorkspaceLaunchTokenVerificationResponse = {
	accepted?: boolean;
	state?: string;
	note?: string;
};

const normalizeOpenedFrom = (value: string | null | undefined) => {
	switch (value) {
		case 'dashboard':
		case 'execution_board':
		case 'review':
		case 'group_board':
		case 'deep_link':
			return value;
		default:
			return 'unknown';
	}
};

export const resolveFounderosLaunchVerificationUrl = (
	context: FounderosLaunchContext
) => {
	return buildWorkspaceLaunchTokenUrl(context.hostOrigin, context.sessionId);
};

export const verifyFounderosLaunchIntegrity = async (
	context: FounderosLaunchContext,
	fetchImpl: typeof fetch = fetch
): Promise<FounderosLaunchIntegrityResult> => {
	if (!context.enabled) {
		return {
			valid: false,
			state: 'not_applicable',
			note: 'FounderOS launch verification is not required for standalone mode.'
		};
	}

	const verificationUrl = resolveFounderosLaunchVerificationUrl(context);
	if (!verificationUrl) {
		return {
			valid: false,
			state: 'missing',
			note: 'FounderOS launch verification requires both hostOrigin and sessionId.'
		};
	}

	if (!context.projectId || !context.launchToken) {
		return {
			valid: false,
			state: 'missing',
			note: 'FounderOS launch verification requires projectId and launchToken.'
		};
	}

	const response = await fetchImpl(verificationUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			token: context.launchToken,
			projectId: context.projectId,
			sessionId: context.sessionId,
			groupId: context.groupId,
			accountId: context.accountId,
			workspaceId: context.workspaceId,
			openedFrom: normalizeOpenedFrom(context.rawParams.opened_from)
		})
	}).catch(() => null);

	if (!response) {
		return {
			valid: false,
			state: 'invalid',
			note: 'FounderOS launch verification request failed.'
		};
	}

	const payload = (await response.json().catch(() => null)) as WorkspaceLaunchTokenVerificationResponse | null;
	if (!payload || typeof payload.state !== 'string') {
		return {
			valid: false,
			state: 'invalid',
			note: 'FounderOS launch verification returned an invalid response.'
		};
	}

	const state =
		payload.state === 'valid' ||
		payload.state === 'missing' ||
		payload.state === 'invalid' ||
		payload.state === 'expired'
			? payload.state
			: 'invalid';

	return {
		valid: response.ok && payload.accepted === true && state === 'valid',
		state,
		note:
			typeof payload.note === 'string' && payload.note.trim().length > 0
				? payload.note
				: 'FounderOS launch verification failed.'
	};
};
