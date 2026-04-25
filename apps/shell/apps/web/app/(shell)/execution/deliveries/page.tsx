import React from "react";

import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionDeliveryScopeHref,
  readShellRouteScopeFromQueryRecord,
  withShellRouteScope,
} from "@/lib/route-scope";
import { resolveDeliveryReadinessCopy } from "../../../../lib/delivery-readiness";
import { isStrictRolloutEnv } from "../../../../lib/server/control-plane/workspace/rollout-config";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";
import { listDeliveries } from "@/lib/server/orchestration/delivery";
import { redactLocalUiText } from "../../../../lib/ui-redaction";

type ExecutionDeliveriesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionDeliveriesPage({
  searchParams,
}: {
  searchParams?: ExecutionDeliveriesSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const deliveries = await listDeliveries();
  const initiativesById = new Map(
    state.orchestration.initiatives.map((initiative) => [initiative.id, initiative])
  );
  const strictRolloutEnv = isStrictRolloutEnv();
  const items = deliveries
    .map((delivery) => {
      const initiative = initiativesById.get(delivery.initiativeId);
      const prompt = initiative?.userRequest ?? delivery.resultSummary;
      const readiness = resolveDeliveryReadinessCopy(delivery, {
        strictRolloutEnv,
      });

      return {
        id: delivery.id,
        headline: redactLocalUiText(initiative?.title ?? delivery.resultSummary),
        detail:
          redactLocalUiText(`${prompt} · `) +
          redactLocalUiText(delivery.launchProofUrl ??
            delivery.previewUrl ??
            delivery.localOutputPath ??
            "Delivery output unavailable"),
        meta: [
          readiness.badgeLabel,
          readiness.statusDetail,
          readiness.missingProofItems.length
            ? `${readiness.missingProofItems.length} proof gates missing`
            : null,
          delivery.launchManifestPath ? "launch manifest" : null,
          delivery.localOutputPath ? redactLocalUiText(delivery.localOutputPath) : null,
        ],
        href: buildExecutionDeliveryScopeHref(delivery.id, routeScope, {
          initiativeId: delivery.initiativeId,
        }),
      };
    });

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Delivery"
      description="Final delivery records with artifact bundles, launch proof, and operator-facing handoff paths."
      items={items}
      emptyTitle="No deliveries yet"
      emptyDescription="Delivery records appear automatically after verification passes."
      emptyAction={{
        href: withShellRouteScope("/execution/validation", routeScope),
        label: "Open validation",
      }}
    />
  );
}
