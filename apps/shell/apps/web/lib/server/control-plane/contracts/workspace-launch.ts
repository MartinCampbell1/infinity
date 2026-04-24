import type {
  ExecutionProvider,
  ExecutionSessionPhase,
  ExecutionSessionStatus,
  ExecutionSessionSummary,
  NormalizedExecutionEvent,
} from "./session-events";
import type { ApprovalRequest } from "./approvals";
import type { RecoveryIncident } from "./recoveries";
import type {
  ControlPlaneIntegrationState,
  ControlPlaneStorageKind,
} from "./control-plane-meta";

export const DEFAULT_LOCAL_WORK_UI_BASE_URL = "http://127.0.0.1:3101";

export const WORK_UI_BASE_URL_ENV_KEYS = [
  "FOUNDEROS_WORK_UI_BASE_URL",
  "NEXT_PUBLIC_FOUNDEROS_WORK_UI_BASE_URL",
  "WORK_UI_BASE_URL",
  "NEXT_PUBLIC_WORK_UI_BASE_URL",
] as const;

export type WorkspaceLaunchTokenState = "todo" | "signed";
export type WorkspaceLaunchTokenVerificationState =
  | "valid"
  | "missing"
  | "invalid"
  | "expired";

export interface WorkspaceLaunchQueryItem {
  label: string;
  value: string;
}

export interface WorkspaceLaunchRefs {
  projectId: string;
  sessionId: string;
  groupId?: string | null;
  accountId?: string | null;
  workspaceId?: string | null;
}

export interface WorkspaceLaunchTokenClaims extends WorkspaceLaunchRefs {
  v: 1;
  openedFrom:
    | "dashboard"
    | "execution_board"
    | "review"
    | "group_board"
    | "deep_link"
    | "unknown";
  issuedAt: string;
  expiresAt: string;
}

export interface WorkspaceHostQuotaState {
  pressure: "low" | "medium" | "high" | "exhausted" | "unknown";
  usedPercent?: number | null;
  resetsAt?: string | null;
}

export interface SessionWorkspaceHostContext extends WorkspaceLaunchRefs {
  projectName: string;
  externalSessionId?: string | null;
  accountLabel?: string | null;
  model?: string | null;
  executionMode?: "local" | "worktree" | "cloud" | "hermes" | "unknown";
  quotaState?: WorkspaceHostQuotaState;
  pendingApprovals?: number;
  openedFrom:
    | "dashboard"
    | "execution_board"
    | "review"
    | "group_board"
    | "deep_link"
    | "unknown";
}

export type HostToWorkspaceMessage =
  | { type: "founderos.bootstrap"; payload: SessionWorkspaceHostContext }
  | { type: "founderos.account.switch"; payload: { accountId: string } }
  | {
      type: "founderos.session.retry";
      payload: { retryMode: "same_account" | "fallback_account" };
    }
  | {
      type: "founderos.session.focus";
      payload: { section: "chat" | "files" | "approvals" | "diff" };
    }
  | {
      type: "founderos.session.meta";
      payload: Partial<SessionWorkspaceHostContext>;
    };

export type WorkspaceRuntimeBridgeWorkspaceMessage =
  | { type: "workspace.ready" }
  | {
      type: "workspace.session.updated";
      payload: { title?: string; status?: string };
    }
  | {
      type: "workspace.tool.started";
      payload: { toolName: string; eventId: string };
    }
  | {
      type: "workspace.tool.completed";
      payload: { toolName: string; eventId: string; status: "completed" | "failed" };
    }
  | {
      type: "workspace.approval.requested";
      payload: { approvalId: string; summary: string };
    }
  | { type: "workspace.file.opened"; payload: { path: string } }
  | { type: "workspace.error"; payload: { code?: string; message: string } }
  | {
      type: "workspace.deepLink";
      payload: { sessionId: string; filePath?: string; anchor?: string };
    };

export interface WorkspaceRuntimeProducerBatchMessage {
  type: "workspace.producer.batch";
  payload: {
    producer: "workspace_runtime_bridge";
    messages: WorkspaceRuntimeBridgeWorkspaceMessage[];
  };
}

export type WorkspaceToHostMessage =
  | WorkspaceRuntimeBridgeWorkspaceMessage
  | WorkspaceRuntimeProducerBatchMessage;

export type WorkspaceRuntimeBridgeMessage =
  | WorkspaceRuntimeBridgeWorkspaceMessage
  | Extract<HostToWorkspaceMessage, { type: "founderos.account.switch" }>
  | Extract<HostToWorkspaceMessage, { type: "founderos.session.retry" }>;

export interface WorkspaceRuntimeBridgeSingleIngestRequest {
  hostContext: SessionWorkspaceHostContext;
  message: WorkspaceRuntimeBridgeMessage;
}

export interface WorkspaceRuntimeProducerBatch {
  hostContext: SessionWorkspaceHostContext;
  producer: "workspace_runtime_bridge";
  messages: readonly WorkspaceRuntimeBridgeMessage[];
}

export type WorkspaceRuntimeBridgeIngestRequest =
  | WorkspaceRuntimeBridgeSingleIngestRequest
  | WorkspaceRuntimeProducerBatch;

export interface WorkspaceLaunchSessionContext extends WorkspaceLaunchRefs {
  projectName: string;
  sessionTitle: string;
  externalSessionId?: string | null;
  accountLabel?: string | null;
  provider: ExecutionProvider;
  model?: string | null;
  executionMode?: "local" | "worktree" | "cloud" | "hermes" | "unknown";
  quotaState?: WorkspaceHostQuotaState;
  pendingApprovals?: number;
  openedFrom?:
    | "dashboard"
    | "execution_board"
    | "review"
    | "group_board"
    | "deep_link"
    | "unknown";
  status: ExecutionSessionStatus;
  phase?: ExecutionSessionPhase | null;
}

export interface WorkspaceLaunchViewModel extends WorkspaceLaunchSessionContext {
  shellPublicOrigin: string;
  workUiBaseUrl: string;
  workUiLaunchPath: string;
  workUiLaunchUrl: string;
  launchToken: string;
  launchTokenIssuedAt: string;
  launchTokenExpiresAt: string;
  launchTokenState: WorkspaceLaunchTokenState;
  launchTokenBoundaryNote: string;
  launchQueryItems: WorkspaceLaunchQueryItem[];
  shellSessionsHref: string;
  shellSessionHref: string;
}

export interface WorkspaceLaunchTokenVerificationRequest extends WorkspaceLaunchRefs {
  token?: string | null;
  openedFrom?:
    | "dashboard"
    | "execution_board"
    | "review"
    | "group_board"
    | "deep_link"
    | "unknown";
}

export interface WorkspaceLaunchTokenVerificationResponse {
  accepted: boolean;
  state: WorkspaceLaunchTokenVerificationState;
  canonicalTruth: "sessionId";
  sessionId: string;
  note: string;
  issuedAt: string | null;
  expiresAt: string | null;
}

export interface WorkspaceLaunchBootstrapRequest extends WorkspaceLaunchRefs {
  token?: string | null;
  openedFrom?:
    | "dashboard"
    | "execution_board"
    | "review"
    | "group_board"
    | "deep_link"
    | "unknown";
}

export interface WorkspaceLaunchBootstrapUser {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  profile_image_url: string;
  permissions: {
    chat?: {
      temporary?: boolean;
    };
  };
}

export interface WorkspaceLaunchBootstrapModel {
  id: string;
  name: string;
  owned_by: "openai";
  external: boolean;
  source?: string;
}

export interface WorkspaceLaunchBootstrapUiState {
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
  models: WorkspaceLaunchBootstrapModel[];
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
}

export interface WorkspaceLaunchBootstrapAuthState {
  mode: "bootstrap_only" | "session_exchange";
  note: string;
  sessionExchangePath: string;
  sessionBearerExchangePath?: string | null;
}

export interface WorkspaceLaunchBootstrapResponse {
  source: "mock" | "postgres" | "upstream" | "derived";
  storageKind: ControlPlaneStorageKind;
  integrationState: ControlPlaneIntegrationState;
  canonicalTruth: "sessionId";
  accepted: boolean;
  note: string;
  user: WorkspaceLaunchBootstrapUser;
  hostContext: SessionWorkspaceHostContext;
  auth: WorkspaceLaunchBootstrapAuthState;
  ui: WorkspaceLaunchBootstrapUiState;
  notes: string[];
}

export type WorkspaceLaunchSessionBearerRequest =
  WorkspaceLaunchTokenVerificationRequest;

export type WorkspaceLaunchSessionRequest =
  WorkspaceLaunchTokenVerificationRequest;

export interface WorkspaceIssuedSessionClaims extends WorkspaceLaunchRefs {
  v: 1;
  kind: "founderos_workspace_embedded_session";
  sessionTokenId: string;
  issuedAt: string;
  expiresAt: string;
}

export type WorkspaceSessionDeliveryMode =
  | "http_only_cookie"
  | "local_dev_session_storage";

export interface WorkspaceIssuedSession {
  token: string | null;
  sessionTokenId: string;
  issuedAt: string;
  expiresAt: string;
  refreshAfter: string;
  deliveryMode: WorkspaceSessionDeliveryMode;
  cookieName?: string | null;
}

export interface WorkspaceIssuedSessionGrantClaims extends WorkspaceLaunchRefs {
  v: 1;
  kind: "founderos_workspace_session_grant";
  grantId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface WorkspaceIssuedSessionGrant {
  token: string | null;
  grantId: string;
  issuedAt: string;
  expiresAt: string;
  refreshAfter: string;
  revokedAt?: string | null;
}

export interface WorkspaceLaunchSessionBearerResponse {
  source: "mock" | "postgres" | "upstream" | "derived";
  storageKind: ControlPlaneStorageKind;
  integrationState: ControlPlaneIntegrationState;
  canonicalTruth: "sessionId";
  accepted: boolean;
  note: string;
  sessionId: string;
  sessionBearerToken: string | null;
  sessionBearerTokenEnvKey: string | null;
  sessionDeliveryMode: WorkspaceSessionDeliveryMode;
  sessionGrant: WorkspaceIssuedSessionGrant;
}

export interface WorkspaceLaunchSessionResponse {
  source: "mock" | "postgres" | "upstream" | "derived";
  storageKind: ControlPlaneStorageKind;
  integrationState: ControlPlaneIntegrationState;
  canonicalTruth: "sessionId";
  accepted: boolean;
  note: string;
  sessionId: string;
  session: WorkspaceIssuedSession;
  sessionGrant: WorkspaceIssuedSessionGrant;
  user: WorkspaceLaunchBootstrapUser;
}

export interface WorkspaceLaunchRolloutStatus {
  source: "mock" | "postgres" | "upstream" | "derived";
  storageKind: ControlPlaneStorageKind;
  integrationState: ControlPlaneIntegrationState;
  canonicalTruth: "sessionId";
  strictEnv: boolean;
  ready: boolean;
  shellPublicOrigin: string | null;
  workUiBaseUrl: string | null;
  launchSecretConfigured: boolean;
  sessionAuthMode: "bootstrap_only" | "shell_issued";
  sessionSecretEnvKey: string | null;
  notes: string[];
}

export interface WorkspaceRuntimeSnapshot {
  session: ExecutionSessionSummary;
  hostContext: SessionWorkspaceHostContext;
  latestEvent: NormalizedExecutionEvent | null;
}

export interface WorkspaceRuntimeIngestResponse {
  source: "mock" | "postgres" | "upstream" | "derived";
  storageKind: ControlPlaneStorageKind;
  integrationState: ControlPlaneIntegrationState;
  canonicalTruth: "sessionId";
  accepted: boolean;
  persistedEvents: NormalizedExecutionEvent[];
  touchedApprovals: ApprovalRequest[];
  touchedRecoveries: RecoveryIncident[];
  runtimeSnapshot: WorkspaceRuntimeSnapshot;
}

function normalizeWorkspaceLaunchValue(value: string | null | undefined) {
  return (value || "").trim();
}

export function normalizeWorkspaceLaunchRefs(
  refs: Partial<WorkspaceLaunchRefs> | null | undefined
): WorkspaceLaunchRefs {
  return {
    projectId: normalizeWorkspaceLaunchValue(refs?.projectId),
    sessionId: normalizeWorkspaceLaunchValue(refs?.sessionId),
    groupId: normalizeWorkspaceLaunchValue(refs?.groupId),
    accountId: normalizeWorkspaceLaunchValue(refs?.accountId),
    workspaceId: normalizeWorkspaceLaunchValue(refs?.workspaceId),
  };
}

export function buildWorkspaceLaunchQueryItems(
  refs: WorkspaceLaunchRefs,
  options?: {
    openedFrom?:
      | "dashboard"
      | "execution_board"
      | "review"
      | "group_board"
      | "deep_link"
      | "unknown";
  }
): WorkspaceLaunchQueryItem[] {
  const items: WorkspaceLaunchQueryItem[] = [
    { label: "founderos_launch", value: "1" },
    { label: "project_id", value: refs.projectId },
    { label: "session_id", value: refs.sessionId },
  ];

  if (refs.groupId) {
    items.push({ label: "group_id", value: refs.groupId });
  }

  if (refs.accountId) {
    items.push({ label: "account_id", value: refs.accountId });
  }

  if (refs.workspaceId) {
    items.push({ label: "workspace_id", value: refs.workspaceId });
  }

  if (options?.openedFrom) {
    items.push({ label: "opened_from", value: options.openedFrom });
  }

  return items;
}

export function buildWorkUiLaunchUrl(
  baseUrl: string,
  refs: WorkspaceLaunchRefs,
  launchPath = "/",
  options?: {
    openedFrom?:
      | "dashboard"
      | "execution_board"
      | "review"
      | "group_board"
      | "deep_link"
      | "unknown";
    hostOrigin?: string | null;
    embedded?: boolean;
    launchToken?: string | null;
  }
) {
  const normalizedBaseUrl =
    normalizeWorkspaceLaunchValue(baseUrl) || DEFAULT_LOCAL_WORK_UI_BASE_URL;
  const absoluteBaseUrl = normalizedBaseUrl.includes("://")
    ? normalizedBaseUrl
    : `http://${normalizedBaseUrl}`;
  const normalizedLaunchPath = normalizeWorkspaceLaunchValue(launchPath) || "/";
  const targetUrl = new URL(normalizedLaunchPath, absoluteBaseUrl);

  targetUrl.searchParams.set("founderos_launch", "1");
  targetUrl.searchParams.set("project_id", refs.projectId);
  targetUrl.searchParams.set("session_id", refs.sessionId);

  if (refs.groupId) {
    targetUrl.searchParams.set("group_id", refs.groupId);
  }

  if (refs.accountId) {
    targetUrl.searchParams.set("account_id", refs.accountId);
  }

  if (refs.workspaceId) {
    targetUrl.searchParams.set("workspace_id", refs.workspaceId);
  }

  if (options?.openedFrom) {
    targetUrl.searchParams.set("opened_from", options.openedFrom);
  }

  if (options?.hostOrigin) {
    targetUrl.searchParams.set("host_origin", options.hostOrigin);
  }

  if (options?.embedded) {
    targetUrl.searchParams.set("embedded", "1");
  }

  if (options?.launchToken) {
    targetUrl.searchParams.set("launch_token", options.launchToken);
  }

  return targetUrl.toString();
}
