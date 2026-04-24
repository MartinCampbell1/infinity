import { readSignedArtifactDownload } from "../../../../../../lib/server/orchestration/artifacts";

export async function GET(request: Request) {
  try {
    const artifact = await readSignedArtifactDownload(new URL(request.url).searchParams);
    return new Response(new Uint8Array(artifact.bytes), {
      status: 200,
      headers: {
        "content-type": artifact.contentType,
        "cache-control": "private, max-age=0, no-store",
        "x-artifact-sha256": artifact.sha256,
        "x-artifact-key": artifact.key,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: "artifact_unavailable",
        detail: error instanceof Error ? error.message : "Artifact could not be read.",
      },
      { status: 403 },
    );
  }
}
