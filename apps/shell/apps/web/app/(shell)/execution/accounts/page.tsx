import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { ExecutionAccountsDirectorySurface } from "@/components/execution/control-plane-directory-surfaces";
import { listControlPlaneAccounts } from "@/lib/server/control-plane/accounts";

type ExecutionAccountsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionAccountsPage({
  searchParams,
}: {
  searchParams?: ExecutionAccountsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const accounts = await listControlPlaneAccounts();

  return <ExecutionAccountsDirectorySurface accounts={accounts} routeScope={routeScope} />;
}
