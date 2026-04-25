import {
  buildControlPlaneStorageUnavailableProblem,
  isControlPlaneStorageUnavailableError,
} from "../control-plane/state/store";
import { apiErrorResponse } from "./api-error-response";

export { apiErrorResponse } from "./api-error-response";

export function controlPlaneStorageUnavailableResponse(
  error: unknown,
  extras: Record<string, unknown> = {},
) {
  if (!isControlPlaneStorageUnavailableError(error)) {
    return null;
  }

  const problem = buildControlPlaneStorageUnavailableProblem(error);

  return apiErrorResponse(
    {
      code: problem.code,
      message: problem.detail,
      status: error.status,
      details: {
        ...extras,
        storagePolicy: problem.storagePolicy,
        storageKind: problem.storageKind,
        integrationState: problem.integrationState,
        degraded: problem.degraded,
        readOnly: problem.readOnly,
      },
    },
    undefined,
  );
}

export async function withControlPlaneStorageGuard(
  handler: () => Promise<Response>,
  extras: Record<string, unknown> = {},
) {
  try {
    return await handler();
  } catch (error) {
    const storageResponse = controlPlaneStorageUnavailableResponse(error, extras);
    if (storageResponse) {
      return storageResponse;
    }
    throw error;
  }
}
