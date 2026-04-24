import { describe, expect, test } from "vitest";

import type { DeliveryRecord } from "@/lib/server/control-plane/contracts/orchestration";
import {
  isDeliveryHandoffReady,
  resolveDeliveryReadinessCopy,
  resolveDeliveryReadinessTier,
  withResolvedDeliveryReadiness,
} from "./delivery-readiness";

const baseDelivery: DeliveryRecord = {
  id: "delivery-readiness-001",
  initiativeId: "initiative-readiness-001",
  verificationRunId: "verification-readiness-001",
  resultSummary: "Runnable result.",
  launchProofKind: "runnable_result",
  launchProofUrl: "http://127.0.0.1:4100/index.html",
  launchProofAt: "2026-04-24T00:00:00.000Z",
  status: "ready",
};

describe("delivery readiness copy", () => {
  test("downgrades runnable local proof to local_solo without production wording", () => {
    const copy = resolveDeliveryReadinessCopy(baseDelivery);

    expect(resolveDeliveryReadinessTier(baseDelivery)).toBe("local_solo");
    expect(copy.tier).toBe("local_solo");
    expect(copy.statusDetail).toBe("local runnable proof");
    expect(copy.resultHeadline).toBe("Local runnable proof");
    expect(copy.sidebarTitle).toBe("Local runnable proof");
    expect(copy.sidebarDescription).toContain("not production proof");
    expect(copy.statusDetail).not.toMatch(/handoff ready/i);
    expect(isDeliveryHandoffReady(baseDelivery)).toBe(true);
    expect(isDeliveryHandoffReady(baseDelivery, { strictRolloutEnv: true })).toBe(false);
  });

  test("uses staging copy when strict rollout is enabled without hosted proof", () => {
    const copy = resolveDeliveryReadinessCopy(baseDelivery, {
      strictRolloutEnv: true,
    });

    expect(copy.tier).toBe("staging");
    expect(copy.statusDetail).toBe("staging runnable proof");
    expect(copy.sidebarDescription).toContain("no hosted proof manifest");
    expect(copy.statusDetail).not.toMatch(/handoff ready/i);
  });

  test("allows production handoff-ready copy only with strict rollout and hosted proof", () => {
    const productionDelivery: DeliveryRecord = {
      ...baseDelivery,
      externalPullRequestUrl: "https://github.com/founderos/infinity/pull/123",
      externalPreviewUrl: "https://preview.infinity.example/delivery-readiness-001",
      externalProofManifestPath: "s3://infinity/proofs/delivery-readiness-001.json",
      ciProofUri: "github://checks/delivery-readiness-001",
      artifactStorageUri: "s3://infinity/artifacts/delivery-readiness-001",
      signedManifestUri: "s3://infinity/manifests/delivery-readiness-001.sig",
    };

    const copy = resolveDeliveryReadinessCopy(productionDelivery, {
      strictRolloutEnv: true,
    });

    expect(resolveDeliveryReadinessTier(productionDelivery, { strictRolloutEnv: true })).toBe(
      "production",
    );
    expect(isDeliveryHandoffReady(productionDelivery, { strictRolloutEnv: true })).toBe(true);
    expect(copy.tier).toBe("production");
    expect(copy.statusDetail).toBe("production handoff ready");
  });

  test("adds the resolved tier to shell response records", () => {
    expect(withResolvedDeliveryReadiness(baseDelivery)).toMatchObject({
      id: "delivery-readiness-001",
      readinessTier: "local_solo",
    });
  });
});
