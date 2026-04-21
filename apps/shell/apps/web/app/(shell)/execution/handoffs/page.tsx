import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionDeliveryScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type ExecutionHandoffsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionHandoffsPage({
  searchParams,
}: {
  searchParams?: ExecutionHandoffsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const deliveryById = new Map(
    state.orchestration.deliveries.map((delivery) => [delivery.id, delivery] as const)
  );
  const items = [...state.orchestration.handoffPackets]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((handoff) => {
      const delivery = deliveryById.get(handoff.deliveryId);
      return {
        id: handoff.id,
        headline: `Handoff for ${delivery?.initiativeId ?? "unknown initiative"}`,
        detail: handoff.finalSummaryPath,
        meta: [`status ${handoff.status}`, handoff.manifestPath],
        href: delivery
          ? buildExecutionDeliveryScopeHref(delivery.id, routeScope, {
              initiativeId: delivery.initiativeId,
            })
          : null,
      };
    });

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Handoffs"
      description="Final handoff packets produced by successful autonomous runs."
      items={items}
      emptyTitle="No handoff packets yet"
      emptyDescription="A handoff packet appears automatically once delivery, preview, and final summary are ready."
    />
  );
}
