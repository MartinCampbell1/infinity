import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionDeliveryScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";
import { listDeliveries } from "@/lib/server/orchestration/delivery";

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
  const items = deliveries
    .map((delivery) => {
      const initiative = initiativesById.get(delivery.initiativeId);
      const prompt = initiative?.userRequest ?? delivery.resultSummary;

      return {
        id: delivery.id,
        headline: initiative?.title ?? delivery.resultSummary,
        detail:
          `${prompt} · ` +
          (delivery.launchProofUrl ??
            delivery.previewUrl ??
            delivery.localOutputPath ??
            "Delivery output unavailable"),
        meta: [
          `status ${delivery.status}`,
          delivery.launchProofKind ? `proof ${delivery.launchProofKind}` : null,
          delivery.launchManifestPath ? "localhost manifest" : null,
          delivery.localOutputPath,
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
      description="Final delivery records with artifact bundles, localhost launch proof, and operator-facing handoff paths."
      items={items}
      emptyTitle="No deliveries yet"
      emptyDescription="Delivery records appear automatically after verification passes."
    />
  );
}
