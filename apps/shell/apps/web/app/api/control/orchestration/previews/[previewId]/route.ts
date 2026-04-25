import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { readControlPlaneState } from "../../../../../../lib/server/control-plane/state/store";
import {
  apiErrorResponse,
  withControlPlaneStorageGuard,
} from "../../../../../../lib/server/http/control-plane-storage-response";
import { artifactLocalPath } from "../../../../../../lib/server/orchestration/artifacts";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ previewId: string }> }
) {
  const { previewId } = await context.params;
  return withControlPlaneStorageGuard(async () => {
    const state = await readControlPlaneState();
    const preview =
      state.orchestration.previewTargets.find((candidate) => candidate.id === previewId) ?? null;

    if (!preview) {
      return apiErrorResponse({
        code: "preview_not_found",
        message: `Preview ${previewId} is not present in the shell-owned orchestration directory.`,
        status: 404,
      });
    }

    try {
      const sourcePath = artifactLocalPath(preview.sourcePath) ?? preview.sourcePath;
      const html = await readFile(sourcePath, "utf8");
      return new NextResponse(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      return apiErrorResponse({
        code: "preview_read_failed",
        message:
          error instanceof Error
            ? error.message
            : `Preview ${previewId} could not be read from disk.`,
        status: 500,
      });
    }
  });
}
