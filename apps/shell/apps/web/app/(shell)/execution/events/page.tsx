import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionContinuityScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type ExecutionEventsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionEventsPage({
  searchParams,
}: {
  searchParams?: ExecutionEventsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const items = [...state.orchestration.runEvents]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((event) => ({
      id: event.id,
      headline: event.summary,
      detail: `Kind ${event.kind}`,
      meta: [
        event.stage ? `stage ${event.stage}` : null,
        `initiative ${event.initiativeId}`,
        new Date(event.createdAt).toLocaleString(),
      ],
      href: buildExecutionContinuityScopeHref(event.initiativeId, routeScope),
    }));

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Events"
      description="Append-only autonomous run events emitted as the shell advances lifecycle stages."
      items={items}
      emptyTitle="No run events yet"
      emptyDescription="Run events appear as soon as the shell creates the first autonomous run."
    />
  );
}
