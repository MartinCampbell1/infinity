import type {
  OrchestrationRetryResult,
  RecoveryIncident,
} from "../control-plane/contracts/recoveries";
import { appendOperatorSessionEvent } from "../control-plane/events/operator-events";
import { readControlPlaneState, updateControlPlaneState } from "../control-plane/state/store";

import { createDelivery } from "./delivery";
import { createVerification } from "./verification";
import { nowIso } from "./shared";

function retryInitiativeId(incident: RecoveryIncident) {
  const rawInitiativeId = incident.raw?.initiativeId;
  return typeof rawInitiativeId === "string" && rawInitiativeId.trim()
    ? rawInitiativeId
    : incident.projectId;
}

function canRetryOrchestrationIncident(incident: RecoveryIncident) {
  return incident.raw?.source === "orchestration.verification";
}

async function closeRecoveryAfterSuccessfulRetry(params: {
  incident: RecoveryIncident;
  verificationId: string;
  deliveryId: string;
}) {
  const occurredAt = nowIso();
  await updateControlPlaneState((draft) => {
    const index = draft.recoveries.incidents.findIndex(
      (incident) => incident.id === params.incident.id
    );
    const current = index >= 0 ? draft.recoveries.incidents[index] ?? null : null;
    if (!current) {
      return;
    }

    const resolvedIncident: RecoveryIncident = {
      ...current,
      status: "recovered",
      recoveryActionKind: "resolve",
      lastObservedAt: occurredAt,
      updatedAt: occurredAt,
      resolvedAt: occurredAt,
      revision: current.revision + 1,
      raw: {
        ...(current.raw ?? {}),
        retryResolution: {
          source: "orchestration.retry",
          verificationId: params.verificationId,
          deliveryId: params.deliveryId,
          resolvedAt: occurredAt,
        },
      },
    };

    draft.recoveries.incidents[index] = resolvedIncident;
    appendOperatorSessionEvent(draft, {
      sessionId: resolvedIncident.sessionId,
      projectId: resolvedIncident.projectId,
      groupId: resolvedIncident.groupId ?? null,
      source: "manual",
      provider: "unknown",
      kind: "recovery.completed",
      status: "completed",
      phase: "completed",
      summary: `Recovery ${resolvedIncident.id} completed after retry delivered ${params.deliveryId}.`,
      payload: {
        recoveryId: resolvedIncident.id,
        verificationId: params.verificationId,
        deliveryId: params.deliveryId,
        recoveryActionKind: "retry",
        recoveryStatus: resolvedIncident.status,
      },
    });
  });
}

export async function retryOrchestrationRecovery(
  incident: RecoveryIncident
): Promise<OrchestrationRetryResult | null> {
  if (!canRetryOrchestrationIncident(incident)) {
    return null;
  }

  const initiativeId = retryInitiativeId(incident);
  const verificationResponse = await createVerification({ initiativeId });
  const verification = verificationResponse?.verification ?? null;
  const deliveryResponse =
    verification?.overallStatus === "passed"
      ? await createDelivery({ initiativeId })
      : null;
  const delivery = deliveryResponse?.delivery ?? null;
  if (verification?.overallStatus === "passed" && delivery?.status === "ready") {
    await closeRecoveryAfterSuccessfulRetry({
      incident,
      verificationId: verification.id,
      deliveryId: delivery.id,
    });
  }
  const state = await readControlPlaneState();
  const newRecoveryIncident =
    verification?.overallStatus === "failed"
      ? state.recoveries.incidents.find(
          (candidate) =>
            candidate.raw?.source === "orchestration.verification" &&
            candidate.raw?.verificationId === verification.id
        ) ?? null
      : null;

  return {
    initiativeId,
    recoveryId: incident.id,
    verificationId: verification?.id ?? null,
    verificationStatus: verification?.overallStatus ?? null,
    deliveryId: delivery?.id ?? null,
    deliveryStatus: delivery?.status ?? null,
    launchProofKind: delivery?.launchProofKind ?? null,
    newRecoveryIncidentId: newRecoveryIncident?.id ?? null,
  };
}
