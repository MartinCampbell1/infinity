import { readSignedArtifactDownload } from "../../../../../../lib/server/orchestration/artifacts";
import { buildApiErrorBody } from "../../../../../../lib/server/http/api-error-response";

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
      buildApiErrorBody({
        code: "artifact_unavailable",
        message: error instanceof Error ? error.message : "Artifact could not be read.",
      }),
      { status: 403 },
    );
  }
}
