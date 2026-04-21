import type { FounderosLaunchContext } from './index';

type ExtraParams = Record<string, string | null | undefined>;

const FORWARDABLE_FOUNDEROS_PARAMS = new Set([
	'founderos_launch',
	'embedded',
	'project_id',
	'session_id',
	'group_id',
	'account_id',
	'workspace_id',
	'host_origin',
	'opened_from'
]);

const appendFounderosScope = (
	searchParams: URLSearchParams,
	context: FounderosLaunchContext
) => {
	if (!context.enabled) {
		return;
	}

	for (const [key, value] of Object.entries(context.rawParams)) {
		if (!FORWARDABLE_FOUNDEROS_PARAMS.has(key)) {
			continue;
		}
		const trimmed = value.trim();
		if (trimmed) {
			searchParams.set(key, trimmed);
		}
	}
};

export const buildFounderosScopedHref = (
	pathname: string,
	context: FounderosLaunchContext,
	extraParams: ExtraParams = {}
) => {
	const searchParams = new URLSearchParams();
	appendFounderosScope(searchParams, context);

	for (const [key, value] of Object.entries(extraParams)) {
		const trimmed = value?.trim();
		if (trimmed) {
			searchParams.set(key, trimmed);
		}
	}

	const query = searchParams.toString();
	return query ? `${pathname}?${query}` : pathname;
};

export const buildFounderosRootHref = (
	context: FounderosLaunchContext,
	extraParams: ExtraParams = {}
) => buildFounderosScopedHref('/', context, extraParams);

export const buildFounderosChatHref = (chatId: string, context: FounderosLaunchContext) =>
	buildFounderosScopedHref(`/c/${encodeURIComponent(chatId)}`, context);

export const buildFounderosShellHref = (
	href: string,
	context: FounderosLaunchContext,
	shellOrigin?: string | null
) => {
	const normalizedOrigin = shellOrigin?.trim();
	if (!normalizedOrigin) {
		return href;
	}

	const target = new URL(href, normalizedOrigin);
	const searchParams = new URLSearchParams();
	appendFounderosScope(searchParams, context);

	for (const [key, value] of target.searchParams.entries()) {
		const trimmed = value.trim();
		if (trimmed) {
			searchParams.set(key, trimmed);
		}
	}

	target.search = searchParams.toString();
	return target.toString();
};
