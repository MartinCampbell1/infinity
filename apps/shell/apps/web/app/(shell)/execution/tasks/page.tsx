import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionTaskGraphScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type ExecutionTasksSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExecutionTasksPage({
  searchParams,
}: {
  searchParams?: ExecutionTasksSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const taskGraphById = new Map(
    state.orchestration.taskGraphs.map((taskGraph) => [taskGraph.id, taskGraph] as const)
  );
  const items = [...state.orchestration.workUnits]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((workUnit) => {
      const taskGraph = taskGraphById.get(workUnit.taskGraphId);
      return {
        id: workUnit.id,
        headline: workUnit.title,
        detail: workUnit.description,
        meta: [
          `status ${workUnit.status}`,
          `executor ${workUnit.executorType}`,
          `${workUnit.acceptanceCriteria.length} acceptance criteria`,
        ],
        href: taskGraph
          ? buildExecutionTaskGraphScopeHref(taskGraph.id, routeScope, {
              initiativeId: taskGraph.initiativeId,
            })
          : null,
      };
    });

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Tasks"
      description="Work-item ownership, executor choice, and acceptance semantics for the active autonomous graphs."
      items={items}
      emptyTitle="No tasks yet"
      emptyDescription="Tasks appear automatically after the planner materializes a graph."
    />
  );
}
