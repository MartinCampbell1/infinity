import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionContinuityScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type ExecutionAgentsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionAgentsPage({
  searchParams,
}: {
  searchParams?: ExecutionAgentsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const runById = new Map(state.orchestration.runs.map((run) => [run.id, run] as const));
  const items = [...state.orchestration.agentSessions]
    .sort((left, right) =>
      (right.startedAt ?? right.id).localeCompare(left.startedAt ?? left.id)
    )
    .map((agentSession) => {
      const run = runById.get(agentSession.runId);
      return {
        id: agentSession.id,
        headline: `${agentSession.agentKind} for ${agentSession.workItemId}`,
        detail: agentSession.runtimeRef
          ? `Runtime ref ${agentSession.runtimeRef}`
          : "Shell-tracked agent session",
        meta: [
          `status ${agentSession.status}`,
          `batch ${agentSession.batchId}`,
          agentSession.attemptId ? `attempt ${agentSession.attemptId}` : null,
        ],
        href: run
          ? buildExecutionContinuityScopeHref(run.initiativeId, routeScope)
          : null,
      };
    });

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Agents"
      description="Durable worker sessions emitted by the shell while autonomous batches execute."
      items={items}
      emptyTitle="No agent sessions yet"
      emptyDescription="Agent sessions appear after the shell dispatches the first execution batch."
    />
  );
}
