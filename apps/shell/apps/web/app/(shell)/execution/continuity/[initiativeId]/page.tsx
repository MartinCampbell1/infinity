import React from "react";

import { ExecutionDetailEmptyState } from "../../../../../components/execution/detail-primitives";
import { ContinuityWorkspace } from "@/components/orchestration/continuity-workspace";
import { buildInitiativeContinuityResponse } from "@/lib/server/orchestration/continuity";

export default async function ExecutionContinuityPage({
  params,
}: {
  params: Promise<{ initiativeId: string }>;
}) {
  const resolvedParams = await params;
  const continuity = await buildInitiativeContinuityResponse(resolvedParams.initiativeId);

  if (!continuity) {
    return (
      <ExecutionDetailEmptyState
        title="Continuity record not found"
        description="The requested initiative continuity record is not present in the current shell-owned orchestration directory."
      />
    );
  }

  return <ContinuityWorkspace continuity={continuity} />;
}
