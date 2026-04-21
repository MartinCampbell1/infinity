import type {
  WorkspaceLaunchRefs,
  WorkspaceLaunchSessionBearerResponse,
} from "../contracts/workspace-launch";
import { buildWorkspaceSessionResponse } from "./session";

export async function buildWorkspaceSessionBearerResponse(
  params: WorkspaceLaunchRefs
): Promise<WorkspaceLaunchSessionBearerResponse> {
  const session = await buildWorkspaceSessionResponse(params);

  return {
    source: session.source,
    storageKind: session.storageKind,
    integrationState: session.integrationState,
    canonicalTruth: session.canonicalTruth,
    accepted: session.accepted,
    note:
      "Compatibility session-bearer route now returns a shell-issued embedded session token. Use the canonical /session route instead.",
    sessionId: params.sessionId,
    sessionBearerToken: session.session.token,
    sessionBearerTokenEnvKey: null,
    sessionGrant: session.sessionGrant,
  };
}
