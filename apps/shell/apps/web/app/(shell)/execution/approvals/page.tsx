import { ExecutionApprovalsDirectorySurface } from "@/components/execution/control-plane-directory-surfaces";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { buildApprovalRequestsDirectory } from "@/lib/server/control-plane/approvals";

type ExecutionApprovalsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionApprovalsPage({
  searchParams,
}: {
  searchParams?: ExecutionApprovalsSearchParams;
}) {
  const params = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(params);
  const directory = await buildApprovalRequestsDirectory();

  return (
    <ExecutionApprovalsDirectorySurface
      directory={directory}
      routeScope={routeScope}
    />
  );
}
