import React from "react";
import Link from "next/link";

import {
  buildExecutionContinuityScopeHref,
  buildExecutionHandoffScopeHref,
  buildExecutionTaskGraphScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { getClaudeDisplayRunId } from "@/lib/server/orchestration/claude-design-presentation";
import {
  PlaneButton,
  PlaneStatusPill,
} from "@/components/execution/plane-run-primitives";
import type {
  AssemblyRecord,
  DeliveryRecord,
  VerificationRunRecord,
  WorkUnitRecord,
} from "@/lib/server/control-plane/contracts/orchestration";
import { isDeliveryHandoffReady, resolveDeliveryReadinessCopy } from "../../lib/delivery-readiness";
import { isStrictRolloutEnv } from "../../lib/server/control-plane/workspace/rollout-config";
import { DeliveryProofCopyButton } from "./delivery-proof-copy-button";

function titleCase(value: string | null | undefined) {
  if (!value) {
    return "unknown";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDeliveredTime(value: string) {
  return value.replace("T", " ").slice(11, 16);
}

function shortRunId(value: string | null | undefined) {
  return getClaudeDisplayRunId(value);
}

function compactEvidenceValue(value: string) {
  if (value.length <= 44) {
    return value;
  }

  const commandMatch = value.match(/^(\S+)\s+(.+?launch-localhost\.py)(\s+.*)$/);
  if (commandMatch) {
    const [, binary, scriptPath, args] = commandMatch;
    const scriptName = scriptPath?.replace(/^['"]|['"]$/g, "").split("/").filter(Boolean).at(-1);
    if (binary && scriptName && args) {
      return `${binary} .../${scriptName}${args}`;
    }
  }

  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const tail = pathParts.slice(-2).join("/");
    if (tail && pathParts.length > 2) {
      return `${url.origin}/.../${tail}`;
    }
  } catch {
    // Not a URL; handle local paths and commands below.
  }

  const pathParts = value.split("/").filter(Boolean);
  const tail = pathParts.slice(-2).join("/");
  if (value.startsWith("/") && tail && pathParts.length > 3) {
    const headCount = pathParts[0] === "Users" && pathParts[1] ? 2 : 1;
    return `/${pathParts.slice(0, headCount).join("/")}/.../${tail}`;
  }

  return `${value.slice(0, 28)}...${value.slice(-18)}`;
}

function DeliveryProofValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="min-w-0 rounded-[10px] border border-white/7 bg-white/[0.025] px-3 py-3"
      data-proof-row-label={label}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
          {label}
        </div>
        <DeliveryProofCopyButton label={label} value={value} />
      </div>
      <div className="mt-2 flex min-w-0 items-start gap-2">
        <div
          className="min-w-0 flex-1 truncate font-mono text-[11px] leading-6 text-white/82"
          title={value}
        >
          {compactEvidenceValue(value)}
        </div>
      </div>
      <details
        className="mt-1 rounded-[8px] border border-white/6 bg-black/20 px-2 py-1"
        data-proof-value-label={label}
      >
        <summary className="cursor-pointer text-[10px] uppercase tracking-[0.12em] text-white/44">
          Full value
        </summary>
        <code className="mt-2 block select-all break-all font-mono text-[10.5px] leading-5 text-white/76">
          {value}
        </code>
      </details>
    </div>
  );
}

type DeliverySourceWorkUnit = Pick<
  WorkUnitRecord,
  | "id"
  | "title"
  | "latestAttemptId"
  | "executorType"
  | "scopePaths"
  | "acceptanceCriteria"
  | "status"
>;

export function DeliverySummary({
  delivery,
  initiativeTitle,
  initiativePrompt,
  verification,
  assembly,
  taskGraphId,
  runId,
  handoffId,
  sourceWorkUnits,
  routeScope,
}: {
  delivery: DeliveryRecord;
  initiativeTitle: string;
  initiativePrompt?: string | null;
  verification: VerificationRunRecord | null;
  assembly: AssemblyRecord | null;
  taskGraphId?: string | null;
  runId?: string | null;
  handoffId?: string | null;
  sourceWorkUnits?: DeliverySourceWorkUnit[];
  routeScope?: Partial<ShellRouteScope> | null;
}) {
  const previewHref = delivery.previewUrl ?? null;
  const continuityHref = buildExecutionContinuityScopeHref(delivery.initiativeId, routeScope);
  const strictRolloutEnv = isStrictRolloutEnv();
  const readinessCopy = resolveDeliveryReadinessCopy(delivery, {
    strictRolloutEnv,
  });
  const runnableProofReady = readinessCopy.launchReady;
  const handoffReady = isDeliveryHandoffReady(delivery, { strictRolloutEnv });
  const pendingRunnableProof = runnableProofReady && !handoffReady;
  const displayPreviewHref = previewHref;
  const scaffoldOnly = delivery.launchProofKind === "attempt_scaffold" && !handoffReady;
  const wrapperOnly = delivery.launchProofKind === "synthetic_wrapper" && !handoffReady;
  const taskGraphHref = taskGraphId
    ? buildExecutionTaskGraphScopeHref(taskGraphId, routeScope, {
        initiativeId: delivery.initiativeId,
      })
    : null;
  const handoffHref = handoffId ? buildExecutionHandoffScopeHref(handoffId, routeScope) : null;
  const metricTone = handoffReady
    ? "border-emerald-400/20 bg-emerald-400/[0.05]"
    : pendingRunnableProof || scaffoldOnly || wrapperOnly
      ? "border-amber-400/20 bg-amber-400/[0.05]"
      : "border-white/10 bg-white/[0.03]";
  const reviewLabel = handoffReady
    ? "Delivered"
    : pendingRunnableProof
      ? "Runnable proof review"
      : scaffoldOnly
        ? "Scaffold review"
        : "Delivery";
  const proofLabel = handoffReady
    ? "runnable result"
    : pendingRunnableProof
      ? "runnable proof pending"
      : scaffoldOnly
        ? "attempt scaffold"
        : "wrapper preview";
  const sidebarActionTitle = handoffReady
    ? "Primary handoff"
    : pendingRunnableProof
      ? "Staging proof review"
      : scaffoldOnly
        ? "Scaffold review"
        : "Wrapper review";
  const sidebarActionDescription = handoffReady
    ? "Open the shell handoff packet and localhost preview. The delivery is backed by runnable-result proof."
    : pendingRunnableProof
      ? "Runnable-result proof exists, but this delivery is not handoff-ready until the required readiness gates are attached."
      : scaffoldOnly
        ? "Open the scaffold preview and handoff evidence, but do not treat it as proof that the requested product is truly runnable yet."
        : "Open the shell-generated preview wrapper and task graph before promoting this delivery any further.";
  const changedFiles = [
    delivery.manifestPath,
    delivery.launchManifestPath,
    delivery.localOutputPath ? `${delivery.localOutputPath}/preview.html` : null,
    delivery.localOutputPath ? `${delivery.localOutputPath}/HANDOFF.md` : null,
    delivery.localOutputPath ? `${delivery.localOutputPath}/delivery-summary.json` : null,
  ].filter((value): value is string => Boolean(value));
  const verificationPassedChecks =
    verification?.checks.filter((check) => check.status === "passed").length ?? 0;
  const verificationTotalChecks = verification?.checks.length ?? 0;
  const metrics = [
    {
      label: "Status",
      value: scaffoldOnly || wrapperOnly ? "Pending" : titleCase(delivery.status),
      detail: `${readinessCopy.statusDetail} · ${readinessCopy.tierLabel}`,
    },
    {
      label: "Build",
      value: verification ? titleCase(verification.overallStatus) : "pending",
      detail:
        verification && verificationTotalChecks > 0
          ? `${verificationTotalChecks} checks recorded`
          : "verification pending",
    },
    {
      label: "Tests",
      value: verification ? `${verificationPassedChecks} / ${verificationTotalChecks}` : "pending",
      detail: verification ? titleCase(verification.overallStatus) : "assembly pending",
    },
    {
      label: "Files",
      value: changedFiles.length > 0 ? String(changedFiles.length) : "pending",
      detail: delivery.localOutputPath
        ? scaffoldOnly || wrapperOnly
          ? "artifact bundle"
          : "runnable result"
        : "manifest pending",
    },
    {
      label: "Total time",
      value: delivery.deliveredAt ? formatDeliveredTime(delivery.deliveredAt) : "pending",
      detail: `${taskGraphId ? "task graph linked" : "task graph pending"} · ${delivery.launchTargetLabel ?? "launch pending"}`,
    },
  ];
  const validationRows = [
    {
      label: "delivery",
      value: titleCase(delivery.status),
      detail: delivery.id,
      tone: delivery.status === "ready" || delivery.status === "delivered" ? "success" : "warning",
    },
    {
      label: "tier",
      value: readinessCopy.tierLabel,
      detail: delivery.externalProofManifestPath ?? "hosted proof manifest not attached",
      tone: readinessCopy.tier === "production" ? "success" : "warning",
    },
    {
      label: "verification",
      value: verification ? titleCase(verification.overallStatus) : "pending",
      detail: verification?.id ?? "not attached",
      tone: verification?.overallStatus === "passed" ? "success" : "warning",
    },
    {
      label: "assembly",
      value: assembly ? titleCase(assembly.status) : "pending",
      detail: assembly?.id ?? "not attached",
      tone: assembly?.status === "assembled" ? "success" : "warning",
    },
    {
      label: "launch",
      value:
        delivery.launchProofKind === "runnable_result" && delivery.launchProofAt
          ? "proven"
          : delivery.launchProofKind === "attempt_scaffold"
            ? "scaffold"
          : delivery.launchProofKind === "synthetic_wrapper"
            ? "wrapper"
            : "pending",
      detail: delivery.launchProofUrl ?? delivery.command ?? "launch proof pending",
      tone:
        delivery.launchProofKind === "runnable_result" && delivery.launchProofAt
          ? "success"
          : "warning",
    },
  ];
  const artifactRows = [
    {
      label: "Preview URL",
      value: displayPreviewHref ?? "pending",
    },
    {
      label: "Local output path",
      value: delivery.localOutputPath ?? "n/a",
    },
    {
      label: "Manifest path",
      value: delivery.manifestPath ?? "pending",
    },
    {
      label: "Launch manifest",
      value: delivery.launchManifestPath ?? "pending",
    },
    {
      label: "Launch proof URL",
      value: delivery.launchProofUrl ?? "pending",
    },
    {
      label: "Launch command",
      value: delivery.command ?? "pending",
    },
    {
      label: "Proof kind",
      value: delivery.launchProofKind ?? "pending",
    },
    {
      label: "Readiness tier",
      value: readinessCopy.tier,
    },
    {
      label: "External proof manifest",
      value: delivery.externalProofManifestPath ?? "not attached",
    },
  ];
  const priorityArtifactRows = artifactRows.filter((row) =>
    ["Preview URL", "Manifest path", "Launch command", "Proof kind"].includes(row.label),
  );
  const displayPreviewLabel = displayPreviewHref ?? "preview pending";
  const visibleSourceWorkUnits = sourceWorkUnits ?? [];

  return (
    <main className="mx-auto grid max-w-[1520px] gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <section className="min-w-0 space-y-5">
        <div className="flex items-center gap-2 text-[11px] text-white/56">
          <Link href={continuityHref} className="inline-flex items-center gap-1 transition hover:text-white">
            Runs
          </Link>
          <span>›</span>
          <span className="font-mono">{shortRunId(runId)}</span>
          <span>›</span>
          <span>{reviewLabel}</span>
        </div>

        <header className="space-y-4">
          <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${handoffReady ? "text-emerald-200/86" : "text-amber-200/86"}`}>
              {handoffReady ? "Delivered" : "Delivery"} · {delivery.id}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="max-w-4xl text-[26px] font-semibold tracking-[-0.05em] text-white">
                {initiativeTitle}
              </h1>
              <p className="mt-3 max-w-3xl font-mono text-[12px] leading-7 text-white/54">
                {initiativePrompt ?? delivery.command ?? "Launch command not available yet."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="#delivery-validation">
                <PlaneButton variant="subtle" size="sm">
                  Logs
                </PlaneButton>
              </a>
              {previewHref ? (
                <Link href={displayPreviewHref ?? previewHref}>
                  <PlaneButton variant="ghost" size="sm">
                    {readinessCopy.actionLabel}
                  </PlaneButton>
                </Link>
              ) : null}
              {handoffReady && handoffHref ? (
                <Link href={handoffHref}>
                  <PlaneButton variant="primary" size="sm">
                    Handoff packet
                  </PlaneButton>
                </Link>
              ) : null}
              {!handoffReady && taskGraphHref ? (
                <Link href={taskGraphHref}>
                  <PlaneButton variant="subtle" size="sm">
                    Open task graph
                  </PlaneButton>
                </Link>
              ) : null}
            </div>
          </div>

          <div className={`grid overflow-hidden rounded-[14px] border md:grid-cols-5 ${metricTone}`}>
            {metrics.map((metric, index) => (
              <div
                key={metric.label}
                      className={`px-4 py-4 ${index < metrics.length - 1 ? "border-b md:border-b-0 md:border-r" : ""} ${
                  handoffReady
                    ? "border-emerald-400/14"
                    : pendingRunnableProof || scaffoldOnly || wrapperOnly
                      ? "border-amber-400/14"
                      : "border-white/10"
                }`}
              >
                <div className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  handoffReady
                    ? "text-emerald-200/64"
                    : pendingRunnableProof || scaffoldOnly || wrapperOnly
                      ? "text-amber-200/64"
                      : "text-white/48"
                }`}>
                  {metric.label}
                </div>
                <div className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-white">
                  {metric.value}
                </div>
                <div className="mt-1 font-mono text-[10.5px] text-white/52">{metric.detail}</div>
              </div>
            ))}
          </div>
        </header>

        <section className="overflow-hidden rounded-[16px] border border-white/9 bg-white/[0.02]">
          <div className="flex items-center gap-3 border-b border-white/6 px-4 py-3">
            <div className="flex gap-2">
              <span className="h-2 w-2 rounded-full bg-white/20" />
              <span className="h-2 w-2 rounded-full bg-white/20" />
              <span className="h-2 w-2 rounded-full bg-white/20" />
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-full border border-white/8 bg-white/[0.025] px-3 py-2 font-mono text-[11px] text-white/78">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(73,209,141,0.45)]" />
              <span className="truncate">{displayPreviewLabel}</span>
            </div>
              <span className="font-mono text-[10.5px] text-[var(--shell-sidebar-muted)]">
              {proofLabel}
            </span>
          </div>

          <div className="grid min-h-[420px] bg-[#0d0f12] px-6 py-8">
            <div className="space-y-5">
              <div className="overflow-hidden rounded-[14px] border border-white/8 bg-[#0c0f12]">
                {displayPreviewHref ? (
                  <iframe
                    src={displayPreviewHref}
                    title="Delivery preview"
                    className="h-[420px] w-full bg-white"
                  />
                ) : (
                  <div className="grid h-[420px] place-items-center text-[13px] text-white/48">
                    Preview pending
                  </div>
                )}
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[14px] border border-white/8 bg-white/[0.025] px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                      Changed files
                    </div>
                    <span className="font-mono text-[11px] text-white/48">{changedFiles.length} artifacts</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {changedFiles.map((item) => (
                      <div
                        key={item}
                        className="rounded-[10px] border border-white/6 bg-white/[0.02] px-4 py-3"
                        title={item}
                      >
                        <div className="truncate font-mono text-[11px] leading-6 text-white/76">
                          {compactEvidenceValue(item)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div id="delivery-validation" className="rounded-[14px] border border-white/8 bg-white/[0.025] px-5 py-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                      Validation
                    </div>
                    <div className="mt-3 space-y-2">
                      {validationRows.map((row) => (
                        <div
                          key={row.label}
                          className="grid grid-cols-[110px_90px_minmax(0,1fr)] items-center gap-3 rounded-[10px] border border-white/6 bg-white/[0.02] px-3 py-3"
                        >
                          <span className="font-mono text-[11px] text-white/82">{row.label}</span>
                          <span className={`inline-flex items-center gap-2 text-[11px] ${
                            row.tone === "success" ? "text-emerald-200" : "text-amber-200"
                          }`}>
                            <span className={row.tone === "success" ? "text-emerald-300" : "text-amber-300"}>
                              {row.tone === "success" ? "✓" : "!"}
                            </span>
                            {row.value}
                          </span>
                          <span className="truncate font-mono text-[10.5px] text-[var(--shell-sidebar-muted)]">
                            {row.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-white/8 bg-white/[0.025] px-5 py-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                      Result summary
                    </div>
                    <div className="mt-3 text-[15px] font-medium tracking-[-0.02em] text-white">
                      {readinessCopy.resultHeadline}
                    </div>
                    <p className="mt-2 text-[13px] leading-7 text-white/56">
                      {delivery.resultSummary}
                    </p>
                  </div>

                  <div className="rounded-[14px] border border-white/8 bg-white/[0.025] px-5 py-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                      Runnable proof
                    </div>
                    <div
                      className="mt-4 grid gap-3 2xl:grid-cols-2"
                      data-delivery-proof-grid="grouped"
                    >
                      {artifactRows.map((row) => (
                        <DeliveryProofValue key={row.label} label={row.label} value={row.value} />
                      ))}
                    </div>
                    <details
                      className="mt-4 rounded-[10px] border border-white/7 bg-black/20 px-4 py-3"
                      data-proof-drawer="all-values"
                    >
                      <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.14em] text-white/54">
                        All proof values
                      </summary>
                      <div className="mt-3 space-y-3">
                        {artifactRows.map((row) => (
                          <div key={row.label}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                              {row.label}
                            </div>
                            <code className="mt-1 block select-all break-all font-mono text-[10.5px] leading-5 text-white/72">
                              {row.value}
                            </code>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              </div>

              <details
                className="rounded-[14px] border border-white/8 bg-white/[0.025] px-5 py-5"
                data-secondary-evidence="source-work-units"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                        Secondary source evidence
                      </div>
                      <div className="mt-1 text-[13px] text-white/62">
                        Source work units
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-white/48">
                      {visibleSourceWorkUnits.length} linked
                    </span>
                  </div>
                </summary>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {visibleSourceWorkUnits.length ? (
                    visibleSourceWorkUnits.map((workUnit) => (
                      <div
                        key={workUnit.id}
                        className="rounded-[10px] border border-white/6 bg-white/[0.02] px-4 py-3"
                      >
                        <div className="font-mono text-[11px] text-white/48">{workUnit.id}</div>
                        <div className="mt-1 text-[13px] font-medium text-white">{workUnit.title}</div>
                        <div className="mt-2 grid grid-cols-[82px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[10.5px] text-white/52">
                          <span>attempt</span>
                          <span className="truncate font-mono text-white/78">
                            {workUnit.latestAttemptId ?? "pending"}
                          </span>
                          <span>executor</span>
                          <span className="font-mono text-white/78">{workUnit.executorType}</span>
                          <span>status</span>
                          <span className="font-mono text-white/78">{workUnit.status}</span>
                          <span>scope</span>
                          <span className="truncate font-mono text-white/78">
                            {workUnit.scopePaths[0] ?? "n/a"}
                          </span>
                        </div>
                        {workUnit.acceptanceCriteria[0] ? (
                          <div className="mt-2 text-[11px] leading-5 text-white/54">
                            {workUnit.acceptanceCriteria[0]}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[10px] border border-dashed border-white/8 px-4 py-3 text-[12px] text-white/48">
                      No source work units were attached to this delivery.
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
        </section>
      </section>

      <aside className="hidden xl:block">
        <div className="sticky top-0 h-[calc(100vh-56px)] overflow-auto border-l border-[color:var(--shell-sidebar-border)] bg-[rgba(8,11,15,0.6)] px-5 py-5">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shell-sidebar-muted)]">
              Delivery
            </div>
            <div className="mt-2 text-[18px] font-semibold tracking-[-0.03em] text-white">
              {readinessCopy.sidebarTitle}
            </div>
            <p className="mt-2 text-[12px] leading-6 text-white/54">
              {readinessCopy.sidebarDescription}
            </p>
          </div>

          <div className="mt-5 rounded-[14px] border border-[rgba(133,169,255,0.28)] bg-[rgba(133,169,255,0.08)] px-4 py-4">
            <div className="text-[14px] font-medium text-[#dfe8ff]">
              {sidebarActionTitle}
            </div>
            <p className="mt-3 text-[12px] leading-6 text-[#dfe8ff]/80">
              {sidebarActionDescription}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {handoffReady && handoffHref ? (
                <Link href={handoffHref}>
                  <PlaneButton variant="primary" size="md" className="w-full justify-center">
                    Open handoff packet
                  </PlaneButton>
                </Link>
              ) : null}
              {!handoffReady && taskGraphHref ? (
                <Link href={taskGraphHref}>
                  <PlaneButton variant="primary" size="md" className="w-full justify-center">
                    Open task graph
                  </PlaneButton>
                </Link>
              ) : null}
              {displayPreviewHref ? (
                <Link href={displayPreviewHref}>
                  <PlaneButton variant="ghost" size="md" className="w-full justify-center">
                    {readinessCopy.actionLabel}
                  </PlaneButton>
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-5 rounded-[12px] border border-white/8 bg-white/[0.025] px-4 py-4 text-[11px]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
              Proof shortcuts
            </div>
            <div className="mt-4 grid gap-3">
              {priorityArtifactRows.map((row) => (
                <DeliveryProofValue key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-white/54">
              {displayPreviewHref ? (
                <Link href={displayPreviewHref} className="transition hover:text-white">
                  Open preview
                </Link>
              ) : null}
              <Link href={continuityHref} className="transition hover:text-white">
                Open run
              </Link>
              {handoffReady && handoffHref ? (
                <Link href={handoffHref} className="transition hover:text-white">
                  Open handoff packet
                </Link>
              ) : null}
              {!handoffReady && taskGraphHref ? (
                <Link href={taskGraphHref} className="transition hover:text-white">
                  Open task graph
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-5 rounded-[12px] border border-dashed border-white/10 px-4 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
              Manual override
            </div>
            <p className="mt-3 text-[12px] leading-6 text-white/48">
              Secondary tools stay demoted. Use continuity or task-graph routes if the result needs to be reworked before handoff.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={continuityHref}>
                <PlaneButton variant="subtle" size="sm">
                  Re-run
                </PlaneButton>
              </Link>
              <PlaneButton variant="subtle" size="sm">
                Resume w/ prompt
              </PlaneButton>
              <PlaneButton variant="subtle" size="sm">
                Archive
              </PlaneButton>
            </div>
          </div>

          <div className="mt-5 rounded-[12px] border border-white/8 bg-white/[0.025] px-4 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
              Tweaks
            </div>
            <div className="mt-4 space-y-4 text-[12px] text-white/72">
              <div>
                <div className="text-white">Current surface</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Frontdoor", "Board", "Run", "Result"].map((item) => (
                    <PlaneStatusPill
                      key={item}
                      status={item === "Result" ? "planning" : "neutral"}
                      mono
                      size="sm"
                    >
                      {item}
                    </PlaneStatusPill>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-white">Live stage</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["clarifying", "planning", "running", "verifying"].map((item) => (
                    <PlaneStatusPill key={item} status="neutral" mono size="sm">
                      {item}
                    </PlaneStatusPill>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
