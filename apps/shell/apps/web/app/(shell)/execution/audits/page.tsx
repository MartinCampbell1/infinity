import { ExecutionAuditsDirectorySurface } from "@/components/execution/operator-audit-surfaces";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { buildOperatorActionAuditDirectory } from "@/lib/server/control-plane/operator-audits";

type ExecutionAuditsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionAuditsPage({
  searchParams,
}: {
  searchParams?: ExecutionAuditsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const directory = await buildOperatorActionAuditDirectory();

  return (
    <ExecutionAuditsDirectorySurface directory={directory} routeScope={routeScope} />
  );
}
