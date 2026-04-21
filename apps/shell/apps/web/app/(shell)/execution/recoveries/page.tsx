import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { ExecutionRecoveriesDirectorySurface } from "@/components/execution/control-plane-directory-surfaces";
import { buildRecoveryIncidentsDirectory } from "@/lib/server/control-plane/recoveries";
import { listControlPlaneAccounts } from "@/lib/server/control-plane/accounts";

type ExecutionRecoveriesSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionRecoveriesPage({
  searchParams,
}: {
  searchParams?: ExecutionRecoveriesSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const [directory, accounts] = await Promise.all([
    buildRecoveryIncidentsDirectory(),
    listControlPlaneAccounts(),
  ]);

  return (
    <ExecutionRecoveriesDirectorySurface
      directory={directory}
      routeScope={routeScope}
      fallbackAccountIds={accounts.map((account) => account.id)}
    />
  );
}
