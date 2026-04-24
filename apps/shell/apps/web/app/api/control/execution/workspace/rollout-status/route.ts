import { NextResponse } from "next/server";

import { buildWorkspaceLaunchRolloutStatus } from "../../../../../../lib/server/control-plane/workspace/deployment";
import {
  buildControlPlaneStorageUnavailableProblem,
  isControlPlaneStorageUnavailableError,
} from "../../../../../../lib/server/control-plane/state/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await buildWorkspaceLaunchRolloutStatus();
    return NextResponse.json(status);
  } catch (error) {
    if (isControlPlaneStorageUnavailableError(error)) {
      const problem = buildControlPlaneStorageUnavailableProblem(error);
      return NextResponse.json(
        {
          source: "derived",
          storageKind: problem.storageKind,
          integrationState: problem.integrationState,
          canonicalTruth: "sessionId",
          strictEnv: true,
          ready: false,
          shellPublicOrigin: null,
          workUiBaseUrl: null,
          launchSecretConfigured: false,
          sessionAuthMode: "bootstrap_only",
          sessionSecretEnvKey: null,
          storagePolicy: problem.storagePolicy,
          degraded: problem.degraded,
          readOnly: problem.readOnly,
          notes: [problem.detail],
        },
        { status: error.status },
      );
    }

    throw error;
  }
}
