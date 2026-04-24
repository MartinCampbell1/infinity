import { describe, expect, test } from "vitest";

import {
  type SignedArtifactManifest,
  storeJsonArtifact,
  writeSignedArtifactManifest,
} from "./artifacts";
import { publishExternalDeliveryProof } from "./external-delivery";

const liveSmokeEnabled =
  process.env.FOUNDEROS_EXTERNAL_DELIVERY_LIVE_SMOKE === "1";
const describeLive = liveSmokeEnabled ? describe : describe.skip;

function requireEnv(key: string) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required for external delivery live smoke.`);
  }
  return value;
}

function requireMutationConfirmation() {
  if (process.env.FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS !== "1") {
    throw new Error(
      "External delivery live smoke creates or updates public GitHub branches/PRs and Vercel preview deployments; set FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1 to confirm.",
    );
  }
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
}

function expectObjectArtifactUri(value: string, storagePrefix: string) {
  expect(value).toMatch(new RegExp(`^${storagePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  expect(value).not.toContain("file://");
  expect(value).not.toContain("localhost");
  expect(value).not.toContain("127.0.0.1");
  expect(value).not.toContain("0.0.0.0");
  expect(value).not.toContain("/Users/");
}

function expectSignedArtifactUrl(value: string, signedUrlBase: string) {
  expect(value).toMatch(new RegExp(`^${signedUrlBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  expect(value).not.toContain("file://");
  expect(value).not.toContain("localhost");
  expect(value).not.toContain("127.0.0.1");
  expect(value).not.toContain("0.0.0.0");
  expect(value).not.toContain("/Users/");
}

function expectNoLocalArtifactLeak(value: string) {
  expect(value).not.toContain("file://");
  expect(value).not.toContain("localhost");
  expect(value).not.toContain("127.0.0.1");
  expect(value).not.toContain("0.0.0.0");
  expect(value).not.toContain("/Users/");
  const mirrorRoot = process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT?.trim();
  if (mirrorRoot) {
    expect(value).not.toContain(mirrorRoot);
  }
}

function vercelProtectionBypassHeaders() {
  const secret =
    process.env.FOUNDEROS_VERCEL_PROTECTION_BYPASS_SECRET?.trim() ||
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  return secret ? { "x-vercel-protection-bypass": secret } : undefined;
}

async function fetchSignedArtifactText(url: string, expectedSha256: string) {
  const response = await fetch(url, {
    headers: vercelProtectionBypassHeaders(),
    redirect: "follow",
  });
  const body = await response.text();
  expect(
    response.ok,
    `Expected signed artifact download to succeed, got ${response.status}: ${body.slice(0, 500)}`,
  ).toBe(true);
  expect(response.headers.get("x-artifact-sha256")).toBe(expectedSha256);
  expectNoLocalArtifactLeak(body);
  return body;
}

describeLive("external delivery live smoke", () => {
  test("publishes a real PR, hosted preview, CI proof, and signed object manifest", async () => {
    requireMutationConfirmation();
    const deliveryId = safeId(
      process.env.FOUNDEROS_EXTERNAL_DELIVERY_SMOKE_ID?.trim() ||
        `delivery-smoke-${Date.now()}`,
    );
    const initiativeId = `initiative-${deliveryId}`;
    const expectedPreviewText = requireEnv(
      "FOUNDEROS_EXTERNAL_PREVIEW_EXPECTED_TEXT",
    );
    const storagePrefix = requireEnv(
      "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX",
    ).replace(/\/+$/, "");
    const signedUrlBase = requireEnv(
      "FOUNDEROS_ARTIFACT_SIGNED_URL_BASE",
    ).replace(/\/+$/, "");
    const artifact = storeJsonArtifact({
      key: `live-smoke/${deliveryId}/runnable-result.json`,
      payload: {
        deliveryId,
        initiativeId,
        expectedPreviewText,
        generatedAt: new Date().toISOString(),
      },
    });
    const signedManifest = writeSignedArtifactManifest({
      key: `live-smoke/${deliveryId}/signed-artifact-manifest.json`,
      subject: {
        kind: "external-delivery-live-smoke",
        deliveryId,
        initiativeId,
      },
      artifacts: [artifact],
    });
    expectObjectArtifactUri(artifact.uri, storagePrefix);
    expectObjectArtifactUri(signedManifest.storageRootUri, storagePrefix);
    expectObjectArtifactUri(signedManifest.stored.uri, storagePrefix);
    expectSignedArtifactUrl(signedManifest.stored.signedUrl, signedUrlBase);

    const signedManifestBody = await fetchSignedArtifactText(
      signedManifest.stored.signedUrl,
      signedManifest.stored.sha256,
    );
    const downloadedManifest = JSON.parse(
      signedManifestBody,
    ) as SignedArtifactManifest;
    expect(downloadedManifest).toEqual(signedManifest.manifest);
    const downloadableArtifact = downloadedManifest.artifacts[0];
    if (!downloadableArtifact) {
      throw new Error("Signed artifact manifest did not include a downloadable artifact.");
    }
    expect(downloadableArtifact).toEqual(
      expect.objectContaining({
        key: artifact.key,
        sha256: artifact.sha256,
        uri: artifact.uri,
      }),
    );
    expectSignedArtifactUrl(downloadableArtifact.signedUrl, signedUrlBase);
    const artifactBody = await fetchSignedArtifactText(
      downloadableArtifact.signedUrl,
      artifact.sha256,
    );
    expect(artifactBody).toContain(deliveryId);
    expect(artifactBody).toContain(expectedPreviewText);

    const result = await publishExternalDeliveryProof({
      deliveryId,
      initiativeId,
      artifactStorageUri: signedManifest.storageRootUri,
      signedManifestUri: signedManifest.stored.signedUrl,
      deliveryManifestUri: artifact.uri,
      launchManifestUri: artifact.uri,
      hostedPreviewHtml: [
        "<!doctype html>",
        "<html>",
        "<body>",
        `<main>${expectedPreviewText}</main>`,
        "</body>",
        "</html>",
      ].join(""),
      assembly: {
        id: `assembly-${deliveryId}`,
        initiativeId,
        taskGraphId: `task-graph-${deliveryId}`,
        inputWorkUnitIds: [`work-unit-${deliveryId}`],
        artifactUris: [artifact.uri],
        outputLocation: signedManifest.storageRootUri,
        manifestPath: artifact.uri,
        summary: "Live external delivery smoke assembly.",
        status: "assembled",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      verification: {
        id: `verification-${deliveryId}`,
        initiativeId,
        assemblyId: `assembly-${deliveryId}`,
        checks: [],
        overallStatus: "passed",
      },
    });

    expect(result?.externalPullRequestUrl).toMatch(/^https:\/\/github\.com\//);
    expect(result?.externalPullRequestId).toBeTruthy();
    expect(result?.externalPreviewUrl).toMatch(/^https:\/\//);
    expect(result?.externalPreviewProvider).toBe("vercel");
    expect(result?.externalPreviewDeploymentId).toBeTruthy();
    expect(result?.ciProofUri).toMatch(/^https:\/\//);
    expect(result?.ciProofProvider).toBe("github_commit_status");
    expect(result?.externalProofManifestPath).toMatch(/external-delivery-proof\.json$/);
    expectObjectArtifactUri(result!.externalProofManifestPath, storagePrefix);
    expect(result?.externalDeliveryProof).toEqual(
      expect.objectContaining({
        manifestUri: result?.externalProofManifestPath,
      }),
    );

    const previewResponse = await fetch(result!.externalPreviewUrl, {
      headers: vercelProtectionBypassHeaders(),
      redirect: "follow",
    });
    expect(previewResponse.ok).toBe(true);
    const previewHtml = await previewResponse.text();
    expect(previewHtml).toContain(expectedPreviewText);
  });
});
