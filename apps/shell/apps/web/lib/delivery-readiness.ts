import type {
  DeliveryRecord,
  ReadinessTier,
} from "@/lib/server/control-plane/contracts/orchestration";

export type DeliveryReadinessCopy = {
  tier: ReadinessTier;
  tierLabel: string;
  badgeTier: "missing" | ReadinessTier;
  badgeLabel: string;
  statusDetail: string;
  resultHeadline: string;
  sidebarTitle: string;
  sidebarDescription: string;
  actionLabel: string;
  launchReady: boolean;
  primaryHandoffReady: boolean;
  missingProofItems: DeliveryProofChecklistItem[];
};

export type DeliveryProofChecklistItem = {
  key:
    | "runnable_proof"
    | "pull_request"
    | "hosted_preview"
    | "external_manifest"
    | "ci_proof"
    | "artifact_storage"
    | "signed_manifest";
  label: string;
  detail: string;
  satisfied: boolean;
};

function hasValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function hasHostedProofManifest(delivery: DeliveryRecord) {
  return Boolean(
    hasValue(delivery.externalPullRequestUrl) &&
      hasValue(delivery.externalPreviewUrl) &&
      hasValue(delivery.externalProofManifestPath) &&
      hasValue(delivery.ciProofUri) &&
      hasValue(delivery.artifactStorageUri) &&
      hasValue(delivery.signedManifestUri)
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
    hasValue(delivery.launchProofUrl) &&
    hasValue(delivery.launchProofAt)
  );
}

export function resolveDeliveryProofChecklist(
  delivery: DeliveryRecord,
): DeliveryProofChecklistItem[] {
  return [
    {
      key: "runnable_proof",
      label: "Runnable proof",
      detail: delivery.launchProofUrl ?? "launch proof URL missing",
      satisfied: isRunnableProofReady(delivery),
    },
    {
      key: "pull_request",
      label: "Pull request",
      detail: delivery.externalPullRequestUrl ?? "external pull request missing",
      satisfied: hasValue(delivery.externalPullRequestUrl),
    },
    {
      key: "hosted_preview",
      label: "Hosted preview",
      detail: delivery.externalPreviewUrl ?? "hosted preview missing",
      satisfied: hasValue(delivery.externalPreviewUrl),
    },
    {
      key: "external_manifest",
      label: "External manifest",
      detail: delivery.externalProofManifestPath ?? "external proof manifest missing",
      satisfied: hasValue(delivery.externalProofManifestPath),
    },
    {
      key: "ci_proof",
      label: "CI proof",
      detail: delivery.ciProofUri ?? "CI proof missing",
      satisfied: hasValue(delivery.ciProofUri),
    },
    {
      key: "artifact_storage",
      label: "Artifact storage",
      detail: delivery.artifactStorageUri ?? "artifact storage URI missing",
      satisfied: hasValue(delivery.artifactStorageUri),
    },
    {
      key: "signed_manifest",
      label: "Signed manifest",
      detail: delivery.signedManifestUri ?? "signed manifest missing",
      satisfied: hasValue(delivery.signedManifestUri),
    },
  ];
}

function proofBadgeFor(delivery: DeliveryRecord, tier: ReadinessTier) {
  if (!isRunnableProofReady(delivery)) {
    return {
      badgeTier: "missing" as const,
      badgeLabel: "Missing proof",
    };
  }

  if (tier === "production") {
    return {
      badgeTier: "production" as const,
      badgeLabel: "Production proof",
    };
  }

  if (tier === "staging") {
    return {
      badgeTier: "staging" as const,
      badgeLabel: "Staging proof",
    };
  }

  return {
    badgeTier: "local_solo" as const,
    badgeLabel: "Local proof",
  };
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

export function isDeliveryPrimaryHandoffReady(
  delivery: DeliveryRecord,
  options: { strictRolloutEnv?: boolean } = {},
) {
  return (
    isPersistedReady(delivery) &&
    isRunnableProofReady(delivery) &&
    resolveDeliveryReadinessTier(delivery, options) === "production"
  );
}

export function resolveDeliveryReadinessCopy(
  delivery: DeliveryRecord,
  options: { strictRolloutEnv?: boolean } = {},
): DeliveryReadinessCopy {
  const launchReady = isRunnableProofReady(delivery);
  const tier = resolveDeliveryReadinessTier(delivery, options);
  const tierLabel = titleCase(tier);
  const badge = proofBadgeFor(delivery, tier);
  const missingProofItems = resolveDeliveryProofChecklist(delivery).filter(
    (item) => !item.satisfied,
  );
  const primaryHandoffReady = isDeliveryPrimaryHandoffReady(delivery, options);

  if (!launchReady) {
    if (delivery.launchProofKind === "attempt_scaffold") {
      return {
        tier,
        tierLabel,
        ...badge,
        statusDetail: "scaffold evidence",
        resultHeadline: "Attempt scaffold evidence",
        sidebarTitle: "Scaffold evidence",
        sidebarDescription:
          "A scaffold preview is live, but the requested product still lacks real runnable-result proof.",
        actionLabel: "Open scaffold",
        launchReady,
        primaryHandoffReady,
        missingProofItems,
      };
    }

    if (delivery.launchProofKind === "synthetic_wrapper") {
      return {
        tier,
        tierLabel,
        ...badge,
        statusDetail: "wrapper evidence",
        resultHeadline: "Wrapper evidence",
        sidebarTitle: "Wrapper evidence",
        sidebarDescription:
          "The shell has wrapper evidence and a preview route, but runnable-result proof is still pending.",
        actionLabel: "Open wrapper",
        launchReady,
        primaryHandoffReady,
        missingProofItems,
      };
    }

    return {
      tier,
      tierLabel,
      ...badge,
      statusDetail: titleCase(delivery.status),
      resultHeadline: "Delivery evidence pending",
      sidebarTitle: "Delivery evidence pending",
      sidebarDescription:
        "The delivery record exists, but runnable-result proof is still pending.",
      actionLabel: "Open preview",
      launchReady,
      primaryHandoffReady,
      missingProofItems,
    };
  }

  if (tier === "production") {
    return {
      tier,
      tierLabel,
      ...badge,
      statusDetail: "production handoff ready",
      resultHeadline: "Production handoff-ready result",
      sidebarTitle: "Production handoff ready",
      sidebarDescription:
        "Pull request, hosted preview, CI proof, external proof manifest, and the handoff lane are all production-tier evidence.",
      actionLabel: "Open hosted preview",
      launchReady,
      primaryHandoffReady,
      missingProofItems,
    };
  }

  if (tier === "staging") {
    return {
      tier,
      tierLabel,
      ...badge,
      statusDetail: "staging runnable proof",
      resultHeadline: "Staging runnable proof",
      sidebarTitle: "Staging runnable proof",
      sidebarDescription:
        "Preview is live under strict rollout configuration, but no hosted proof manifest is attached yet.",
      actionLabel: delivery.externalPreviewUrl ? "Open hosted preview" : "Review local preview",
      launchReady,
      primaryHandoffReady,
      missingProofItems,
    };
  }

  return {
    tier,
    tierLabel,
    ...badge,
    statusDetail: "local runnable proof",
    resultHeadline: "Local runnable proof",
    sidebarTitle: "Local runnable proof",
    sidebarDescription:
      "Preview is live and the local handoff packet can route the result. This is not production proof.",
    actionLabel: "Open local preview",
    launchReady,
    primaryHandoffReady,
    missingProofItems,
  };
}
