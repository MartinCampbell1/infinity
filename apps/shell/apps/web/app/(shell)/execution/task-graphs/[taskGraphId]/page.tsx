import React from "react";

import { TaskGraphBoard } from "@/components/orchestration/task-graph-board";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { buildTaskGraphDetailResponse } from "@/lib/server/orchestration/task-graphs";

type TaskGraphSearchParams = Promise<Record<string, string | string[] | undefined>>;

export const dynamic = "force-dynamic";

export default async function ExecutionTaskGraphPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskGraphId: string }>;
  searchParams?: TaskGraphSearchParams;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const routeScope = readShellRouteScopeFromQueryRecord(resolvedSearchParams);
  const detail = await buildTaskGraphDetailResponse(resolvedParams.taskGraphId);

  if (!detail) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-6">
          <h1 className="text-3xl font-semibold text-white">Task graph not found</h1>
          <p className="mt-3 text-sm leading-6 text-white/58">
            The requested planning graph is not present in the current shell-owned orchestration directory.
          </p>
        </div>
      </main>
    );
  }

  return <TaskGraphBoard detail={detail} routeScope={routeScope} />;
}
