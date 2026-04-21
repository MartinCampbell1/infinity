import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { readControlPlaneState } from "../../../../../../lib/server/control-plane/state/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ previewId: string }> }
) {
  const { previewId } = await context.params;
  const state = await readControlPlaneState();
  const preview =
    state.orchestration.previewTargets.find((candidate) => candidate.id === previewId) ?? null;

  if (!preview) {
    return NextResponse.json(
      {
        detail: `Preview ${previewId} is not present in the shell-owned orchestration directory.`,
      },
      { status: 404 }
    );
  }

  try {
    const html = await readFile(preview.sourcePath, "utf8");
    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail:
          error instanceof Error
            ? error.message
            : `Preview ${previewId} could not be read from disk.`,
      },
      { status: 500 }
    );
  }
}
