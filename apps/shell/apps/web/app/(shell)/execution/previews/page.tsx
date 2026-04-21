import { AutonomousRecordBoard } from "@/components/execution/autonomous-record-board";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";

type ExecutionPreviewsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionPreviewsPage({
  searchParams,
}: {
  searchParams?: ExecutionPreviewsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  readShellRouteScopeFromQueryRecord(params);
  const state = await readControlPlaneState();
  const items = [...state.orchestration.previewTargets]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((preview) => ({
      id: preview.id,
      headline: preview.url,
      detail: preview.sourcePath,
      meta: [
        `status ${preview.healthStatus}`,
        preview.launchCommand ?? null,
      ],
      href: preview.url,
    }));

  return (
    <AutonomousRecordBoard
      eyebrow="Execution"
      title="Previews"
      description="Local preview targets served through the shell-owned preview route."
      items={items}
      emptyTitle="No previews yet"
      emptyDescription="Preview targets appear automatically after delivery is ready."
    />
  );
}
