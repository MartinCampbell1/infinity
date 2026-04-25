"use client";

import { ExecutionRouteErrorBoundary } from "@/components/execution/execution-route-error-boundary";

export default function ExecutionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ExecutionRouteErrorBoundary error={error} reset={reset} />;
}
