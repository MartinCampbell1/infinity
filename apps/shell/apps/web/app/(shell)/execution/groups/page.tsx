import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { ExecutionSessionsSurface } from "@/components/execution/session-surface";

type ExecutionGroupsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionGroupsPage({
  searchParams,
}: {
  searchParams?: ExecutionGroupsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);

  return (
    <ExecutionSessionsSurface
      routeScope={routeScope}
      mode="groups"
      title="Groups"
      description="Grouped orchestration lane built from live session projections with scoped deep links into representative workspaces."
    />
  );
}
