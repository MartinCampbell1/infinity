"use client";

import type { ExecutionBatchDetailResponse } from "@/lib/server/control-plane/contracts/orchestration";

function toneForStatus(status: string) {
  if (status === "completed") {
    return "bg-emerald-500/12 text-emerald-100";
  }
  if (status === "blocked" || status === "failed" || status === "retryable") {
    return "bg-rose-500/12 text-rose-100";
  }
  if (status === "running" || status === "dispatching") {
    return "bg-amber-500/12 text-amber-100";
  }
  return "bg-white/[0.06] text-white/72";
}

export function SupervisorQueue({
  detail,
}: {
  detail: ExecutionBatchDetailResponse;
}) {
  const retryableUnits = detail.workUnits.filter(
    (workUnit) => workUnit.status === "retryable"
  );

  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="text-xs uppercase tracking-[0.16em] text-white/42">
        Supervisor queue
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-white/42">
            Batch
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">
            {detail.batch.status}
          </div>
        </div>
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-white/42">
            Attempts
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">
            {detail.attempts.length}
          </div>
        </div>
        <div className="rounded-2xl bg-white/[0.03] p-4">
          <div className="text-xs uppercase tracking-[0.14em] text-white/42">
            Retryable
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">
            {retryableUnits.length}
          </div>
        </div>
      </div>

      {retryableUnits.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-white/68">
          {retryableUnits.map((workUnit) => (
            <li
              key={workUnit.id}
              className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3"
            >
              {workUnit.title} is waiting for retry or reassignment.
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-white/58">
          No retryable work units are waiting in this batch.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {detail.supervisorActions.slice(0, 6).map((action) => (
          <span
            key={action.id}
            className={`rounded-full px-3 py-1 font-medium ${toneForStatus(
              action.toStatus ?? action.actionKind
            )}`}
          >
            {action.actionKind}
          </span>
        ))}
      </div>
    </section>
  );
}
