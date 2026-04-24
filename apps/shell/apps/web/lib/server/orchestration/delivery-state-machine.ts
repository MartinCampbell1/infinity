import type {
  DeliveryLaunchProofKind,
  ReadinessTier,
} from "../control-plane/contracts/orchestration";

export type DeliveryPromotionState =
  | "attempt_scaffold"
  | "assembly_ready"
  | "verification_passed"
  | "runnable_result"
  | "external_proof_required"
  | "delivery.ready";

export type DeliveryPromotionInput = {
  assemblyReady: boolean;
  verificationPassed: boolean;
  launchProofKind?: DeliveryLaunchProofKind | null;
  launchProofUrl?: string | null;
  launchProofAt?: string | null;
  externalPullRequestUrl?: string | null;
  strictRolloutEnv?: boolean;
  externalPreviewUrl?: string | null;
  externalProofManifestPath?: string | null;
  ciProofUri?: string | null;
  artifactStorageUri?: string | null;
  signedManifestUri?: string | null;
};

function present(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function hasRunnableLaunchProof(input: DeliveryPromotionInput) {
  return (
    input.launchProofKind === "runnable_result" &&
    present(input.launchProofUrl) &&
    present(input.launchProofAt)
  );
}

export function hasExternalDeliveryProof(input: DeliveryPromotionInput) {
  return (
    present(input.externalPullRequestUrl) &&
    present(input.externalPreviewUrl) &&
    present(input.externalProofManifestPath) &&
    present(input.ciProofUri) &&
    present(input.artifactStorageUri) &&
    present(input.signedManifestUri)
  );
}

export function resolveDeliveryPromotionState(
  input: DeliveryPromotionInput
): DeliveryPromotionState {
  if (!input.assemblyReady) {
    return "attempt_scaffold";
  }

  if (!input.verificationPassed) {
    return "assembly_ready";
  }

  if (input.launchProofKind !== "runnable_result") {
    return "verification_passed";
  }

  if (!hasRunnableLaunchProof(input)) {
    return "runnable_result";
  }

  if (input.strictRolloutEnv && !hasExternalDeliveryProof(input)) {
    return "external_proof_required";
  }

  return "delivery.ready";
}

export function canPersistReadyDelivery(input: DeliveryPromotionInput) {
  return resolveDeliveryPromotionState(input) === "delivery.ready";
}

export function deliveryReadinessTierForPromotion(
  input: DeliveryPromotionInput
): ReadinessTier {
  if (!input.strictRolloutEnv) {
    return "local_solo";
  }
  return hasExternalDeliveryProof(input) ? "production" : "staging";
}
