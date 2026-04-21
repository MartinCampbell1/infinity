import { ExecutionRunComposer } from "@/components/execution/execution-run-composer";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";

type ExecutionIntakeSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionIntakePage({
  searchParams,
}: {
  searchParams?: ExecutionIntakeSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5">
      <ExecutionRunComposer routeScope={routeScope} />
    </main>
  );
}
