import {
  buildWorkUiLaunchUrl,
  buildWorkspaceLaunchQueryItems,
  normalizeWorkspaceLaunchRefs,
  type SessionWorkspaceHostContext,
  type WorkspaceHostQuotaState,
  type WorkspaceLaunchSessionContext,
  type WorkspaceLaunchViewModel,
} from "../contracts/workspace-launch";
import { mintWorkspaceLaunchToken } from "./launch-token";
import {
  resolveShellPublicOriginForLaunch,
  resolveWorkUiBaseUrlForLaunch,
} from "./rollout-config";

function resolveWorkUiBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return resolveWorkUiBaseUrlForLaunch(env);
}

function resolveShellPublicOrigin(env: NodeJS.ProcessEnv = process.env) {
  return resolveShellPublicOriginForLaunch(env);
}

export function buildWorkspaceLaunchViewModel(
  context: WorkspaceLaunchSessionContext,
  options?: {
    workUiLaunchPath?: string;
    workUiBaseUrl?: string;
    shellSessionsHref: string;
    shellSessionHref: string;
  }
): WorkspaceLaunchViewModel {
  const refs = normalizeWorkspaceLaunchRefs(context);
  const workUiBaseUrl = options?.workUiBaseUrl || resolveWorkUiBaseUrl();
  const shellPublicOrigin = resolveShellPublicOrigin();
  const workUiLaunchPath = options?.workUiLaunchPath ?? "/";
  const openedFrom = context.openedFrom || "unknown";
  const launchToken = mintWorkspaceLaunchToken({
    refs,
    openedFrom,
  });

  return {
    ...context,
    ...refs,
    shellPublicOrigin,
    workUiBaseUrl,
    workUiLaunchPath,
    workUiLaunchUrl: buildWorkUiLaunchUrl(workUiBaseUrl, refs, workUiLaunchPath, {
      openedFrom,
      hostOrigin: shellPublicOrigin,
      launchToken: launchToken.token,
    }),
    launchToken: launchToken.token,
    launchTokenIssuedAt: launchToken.claims.issuedAt,
    launchTokenExpiresAt: launchToken.claims.expiresAt,
    launchTokenState: "signed",
    launchTokenBoundaryNote:
      "Shell issues a short-lived signed launch token for launch integrity only. It is not an auth token and does not replace sessionId as canonical truth.",
    launchQueryItems: buildWorkspaceLaunchQueryItems(refs, {
      openedFrom,
    }),
    shellSessionsHref: options?.shellSessionsHref ?? "/execution/sessions",
    shellSessionHref: options?.shellSessionHref ?? "/execution/workspace",
  };
}

function normalizeQuotaState(
  quotaState: WorkspaceHostQuotaState | undefined
): WorkspaceHostQuotaState | undefined {
  if (!quotaState) {
    return undefined;
  }

  return {
    pressure: quotaState.pressure || "unknown",
    usedPercent:
      typeof quotaState.usedPercent === "number" ? quotaState.usedPercent : null,
    resetsAt: quotaState.resetsAt || null,
  };
}

export function buildSessionWorkspaceHostContext(
  context: WorkspaceLaunchSessionContext
): SessionWorkspaceHostContext {
  const refs = normalizeWorkspaceLaunchRefs(context);

  return {
    projectId: refs.projectId,
    projectName: context.projectName || refs.projectId || "Unknown project",
    sessionId: refs.sessionId,
    externalSessionId: context.externalSessionId || null,
    groupId: refs.groupId || null,
    workspaceId: refs.workspaceId || null,
    accountId: refs.accountId || null,
    accountLabel: context.accountLabel || null,
    model: context.model || null,
    executionMode: context.executionMode || "unknown",
    quotaState: normalizeQuotaState(context.quotaState),
    pendingApprovals:
      typeof context.pendingApprovals === "number"
        ? context.pendingApprovals
        : undefined,
    openedFrom: context.openedFrom || "unknown",
  };
}

export function buildWorkUiEmbeddedUrl(
  viewModel: WorkspaceLaunchViewModel,
  options?: { hostOrigin?: string | null }
) {
  return buildWorkUiLaunchUrl(
    viewModel.workUiBaseUrl,
    {
      projectId: viewModel.projectId,
      sessionId: viewModel.sessionId,
      groupId: viewModel.groupId,
      accountId: viewModel.accountId,
      workspaceId: viewModel.workspaceId,
    },
    viewModel.workUiLaunchPath,
    {
      openedFrom: viewModel.openedFrom || "unknown",
      hostOrigin: options?.hostOrigin || null,
      embedded: true,
      launchToken: viewModel.launchToken,
    }
  );
}

export { resolveWorkUiBaseUrl };
