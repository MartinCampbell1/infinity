import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionContinuityScopeHref,
  buildExecutionRecoveriesScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type ExecutionRefusalsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionRefusalsPage({
  searchParams,
}: {
  searchParams?: ExecutionRefusalsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const runById = new Map(state.orchestration.runs.map((run) => [run.id, run] as const));
  const items = [...state.orchestration.refusals]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((refusal) => {
      const run = runById.get(refusal.runId);
      return {
        id: refusal.id,
        headline: refusal.reason,
        detail: refusal.workItemId
          ? `Work item ${refusal.workItemId}`
          : "Run-level refusal without a work-item binding.",
        meta: [
          `severity ${refusal.severity}`,
          refusal.agentSessionId ? `agent ${refusal.agentSessionId}` : null,
        ],
        href: run ? buildExecutionContinuityScopeHref(run.initiativeId, routeScope) : null,
      };
    });

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Refusals"
      description="First-class refusal records emitted when autonomous worker attempts fail or decline execution."
      items={items}
      emptyTitle="No refusals yet"
      emptyDescription="Refusals appear automatically when a worker attempt fails and recovery needs to take over."
      emptyAction={{
        href: buildExecutionRecoveriesScopeHref(routeScope),
        label: "Open recoveries",
      }}
    />
  );
}
