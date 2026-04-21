import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";
import { buildClaudeDesignRunsBoardItems } from "@/lib/server/orchestration/claude-design-presentation";

type ExecutionRunsSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExecutionRunsPage({
  searchParams,
}: {
  searchParams?: ExecutionRunsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const items = buildClaudeDesignRunsBoardItems(state, routeScope);

  return (
    <AutonomousRecordBoard
      eyebrow="Execution · Runs"
      title="Run control plane"
      description="Canonical autonomous runs with durable lifecycle, preview readiness, and handoff state. Recoveries surface as they become pending."
      items={items}
      emptyTitle="No runs yet"
      emptyDescription="Start from the shell composer to create the first autonomous run."
    />
  );
}
