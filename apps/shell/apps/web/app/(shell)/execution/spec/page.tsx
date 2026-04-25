import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import {
  buildExecutionScopeHref,
  buildExecutionContinuityScopeHref,
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type ExecutionSpecSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExecutionSpecPage({
  searchParams,
}: {
  searchParams?: ExecutionSpecSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const items = [...state.orchestration.specDocs]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((specDoc) => ({
      id: specDoc.id,
      headline: specDoc.summary,
      detail: `Artifact: ${specDoc.artifactPath}`,
      meta: [
        `status ${specDoc.status}`,
        `${specDoc.goals.length} goals`,
        `${specDoc.acceptanceCriteria.length} acceptance criteria`,
      ],
      href: buildExecutionContinuityScopeHref(specDoc.initiativeId, routeScope),
    }));

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Spec"
      description="Shell-authored spec documents and their machine-checkable artifacts."
      items={items}
      emptyTitle="No spec docs yet"
      emptyDescription="A spec doc appears automatically after the shell authors the first brief."
      emptyAction={{
        href: buildExecutionScopeHref(routeScope),
        label: "Open execution hub",
      }}
    />
  );
}
