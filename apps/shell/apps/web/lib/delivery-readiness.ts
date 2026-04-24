import type {
  DeliveryRecord,
  ReadinessTier,
} from "@/lib/server/control-plane/contracts/orchestration";

export type DeliveryReadinessCopy = {
  tier: ReadinessTier;
  tierLabel: string;
  statusDetail: string;
  resultHeadline: string;
  sidebarTitle: string;
  sidebarDescription: string;
  actionLabel: string;
  launchReady: boolean;
};

export function hasHostedProofManifest(delivery: DeliveryRecord) {
  return Boolean(
    delivery.externalPullRequestUrl?.trim() &&
      delivery.externalPreviewUrl?.trim() &&
      delivery.externalProofManifestPath?.trim() &&
      delivery.ciProofUri?.trim() &&
      delivery.artifactStorageUri?.trim() &&
      delivery.signedManifestUri?.trim()
  );
}

export function resolveDeliveryReadinessTier(
  delivery: DeliveryRecord,
  options: { strictRolloutEnv?: boolean } = {},
): ReadinessTier {
  if (options.strictRolloutEnv && hasHostedProofManifest(delivery)) {
    return "production";
  }

  if (options.strictRolloutEnv) {
    return "staging";
  }

  return "local_solo";
}

export function withResolvedDeliveryReadiness(
  delivery: DeliveryRecord,
  options: { strictRolloutEnv?: boolean } = {},
): DeliveryRecord {
  return {
    ...delivery,
    readinessTier: resolveDeliveryReadinessTier(delivery, options),
  };
}

function titleCase(value: string | null | undefined) {
  if (!value) {
    return "unknown";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function isPersistedReady(delivery: DeliveryRecord) {
  return delivery.status === "ready" || delivery.status === "delivered";
}

function isRunnableProofReady(delivery: DeliveryRecord) {
  return (
    delivery.launchProofKind === "runnable_result" &&
    Boolean(delivery.launchProofUrl?.trim()) &&
    Boolean(delivery.launchProofAt?.trim())
  );
}

export function isDeliveryHandoffReady(
  delivery: DeliveryRecord,
  options: { strictRolloutEnv?: boolean } = {},
) {
  if (!isPersistedReady(delivery) || !isRunnableProofReady(delivery)) {
    return false;
  }

  if (options.strictRolloutEnv && !hasHostedProofManifest(delivery)) {
    return false;
  }

  return true;
}

export function resolveDeliveryReadinessCopy(
  delivery: DeliveryRecord,
  options: { strictRolloutEnv?: boolean } = {},
): DeliveryReadinessCopy {
  const launchReady = isRunnableProofReady(delivery);
  const tier = resolveDeliveryReadinessTier(delivery, options);
  const tierLabel = titleCase(tier);

  if (!launchReady) {
    if (delivery.launchProofKind === "attempt_scaffold") {
      return {
        tier,
        tierLabel,
        statusDetail: "scaffold evidence",
        resultHeadline: "Attempt scaffold evidence",
        sidebarTitle: "Scaffold evidence",
        sidebarDescription:
          "A scaffold preview is live, but the requested product still lacks real runnable-result proof.",
        actionLabel: "Open scaffold",
        launchReady,
      };
    }

    if (delivery.launchProofKind === "synthetic_wrapper") {
      return {
        tier,
        tierLabel,
        statusDetail: "wrapper evidence",
        resultHeadline: "Wrapper evidence",
        sidebarTitle: "Wrapper evidence",
        sidebarDescription:
          "The shell has wrapper evidence and a preview route, but runnable-result proof is still pending.",
        actionLabel: "Open wrapper",
        launchReady,
      };
    }

    return {
      tier,
      tierLabel,
      statusDetail: titleCase(delivery.status),
      resultHeadline: "Delivery evidence pending",
      sidebarTitle: "Delivery evidence pending",
      sidebarDescription:
        "The delivery record exists, but runnable-result proof is still pending.",
      actionLabel: "Open preview",
      launchReady,
    };
  }

  if (tier === "production") {
    return {
      tier,
      tierLabel,
      statusDetail: "production handoff ready",
      resultHeadline: "Production handoff-ready result",
      sidebarTitle: "Production handoff ready",
      sidebarDescription:
        "Pull request, hosted preview, CI proof, external proof manifest, and the handoff lane are all production-tier evidence.",
      actionLabel: "Open preview",
      launchReady,
    };
  }

  if (tier === "staging") {
    return {
      tier,
      tierLabel,
      statusDetail: "staging runnable proof",
      resultHeadline: "Staging runnable proof",
      sidebarTitle: "Staging runnable proof",
      sidebarDescription:
        "Preview is live under strict rollout configuration, but no hosted proof manifest is attached yet.",
      actionLabel: "Open preview",
      launchReady,
    };
  }

  return {
    tier,
    tierLabel,
    statusDetail: "local runnable proof",
    resultHeadline: "Local runnable proof",
    sidebarTitle: "Local runnable proof",
    sidebarDescription:
      "Preview is live and the local handoff packet can route the result. This is not production proof.",
    actionLabel: "Open preview",
    launchReady,
  };
}
