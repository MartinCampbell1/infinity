import React from "react";

import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionContinuityScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";
import { isStrictRolloutEnv } from "@/lib/server/control-plane/workspace/rollout-config";
import {
  isDeliveryPrimaryHandoffReady,
  resolveDeliveryReadinessCopy,
} from "../../../../lib/delivery-readiness";
import { listDeliveries } from "@/lib/server/orchestration/delivery";

type ExecutionValidationSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionValidationPage({
  searchParams,
}: {
  searchParams?: ExecutionValidationSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const strictRolloutEnv = isStrictRolloutEnv();
  const deliveries = await listDeliveries();
  const deliveryByVerificationId = new Map(
    deliveries.map((delivery) => [delivery.verificationRunId, delivery] as const)
  );
  const proofByRunId = new Map(
    state.orchestration.validationProofs.map((proof) => [proof.runId, proof] as const)
  );
  const runById = new Map(state.orchestration.runs.map((run) => [run.id, run] as const));
  const items = [...state.orchestration.verifications]
    .sort((left, right) =>
      (right.finishedAt ?? right.startedAt ?? right.id).localeCompare(
        left.finishedAt ?? left.startedAt ?? left.id
      )
    )
    .map((verification) => {
      const run = state.orchestration.runs.find(
        (candidate) => candidate.initiativeId === verification.initiativeId
      );
      const proof = run ? proofByRunId.get(run.id) : null;
      const delivery = deliveryByVerificationId.get(verification.id) ?? null;
      const deliveryHandoffReady = delivery
        ? isDeliveryPrimaryHandoffReady(delivery, { strictRolloutEnv })
        : false;
      const readiness = delivery
        ? resolveDeliveryReadinessCopy(delivery, { strictRolloutEnv })
        : null;
      return {
        id: verification.id,
        headline: `Verification ${verification.overallStatus}`,
        detail: proof?.eventTimelinePath ?? "Validation proof will be attached after handoff.",
        meta: [
          `checks ${verification.checks.length}`,
          proof?.previewReady
            ? `preview proof · ${readiness?.badgeLabel ?? "Missing proof"}`
            : null,
          proof?.launchReady && readiness && !deliveryHandoffReady
            ? `${readiness.badgeLabel} · ${readiness.missingProofItems.length} proof gates missing`
            : null,
          proof?.launchReady && deliveryHandoffReady
            ? `launch proof · ${readiness?.badgeLabel ?? "Missing proof"}`
            : null,
          proof?.handoffReady && deliveryHandoffReady
            ? `handoff packet ready · ${readiness?.badgeLabel ?? "Missing proof"}`
            : null,
        ],
        href: run
          ? buildExecutionContinuityScopeHref(
              runById.get(run.id)?.initiativeId ?? verification.initiativeId,
              routeScope
            )
          : null,
      };
    });

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Validation"
      description="Verification outputs plus final autonomous-proof records tied to the run event timeline."
      items={items}
      emptyTitle="No verification runs yet"
      emptyDescription="Validation records appear automatically after assembly is ready."
    />
  );
}
