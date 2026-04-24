import type { Handle } from '@sveltejs/kit';

type EnvLike = Readonly<Record<string, string | undefined>>;

const LOCAL_SHELL_FRAME_ANCESTORS = ['http://localhost:3737', 'http://127.0.0.1:3737'];

const normalizeFrameAncestorOrigin = (value: string | null | undefined) => {
	const trimmed = value?.trim();
	if (!trimmed) {
		return null;
	}

	try {
		const parsed = new URL(trimmed);
		if (!['http:', 'https:'].includes(parsed.protocol)) {
			return null;
		}
		return parsed.origin;
	} catch {
		return null;
	}
};

const addFrameAncestorOrigin = (target: Set<string>, value: string | null | undefined) => {
	const origin = normalizeFrameAncestorOrigin(value);
	if (origin) {
		target.add(origin);
	}
};

const addFrameAncestorList = (target: Set<string>, value: string | null | undefined) => {
	for (const origin of (value ?? '').split(',')) {
		addFrameAncestorOrigin(target, origin);
	}
};

const isProductionLike = (env: EnvLike) =>
	env.NODE_ENV === 'production' ||
	env.FOUNDEROS_DEPLOYMENT_ENV === 'production' ||
	env.FOUNDEROS_DEPLOYMENT_ENV === 'staging';

export const resolveWorkUiFrameAncestors = (env: EnvLike = process.env) => {
	const ancestors = new Set(["'self'"]);

	addFrameAncestorList(ancestors, env.FOUNDEROS_WORK_UI_FRAME_ANCESTORS);
	addFrameAncestorOrigin(ancestors, env.FOUNDEROS_SHELL_PUBLIC_ORIGIN);
	addFrameAncestorOrigin(ancestors, env.NEXT_PUBLIC_FOUNDEROS_SHELL_PUBLIC_ORIGIN);

	if (!isProductionLike(env)) {
		for (const origin of LOCAL_SHELL_FRAME_ANCESTORS) {
			ancestors.add(origin);
		}
	}

	return [...ancestors];
};

const buildWorkUiCsp = (env: EnvLike = process.env) =>
	[
		"default-src 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		`frame-ancestors ${resolveWorkUiFrameAncestors(env).join(' ')}`,
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data:",
		"connect-src 'self' http: https: ws: wss:",
		"worker-src 'self' blob:",
		'trusted-types default dompurify founderos-work-ui',
		"require-trusted-types-for 'script'"
	].join('; ');

export const buildWorkUiSecurityHeaders = (env: EnvLike = process.env) => ({
	'Content-Security-Policy': buildWorkUiCsp(env),
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'X-Content-Type-Options': 'nosniff'
});

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	for (const [header, value] of Object.entries(buildWorkUiSecurityHeaders())) {
		response.headers.set(header, value);
	}

	return response;
};
