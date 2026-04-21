import React from "react";

import { BatchBoard } from "@/components/orchestration/batch-board";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { buildExecutionBatchDetailResponse } from "@/lib/server/orchestration/batches";

type BatchSearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

export default async function ExecutionBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams?: BatchSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(resolvedSearchParams);
  const detail = await buildExecutionBatchDetailResponse(resolvedParams.batchId);

  if (!detail) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
          <h1 className="text-3xl font-semibold text-white">Batch not found</h1>
          <p className="mt-3 text-sm leading-6 text-white/58">
            The requested batch is not present in the current shell-owned orchestration directory.
          </p>
        </div>
      </main>
    );
  }

  return <BatchBoard detail={detail} routeScope={routeScope} />;
}
