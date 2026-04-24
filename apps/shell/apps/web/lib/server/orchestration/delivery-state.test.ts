import { describe, expect, test } from "vitest";

import {
  canPersistReadyDelivery,
  deliveryReadinessTierForPromotion,
  resolveDeliveryPromotionState,
} from "./delivery-state-machine";

describe("delivery promotion state machine", () => {
  test("requires assembly, verification, runnable result, and localhost proof before delivery.ready", () => {
    expect(
      resolveDeliveryPromotionState({
        assemblyReady: false,
        verificationPassed: false,
        launchProofKind: "attempt_scaffold",
        launchProofUrl: null,
        launchProofAt: null,
      }),
    ).toBe("attempt_scaffold");

    expect(
      resolveDeliveryPromotionState({
        assemblyReady: true,
        verificationPassed: false,
        launchProofKind: "attempt_scaffold",
        launchProofUrl: null,
        launchProofAt: null,
      }),
    ).toBe("assembly_ready");

    expect(
      resolveDeliveryPromotionState({
        assemblyReady: true,
        verificationPassed: true,
        launchProofKind: "synthetic_wrapper",
        launchProofUrl: "http://127.0.0.1:4010/preview.html",
        launchProofAt: "2026-04-24T12:00:00.000Z",
      }),
    ).toBe("verification_passed");

    expect(
      resolveDeliveryPromotionState({
        assemblyReady: true,
        verificationPassed: true,
        launchProofKind: "runnable_result",
        launchProofUrl: null,
        launchProofAt: null,
      }),
    ).toBe("runnable_result");

    const readyInput = {
      assemblyReady: true,
      verificationPassed: true,
      launchProofKind: "runnable_result" as const,
      launchProofUrl: "http://127.0.0.1:4010/index.html",
      launchProofAt: "2026-04-24T12:00:00.000Z",
    };
    expect(resolveDeliveryPromotionState(readyInput)).toBe("delivery.ready");
    expect(canPersistReadyDelivery(readyInput)).toBe(true);

    expect(
      canPersistReadyDelivery({
        ...readyInput,
        launchProofKind: "synthetic_wrapper",
      }),
    ).toBe(false);
  });

  test("strict rollout requires external preview, ci, artifact, and signed manifest proof before ready", () => {
    const strictRunnableInput = {
      assemblyReady: true,
      verificationPassed: true,
      launchProofKind: "runnable_result" as const,
      launchProofUrl: "http://127.0.0.1:4010/index.html",
      launchProofAt: "2026-04-24T12:00:00.000Z",
      strictRolloutEnv: true,
    };

    expect(resolveDeliveryPromotionState(strictRunnableInput)).toBe(
      "external_proof_required",
    );
    expect(canPersistReadyDelivery(strictRunnableInput)).toBe(false);
    expect(deliveryReadinessTierForPromotion(strictRunnableInput)).toBe("staging");

    const productionProofInput = {
      ...strictRunnableInput,
      externalPullRequestUrl: "https://github.com/founderos/infinity/pull/123",
      externalPreviewUrl: "https://preview.infinity.example/index.html",
      externalProofManifestPath: "s3://infinity/proofs/delivery-state.json",
      ciProofUri: "github://checks/delivery-state",
      artifactStorageUri: "s3://infinity/artifacts/delivery-state",
      signedManifestUri: "s3://infinity/manifests/delivery-state.sig",
    };

    expect(resolveDeliveryPromotionState(productionProofInput)).toBe(
      "delivery.ready",
    );
    expect(canPersistReadyDelivery(productionProofInput)).toBe(true);
    expect(deliveryReadinessTierForPromotion(productionProofInput)).toBe(
      "production",
    );
  });
});
