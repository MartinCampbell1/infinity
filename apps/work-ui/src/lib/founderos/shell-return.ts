import type { SessionWorkspaceHostContext } from '$lib/founderos/types';

export const resolveFounderosShellReturnPath = (
	context: SessionWorkspaceHostContext | null
) => {
	if (context?.sessionId) {
		const searchParams = new URLSearchParams();
		if (context.projectId) {
			searchParams.set('project_id', context.projectId);
		}
		searchParams.set('session_id', context.sessionId);
		if (context.groupId) {
			searchParams.set('group_id', context.groupId);
		}
		if (context.accountId) {
			searchParams.set('account_id', context.accountId);
		}
		if (context.workspaceId) {
			searchParams.set('workspace_id', context.workspaceId);
		}
		if (context.openedFrom) {
			searchParams.set('opened_from', context.openedFrom);
		}
		return `/execution/workspace/${encodeURIComponent(context.sessionId)}?${searchParams.toString()}`;
	}

	switch (context?.openedFrom) {
		case 'dashboard':
			return '/execution';
		case 'review':
			return '/execution/review';
		case 'group_board':
			return '/execution/groups';
		case 'deep_link':
			return '/execution/sessions';
		case 'execution_board':
		case 'unknown':
		default:
			return '/execution';
	}
};
