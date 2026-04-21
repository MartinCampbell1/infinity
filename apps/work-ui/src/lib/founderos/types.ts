export interface SessionWorkspaceHostContext {
	projectId: string;
	projectName: string;
	sessionId: string;
	externalSessionId?: string | null;
	groupId?: string | null;
	workspaceId?: string | null;
	accountId?: string | null;
	accountLabel?: string | null;
	model?: string | null;
	executionMode?: 'local' | 'worktree' | 'cloud' | 'hermes' | 'unknown';
	quotaState?: {
		pressure: 'low' | 'medium' | 'high' | 'exhausted' | 'unknown';
		usedPercent?: number | null;
		resetsAt?: string | null;
	};
	pendingApprovals?: number;
	openedFrom:
		| 'dashboard'
		| 'execution_board'
		| 'review'
		| 'group_board'
		| 'deep_link'
		| 'unknown';
}

export type HostToWorkspaceMessage =
	| { type: 'founderos.bootstrap'; payload: SessionWorkspaceHostContext }
	| { type: 'founderos.account.switch'; payload: { accountId: string } }
	| {
			type: 'founderos.session.retry';
			payload: { retryMode: 'same_account' | 'fallback_account' };
	  }
	| {
			type: 'founderos.session.focus';
			payload: { section: 'chat' | 'files' | 'approvals' | 'diff' };
	  }
	| { type: 'founderos.session.meta'; payload: Partial<SessionWorkspaceHostContext> };

export type WorkspaceRuntimeBridgeWorkspaceMessage =
	| { type: 'workspace.ready' }
	| { type: 'workspace.session.updated'; payload: { title?: string; status?: string } }
	| { type: 'workspace.tool.started'; payload: { toolName: string; eventId: string } }
	| {
			type: 'workspace.tool.completed';
			payload: { toolName: string; eventId: string; status: 'completed' | 'failed' };
	  }
	| { type: 'workspace.approval.requested'; payload: { approvalId: string; summary: string } }
	| { type: 'workspace.file.opened'; payload: { path: string } }
	| { type: 'workspace.error'; payload: { code?: string; message: string } }
	| { type: 'workspace.deepLink'; payload: { sessionId: string; filePath?: string; anchor?: string } };

export interface WorkspaceRuntimeProducerBatchMessage {
	type: 'workspace.producer.batch';
	payload: {
		producer: 'workspace_runtime_bridge';
		messages: WorkspaceRuntimeBridgeWorkspaceMessage[];
	};
}

export type WorkspaceToHostMessage =
	| WorkspaceRuntimeBridgeWorkspaceMessage
	| WorkspaceRuntimeProducerBatchMessage;
