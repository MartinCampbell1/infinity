import type {
  WorkspaceLaunchRefs,
  WorkspaceLaunchSessionResponse,
} from "../contracts/workspace-launch";
import {
  getControlPlaneIntegrationState,
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
} from "../state/store";
import { buildWorkspaceBootstrapUser } from "./bootstrap";
import { mintWorkspaceSessionGrant } from "./session-grant";
import { mintWorkspaceSessionToken } from "./session-token";

export async function buildWorkspaceSessionResponse(
  refs: WorkspaceLaunchRefs
): Promise<WorkspaceLaunchSessionResponse> {
  return {
    source: getControlPlaneStorageSource(),
    storageKind: getControlPlaneStorageKind(),
    integrationState: getControlPlaneIntegrationState(),
    canonicalTruth: "sessionId",
    accepted: true,
    note:
      "Shell exchanged the verified launch token for a shell-issued embedded workspace session.",
    sessionId: refs.sessionId,
    session: mintWorkspaceSessionToken({ refs }),
    sessionGrant: mintWorkspaceSessionGrant({ refs }),
    user: buildWorkspaceBootstrapUser(),
  };
}
