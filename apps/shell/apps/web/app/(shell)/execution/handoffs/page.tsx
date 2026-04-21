import { ExecutionHandoffsWorkspace } from "@/components/execution/execution-handoffs-workspace";
import { buildExecutionHandoffsSnapshot } from "@/lib/execution-handoffs";
import {
  readShellRouteScopeFromQueryRecord,
} from "@/lib/route-scope";

type ExecutionHandoffsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionHandoffsPage({
  searchParams,
}: {
  searchParams?: ExecutionHandoffsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const initialSnapshot = await buildExecutionHandoffsSnapshot();

  return (
    <ExecutionHandoffsWorkspace
      initialSnapshot={initialSnapshot}
      routeScope={routeScope}
    />
  );
}
