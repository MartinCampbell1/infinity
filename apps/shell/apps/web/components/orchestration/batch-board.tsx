"use client";

import { useMemo, useState } from "react";

import {
  buildExecutionBatchScopeHref,
  buildExecutionContinuityScopeHref,
  buildExecutionEventsScopeHref,
  buildExecutionTaskGraphScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import type { ExecutionBatchDetailResponse } from "@/lib/server/control-plane/contracts/orchestration";

import { SupervisorQueue } from "./supervisor-queue";

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function BatchBoard({
  detail,
  routeScope,
}: {
  detail: ExecutionBatchDetailResponse;
  routeScope?: Partial<ShellRouteScope> | null;
}) {
  const [currentDetail, setCurrentDetail] = useState(detail);
  const [actionState, setActionState] = useState<
    "idle" | "posting" | "refreshing"
  >("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const retryableUnits = useMemo(
    () =>
      currentDetail.workUnits.filter(
        (workUnit) => workUnit.status === "retryable" || workUnit.status === "blocked"
      ),
    [currentDetail.workUnits]
  );
  const batchExecutionComplete =
    currentDetail.batch.status === "completed" &&
    currentDetail.workUnits.length > 0 &&
    currentDetail.workUnits.every((workUnit) => workUnit.status === "completed");

  async function refreshDetail() {
    const response = await fetch(
      buildExecutionBatchScopeHref(currentDetail.batch.id, routeScope, {
        initiativeId: currentDetail.batch.initiativeId,
        taskGraphId: currentDetail.batch.taskGraphId,
      }).replace("/execution/", "/api/control/orchestration/").replace(
        `/batches/${encodeURIComponent(currentDetail.batch.id)}`,
        `/batches/${encodeURIComponent(currentDetail.batch.id)}`
      ),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    const payload = (await response.json().catch(() => null)) as
      | ExecutionBatchDetailResponse
      | { detail?: string }
      | null;
    if (!response.ok || !payload || !("batch" in payload)) {
      throw new Error(
        (payload && "detail" in payload && payload.detail) ||
          `Batch refresh failed: ${response.status}`
      );
    }
    setCurrentDetail(payload);
  }

  async function performAction(
    body:
      | {
          actionKind: "complete_attempt";
          batchId: string;
          attemptId: string;
          workUnitId: string;
        }
      | {
          actionKind: "fail_attempt";
          batchId: string;
          attemptId: string;
          workUnitId: string;
          errorSummary: string;
        }
      | {
          actionKind: "reassign_work_unit";
          batchId: string;
          workUnitId: string;
          executorType: "droid" | "codex" | "human";
        },
    successMessage: string
  ) {
    setActionState("posting");
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await fetch("/api/control/orchestration/supervisor/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | { detail?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.detail || `Supervisor action failed: ${response.status}`
        );
      }

      setActionState("refreshing");
      await refreshDetail();
      setActionMessage(successMessage);
      setActionState("idle");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Supervisor action failed before the shell could refresh the batch."
      );
      setActionState("idle");
  }
}

function executorProofSummary(payload: Record<string, unknown>) {
  const proof = payload.executorProof;
  if (typeof proof !== "object" || proof === null) {
    return null;
  }
  const record = proof as {
    executorKind?: unknown;
    summary?: unknown;
    exitCode?: unknown;
    artifactUris?: unknown;
    tests?: unknown;
  };
  if (typeof record.summary !== "string") {
    return null;
  }
  const artifactCount = Array.isArray(record.artifactUris)
    ? record.artifactUris.length
    : 0;
  const testCount = Array.isArray(record.tests) ? record.tests.length : 0;
  return {
    executorKind:
      typeof record.executorKind === "string" ? record.executorKind : "executor",
    summary: record.summary,
    exitCode: typeof record.exitCode === "number" ? record.exitCode : null,
    artifactCount,
    testCount,
  };
}

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-white/42">
          Execution
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">
            Batch Supervision
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-white/58">
            Follow the current batch lifecycle, attempt results, and operator
            interventions from the shell-owned supervisor surface.
          </p>
        </div>
      </header>

      <SupervisorQueue detail={currentDetail} />

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="flex flex-wrap gap-3 text-sm">
          <a
            className="rounded-full border border-white/12 px-4 py-2 text-white/78"
            href={buildExecutionTaskGraphScopeHref(detail.batch.taskGraphId, routeScope, {
              initiativeId: currentDetail.batch.initiativeId,
            })}
          >
            Task graph
          </a>
          <a
            className="rounded-full border border-white/12 px-4 py-2 text-white/78"
            href={buildExecutionEventsScopeHref(routeScope, {
              initiativeId: currentDetail.batch.initiativeId,
            })}
          >
            Events
          </a>
          <a
            className="rounded-full border border-white/12 px-4 py-2 text-white/78"
            href={buildExecutionContinuityScopeHref(currentDetail.batch.initiativeId, routeScope)}
          >
            Continuity
          </a>
          <button
            className="rounded-full border border-white/12 px-4 py-2 text-white/78 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => void refreshDetail()}
            disabled={actionState !== "idle"}
          >
            {actionState === "refreshing" ? "Refreshing" : "Refresh batch"}
          </button>
        </div>
      </section>

      {actionError ? (
        <section className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
          {actionError}
        </section>
      ) : null}

      {actionMessage ? (
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
          {actionMessage}
        </section>
      ) : null}

      {batchExecutionComplete ? (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-200">
          <div className="font-medium">Execution is complete. Assembly is the next step.</div>
          <div className="mt-1">
            The batch has finished and all work units are completed. Continue in
            the project run/result surfaces to create assembly and move into verification.
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-white/42">
          Attempts
        </div>
        <div className="mt-4 space-y-3">
          {currentDetail.attempts.map((attempt) => (
            <article
              key={attempt.id}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {attempt.id}
                  </div>
                  <div className="mt-1 text-sm text-white/58">
                    work unit: {attempt.workUnitId}
                  </div>
                  {attempt.attemptNumber ? (
                    <div className="mt-1 text-xs text-white/42">
                      attempt {attempt.attemptNumber}
                      {attempt.parentAttemptId ? ` · parent ${attempt.parentAttemptId}` : ""}
                    </div>
                  ) : null}
                </div>
                <div className="text-sm text-white/58">
                  {attempt.status} · started {formatTimestamp(attempt.startedAt)}
                </div>
              </div>

              {["leased", "running", "started"].includes(attempt.status) ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-full bg-sky-500/90 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    onClick={() =>
                      void performAction(
                        {
                          actionKind: "complete_attempt",
                          batchId: currentDetail.batch.id,
                          attemptId: attempt.id,
                          workUnitId: attempt.workUnitId,
                        },
                        `Attempt ${attempt.id} completed.`
                      )
                    }
                    disabled={actionState !== "idle"}
                  >
                    Complete
                  </button>
                  <button
                    className="rounded-full border border-rose-500/20 bg-white/[0.03] px-3 py-1.5 text-sm font-medium text-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    onClick={() =>
                      void performAction(
                        {
                          actionKind: "fail_attempt",
                          batchId: currentDetail.batch.id,
                          attemptId: attempt.id,
                          workUnitId: attempt.workUnitId,
                          errorSummary: "Marked failed from shell supervision.",
                        },
                        `Attempt ${attempt.id} marked failed.`
                      )
                    }
                    disabled={actionState !== "idle"}
                  >
                    Fail
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-white/42">
          Work units
        </div>
        <div className="mt-4 space-y-3">
          {currentDetail.workUnits.map((workUnit) => {
            const reassignable =
              workUnit.status === "retryable" || workUnit.status === "blocked";
            return (
              <article
                key={workUnit.id}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {workUnit.title}
                    </div>
                    <div className="mt-1 text-sm text-white/58">
                      {workUnit.executorType} · {workUnit.status}
                    </div>
                  </div>
                </div>

                {reassignable ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["droid", "codex", "human"] as const).map((executorType) => {
                      const sameExecutor = executorType === workUnit.executorType;
                      return (
                      <button
                        key={executorType}
                        className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-sm font-medium text-white/78 disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        onClick={() =>
                          void performAction(
                            {
                              actionKind: "reassign_work_unit",
                              batchId: currentDetail.batch.id,
                              workUnitId: workUnit.id,
                              executorType,
                            },
                            sameExecutor
                              ? `Work unit ${workUnit.id} retried with ${executorType}.`
                              : `Work unit ${workUnit.id} reassigned to ${executorType}.`
                          )
                        }
                        disabled={actionState !== "idle"}
                      >
                        {sameExecutor ? `Retry ${executorType}` : `Reassign to ${executorType}`}
                      </button>
                    );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
        {retryableUnits.length === 0 ? (
          <p className="mt-4 text-sm text-white/58">
            No retryable work units are waiting for reassignment in this batch.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-white/42">
          Supervisor audit
        </div>
        <ul className="mt-4 space-y-3 text-sm text-white/68">
          {currentDetail.supervisorActions.map((action) => (
            <li
              key={action.id}
              className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
            >
              <div className="font-medium text-white">{action.actionKind}</div>
              <div className="mt-1">{action.summary}</div>
              {(() => {
                const proof = executorProofSummary(action.payload);
                return proof ? (
                  <div className="mt-3 rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                    <div className="font-medium">
                      {proof.executorKind} proof · exit {proof.exitCode ?? "n/a"}
                    </div>
                    <div className="mt-1 text-emerald-100/75">{proof.summary}</div>
                    <div className="mt-1 text-emerald-100/55">
                      {proof.testCount} test record(s) · {proof.artifactCount} artifact(s)
                    </div>
                  </div>
                ) : null;
              })()}
              <div className="mt-1 text-xs text-white/42">
                {formatTimestamp(action.occurredAt)}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
