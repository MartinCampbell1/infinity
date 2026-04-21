import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { ExecutionSessionsSurface } from "@/components/execution/session-surface";

type ExecutionSessionsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionSessionsPage({
  searchParams,
}: {
  searchParams?: ExecutionSessionsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);

  return await ExecutionSessionsSurface({ routeScope, mode: "sessions" });
}
