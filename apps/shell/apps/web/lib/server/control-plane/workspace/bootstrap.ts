import { buildWorkspaceLaunchSessionPath } from "@founderos/api-clients/workspace-launch-routes";

import type {
  SessionWorkspaceHostContext,
  WorkspaceLaunchBootstrapResponse,
  WorkspaceLaunchBootstrapAuthState,
  WorkspaceLaunchBootstrapUiState,
  WorkspaceLaunchBootstrapUser,
  WorkspaceLaunchRefs,
} from "../contracts/workspace-launch";
import {
  buildControlPlaneStateNotes,
  getControlPlaneIntegrationState,
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
} from "../state/store";
import { buildSessionWorkspaceHostContext } from "./launch";
import { buildWorkspaceLaunchSessionContext } from "./session-context";
export function buildWorkspaceBootstrapUser(): WorkspaceLaunchBootstrapUser {
  return {
    id: "founderos-embedded-user",
    email: "operator@infinity.local",
    name: "Infinity Operator",
    role: "user",
    profile_image_url: "/user.png",
    permissions: {
      chat: {
        temporary: false,
      },
    },
  };
}

function buildBootstrapUiState(
  hostContext: SessionWorkspaceHostContext
): WorkspaceLaunchBootstrapUiState {
  const modelId = hostContext.model?.trim() || "gpt-5.4";

  return {
    showSidebar: false,
    showControls: false,
    selectedTerminalId: null,
    temporaryChatEnabled: false,
    settings: {
      showChangelog: false,
      showUpdateToast: false,
      models: [modelId],
      toolServers: [],
      terminalServers: [],
    },
    models: [
      {
        id: modelId,
        name: modelId,
        owned_by: "openai",
        external: false,
        source: "founderos_shell",
      },
    ],
    toolServers: [],
    terminalServers: [],
    banners: [],
    tools: null,
  };
}

function buildBootstrapAuthState(
  sessionId: string
): WorkspaceLaunchBootstrapAuthState {
  const exchangePath = buildWorkspaceLaunchSessionPath(sessionId);

  if (!exchangePath) {
    throw new Error("Workspace bootstrap requires a session id to build auth routes.");
  }

  return {
    mode: "session_exchange",
    note:
      "Shell keeps launch bootstrap stateless; exchange the verified launch token for a shell-issued embedded session via the dedicated session route.",
    sessionExchangePath: exchangePath,
  };
}

export async function buildWorkspaceLaunchBootstrap(params: {
  refs: WorkspaceLaunchRefs;
  openedFrom:
    | "dashboard"
    | "execution_board"
    | "review"
    | "group_board"
    | "deep_link"
    | "unknown";
}): Promise<WorkspaceLaunchBootstrapResponse> {
  const session = await buildWorkspaceLaunchSessionContext(
    params.refs.sessionId,
    params.refs,
    params.openedFrom
  );
  const hostContext = buildSessionWorkspaceHostContext(session);
  return {
    source: getControlPlaneStorageSource(),
    storageKind: getControlPlaneStorageKind(),
    integrationState: getControlPlaneIntegrationState(),
    canonicalTruth: "sessionId",
    accepted: true,
    note:
      "Shell issued an embedded workspace bootstrap after launch-token verification. This payload hydrates the workspace without switching canonical truth away from sessionId.",
    user: buildWorkspaceBootstrapUser(),
    hostContext,
    auth: buildBootstrapAuthState(session.sessionId),
    ui: buildBootstrapUiState(hostContext),
    notes: buildControlPlaneStateNotes([
      "Embedded workspace bootstrap stays shell-authored and launch-scoped; it replaces the previous local demo bootstrap path.",
    ]),
  };
}
