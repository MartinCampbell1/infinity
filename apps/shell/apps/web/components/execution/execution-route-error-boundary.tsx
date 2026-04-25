"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";

export function ExecutionRouteErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message =
    error.message?.trim() || "The execution route raised an error before it could render.";
  const digest = typeof error.digest === "string" && error.digest.trim()
    ? error.digest.trim()
    : null;

  return (
    <main
      data-execution-error-boundary="true"
      className="mx-auto flex max-w-[1280px] flex-col gap-5"
    >
      <header className="space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
          Execution recovery
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-white">
              Execution surface failed
            </h1>
            <p className="max-w-3xl text-[13px] leading-6 text-white/58">
              The shell kept the operator frame alive. Retry this surface, then use recoveries or
              event logs if the route fails again.
            </p>
          </div>
          <button
            type="button"
            data-execution-error-reset="true"
            onClick={reset}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--shell-control-border)] bg-[rgba(255,255,255,0.03)] px-4 text-[12px] font-medium text-white/82 transition hover:bg-[color:var(--shell-control-hover)]"
          >
            <RotateCcw className="h-4 w-4" />
            Retry surface
          </button>
        </div>
      </header>

      <section className="rounded-[20px] border border-red-400/20 bg-red-500/[0.055] px-5 py-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-300/20 bg-red-400/10 text-red-200">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="text-[15px] font-semibold text-white">Route render error</div>
            <p className="max-w-4xl text-[13px] leading-6 text-white/62">{message}</p>
            {digest ? (
              <div className="font-mono text-[11px] text-white/42">digest {digest}</div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-5 py-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
            Recovery
          </div>
          <div className="mt-2 text-[15px] font-medium text-white">Open the recovery lane</div>
          <p className="mt-2 text-[12px] leading-6 text-white/56">
            Use the durable recovery board to inspect retryable incidents, fallback actions, and
            operator interventions tied to this execution surface.
          </p>
          <Link
            href="/execution/recoveries"
            className="mt-4 inline-flex h-8 items-center rounded-full border border-[color:var(--shell-control-border)] bg-[rgba(255,255,255,0.03)] px-3.5 text-[12px] font-medium text-white/82 transition hover:bg-[color:var(--shell-control-hover)]"
          >
            Open recoveries
          </Link>
        </div>

        <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-5 py-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
            Logs
          </div>
          <div className="mt-2 text-[15px] font-medium text-white">Open event logs</div>
          <p className="mt-2 text-[12px] leading-6 text-white/56">
            Review the append-only event feed for recent runtime, delivery, validation, or
            workspace bridge errors before retrying the same route.
          </p>
          <Link
            href="/execution/events"
            className="mt-4 inline-flex h-8 items-center rounded-full border border-[color:var(--shell-control-border)] bg-[rgba(255,255,255,0.03)] px-3.5 text-[12px] font-medium text-white/82 transition hover:bg-[color:var(--shell-control-hover)]"
          >
            Open event logs
          </Link>
        </div>
      </section>
    </main>
  );
}
