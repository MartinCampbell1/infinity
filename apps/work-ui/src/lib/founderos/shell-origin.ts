import type { FounderosLaunchContext } from '$lib/founderos';

const DEFAULT_LOCAL_SHELL_ORIGIN = 'http://127.0.0.1:3737';
const LOCAL_WORK_UI_ORIGINS = new Set([
	'http://127.0.0.1:3101',
	'http://localhost:3101'
]);

const trimOrigin = (value: string | null | undefined) => {
	const trimmed = value?.trim();
	return trimmed ? trimmed.replace(/\/$/, '') : null;
};

export const resolveFounderosShellOrigin = (
	context: FounderosLaunchContext,
	windowOrigin?: string | null
) => {
	const hostOrigin = trimOrigin(context.hostOrigin);
	if (hostOrigin) {
		return hostOrigin;
	}

	const configuredOrigin = trimOrigin(import.meta.env.PUBLIC_FOUNDEROS_SHELL_ORIGIN);
	if (configuredOrigin) {
		return configuredOrigin;
	}

	const currentOrigin = trimOrigin(windowOrigin);
	if (currentOrigin && !LOCAL_WORK_UI_ORIGINS.has(currentOrigin)) {
		return currentOrigin;
	}

	return DEFAULT_LOCAL_SHELL_ORIGIN;
};

export { DEFAULT_LOCAL_SHELL_ORIGIN };
