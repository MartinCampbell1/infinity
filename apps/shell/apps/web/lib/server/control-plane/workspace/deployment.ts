import type { WorkspaceLaunchRolloutStatus } from "../contracts/workspace-launch";
import {
  buildControlPlaneStateNotes,
  getControlPlaneIntegrationState,
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
  readControlPlaneState,
} from "../state/store";
import {
  isStrictRolloutEnv,
  resolveShellPublicOriginForLaunch,
  resolveWorkUiBaseUrlForLaunch,
  resolveWorkspaceLaunchSecret,
  resolveWorkspaceSessionTokenSecret,
  resolveWorkspaceSessionTokenSecretEnvKey,
} from "./rollout-config";

export async function buildWorkspaceLaunchRolloutStatus(): Promise<WorkspaceLaunchRolloutStatus> {
  await readControlPlaneState();
  const strictEnv = isStrictRolloutEnv();
  let shellPublicOrigin: string | null = null;
  let workUiBaseUrl: string | null = null;
  let launchSecretConfigured = false;
  let sessionSecretReady = false;
  let sessionSecretEnvKey: string | null = null;
  const resolverNotes: string[] = [];

  try {
    shellPublicOrigin = resolveShellPublicOriginForLaunch();
  } catch (error) {
    resolverNotes.push(error instanceof Error ? error.message : String(error));
  }

  try {
    workUiBaseUrl = resolveWorkUiBaseUrlForLaunch();
  } catch (error) {
    resolverNotes.push(error instanceof Error ? error.message : String(error));
  }

  try {
    launchSecretConfigured =
      strictEnv ? resolveWorkspaceLaunchSecret() !== null : true;
  } catch (error) {
    resolverNotes.push(error instanceof Error ? error.message : String(error));
  }

  try {
    sessionSecretReady = strictEnv
      ? resolveWorkspaceSessionTokenSecret() !== null
      : true;
    sessionSecretEnvKey = resolveWorkspaceSessionTokenSecretEnvKey();
  } catch (error) {
    resolverNotes.push(error instanceof Error ? error.message : String(error));
  }

  return {
    source: getControlPlaneStorageSource(),
    storageKind: getControlPlaneStorageKind(),
    integrationState: getControlPlaneIntegrationState(),
    canonicalTruth: "sessionId",
    strictEnv,
    ready:
      Boolean(shellPublicOrigin) &&
      Boolean(workUiBaseUrl) &&
      launchSecretConfigured &&
      sessionSecretReady,
    shellPublicOrigin,
    workUiBaseUrl,
    launchSecretConfigured,
    sessionAuthMode: sessionSecretReady ? "shell_issued" : "bootstrap_only",
    sessionSecretEnvKey,
    notes: buildControlPlaneStateNotes([
      strictEnv
        ? "Strict rollout env gate is active; shell launch readiness is evaluated against explicit deployment envs."
        : "Strict rollout env gate is inactive; localhost defaults remain allowed for local cut-in.",
      sessionSecretReady
        ? strictEnv
          ? "Shell-issued embedded session tokens are now the canonical production auth seam for workspace bring-up."
          : "Shell-issued embedded session tokens are active for local bring-up, using explicit rollout secrets when present and derived local secrets otherwise."
        : "Embedded workspace session issuance is unavailable until launch/session secrets are configured.",
      ...resolverNotes,
    ]),
  };
}
