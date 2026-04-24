import type {
  WorkspaceLaunchRefs,
  WorkspaceLaunchSessionBearerResponse,
} from "../contracts/workspace-launch";
import { buildWorkspaceSessionExchange } from "./session";

export async function buildWorkspaceSessionBearerResponse(
  params: WorkspaceLaunchRefs
): Promise<WorkspaceLaunchSessionBearerResponse> {
  const session = await buildWorkspaceSessionExchange(params);
  const responseBody = session.responseBody;

  return {
    source: responseBody.source,
    storageKind: responseBody.storageKind,
    integrationState: responseBody.integrationState,
    canonicalTruth: responseBody.canonicalTruth,
    accepted: responseBody.accepted,
    note:
      responseBody.session.deliveryMode === "http_only_cookie"
        ? "Compatibility session-bearer route is disabled for production-like deployments. Use the canonical cookie-bound /session route instead."
        : "Compatibility session-bearer route now returns a shell-issued embedded session token for local development. Use the canonical /session route instead.",
    sessionId: params.sessionId,
    sessionBearerToken:
      responseBody.session.deliveryMode === "local_dev_session_storage"
        ? session.rawSessionToken
        : null,
    sessionBearerTokenEnvKey: null,
    sessionDeliveryMode: responseBody.session.deliveryMode,
    sessionGrant: responseBody.sessionGrant,
  };
}
