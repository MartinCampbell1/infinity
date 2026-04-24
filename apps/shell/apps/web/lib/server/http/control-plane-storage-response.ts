import { NextResponse } from "next/server";

import {
  buildControlPlaneStorageUnavailableProblem,
  isControlPlaneStorageUnavailableError,
} from "../control-plane/state/store";

export function controlPlaneStorageUnavailableResponse(
  error: unknown,
  extras: Record<string, unknown> = {},
) {
  if (!isControlPlaneStorageUnavailableError(error)) {
    return null;
  }

  return NextResponse.json(
    {
      ...buildControlPlaneStorageUnavailableProblem(error),
      ...extras,
    },
    { status: error.status },
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
