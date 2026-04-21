import { ExecutionAuditDetailSurface } from "@/components/execution/operator-audit-surfaces";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { buildOperatorActionAuditDetailResponse } from "@/lib/server/control-plane/operator-audits";
import { notFound } from "next/navigation";

type ExecutionAuditSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function ExecutionAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ auditId: string }>;
  searchParams?: ExecutionAuditSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(resolvedSearchParams);
  const detail = await buildOperatorActionAuditDetailResponse(resolvedParams.auditId);

  if (!detail) {
    notFound();
  }

  return (
    <ExecutionAuditDetailSurface detail={detail} routeScope={routeScope} />
  );
}
