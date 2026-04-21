import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionRunScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type ExecutionRunsSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExecutionRunsPage({
  searchParams,
}: {
  searchParams?: ExecutionRunsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const items = [...state.orchestration.runs]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((run) => ({
      id: run.id,
      headline: run.title,
      detail: run.originalPrompt,
      meta: [
        `stage ${run.currentStage}`,
        `health ${run.health}`,
        `preview ${run.previewStatus}`,
        `handoff ${run.handoffStatus}`,
      ],
      href: buildExecutionRunScopeHref(run.initiativeId, routeScope),
    }));

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Runs"
      description="Canonical autonomous runs with their current stage, health, preview status, and handoff readiness."
      items={items}
      emptyTitle="No runs yet"
      emptyDescription="Start from the shell composer to create the first autonomous run."
    />
  );
}
