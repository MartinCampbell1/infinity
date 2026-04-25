import { ExecutionAgentsWorkspace } from "@/components/execution/execution-agents-workspace";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";

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

  return <ExecutionAgentsWorkspace routeScope={routeScope} />;
}
