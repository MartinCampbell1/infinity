import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionTaskGraphScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type ExecutionPlannerSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExecutionPlannerPage({
  searchParams,
}: {
  searchParams?: ExecutionPlannerSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const items = [...state.orchestration.taskGraphs]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((taskGraph) => ({
      id: taskGraph.id,
      headline: `Task graph for ${taskGraph.initiativeId}`,
      detail: `${taskGraph.nodeIds.length} nodes · ${taskGraph.edges.length} dependency edges`,
      meta: [`status ${taskGraph.status}`, `brief ${taskGraph.briefId}`],
      href: buildExecutionTaskGraphScopeHref(taskGraph.id, routeScope, {
        initiativeId: taskGraph.initiativeId,
      }),
    }));

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Planner"
      description="Dependency-aware planner output, ready for batch materialization and execution."
      items={items}
      emptyTitle="No task graphs yet"
      emptyDescription="Planner artifacts appear automatically after the first spec reaches ready status."
    />
  );
}
