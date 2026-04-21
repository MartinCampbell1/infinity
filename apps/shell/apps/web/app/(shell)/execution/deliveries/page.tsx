import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionDeliveryScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

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
  const items = [...state.orchestration.deliveries]
    .sort((left, right) => (right.deliveredAt ?? right.id).localeCompare(left.deliveredAt ?? left.id))
    .map((delivery) => ({
      id: delivery.id,
      headline: delivery.resultSummary,
      detail:
        delivery.launchProofUrl ??
        delivery.previewUrl ??
        delivery.localOutputPath ??
        "Delivery output unavailable",
      meta: [
        `status ${delivery.status}`,
        delivery.launchManifestPath ? "localhost manifest" : null,
        delivery.localOutputPath,
      ],
      href: buildExecutionDeliveryScopeHref(delivery.id, routeScope, {
        initiativeId: delivery.initiativeId,
      }),
    }));

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
