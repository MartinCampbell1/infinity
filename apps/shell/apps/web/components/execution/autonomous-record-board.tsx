import { PencilLine } from "lucide-react";
import Link from "next/link";
import React, { type ReactNode } from "react";

import {
  PlaneButton,
  PlaneDisabledAction,
  PlaneIconButton,
  PlaneProgressBar,
  PlaneStatusPill,
} from "./plane-run-primitives";
import { redactLocalUiText } from "../../lib/ui-redaction";

export type AutonomousBoardTask = {
  id: string;
  title: string;
  tag?: string | null;
  agent?: string | null;
  status: string;
  code?: string | null;
  pct?: number | null;
  attempts?: string | null;
  value: number;
  total: number;
};

export type AutonomousBoardItem = {
  id: string;
  title?: string;
  headline?: string;
  prompt?: string;
  detail?: string | null;
  stage?: string;
  health?: string;
  preview?: string;
  handoff?: string;
  updated?: string;
  tasks?: string;
  agent?: string;
  requestedBy?: string | null;
  workspace?: string | null;
  sessions?: number;
  startedAt?: string | null;
  repo?: string | null;
  assignment?: string | null;
  backend?: string | null;
  attempts?: string | null;
  workspacePath?: string | null;
  displayId?: string | null;
  featured?: boolean;
  href?: string | null;
  group?: "running" | "attention" | "completed";
  meta?: Array<string | null | undefined>;
  taskItems?: AutonomousBoardTask[];
};

function groupMeta(group: AutonomousBoardItem["group"]) {
  if (group === "completed") {
    return { label: "Completed", tone: "completed" as const };
  }
  if (group === "attention") {
    return { label: "Needs attention", tone: "pending" as const };
  }
  return { label: "Running", tone: "planning" as const };
}

function valueFromMeta(meta: Array<string | null | undefined> | undefined, prefix: string) {
  const match = (meta ?? []).find((entry) => entry?.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : null;
}

function normalizeItem(item: AutonomousBoardItem): Required<
  Pick<
    AutonomousBoardItem,
    | "id"
    | "title"
    | "prompt"
    | "stage"
    | "health"
    | "preview"
    | "handoff"
    | "updated"
    | "tasks"
    | "agent"
    | "href"
    | "group"
  >
> &
  Pick<
    AutonomousBoardItem,
    | "requestedBy"
    | "workspace"
    | "sessions"
    | "startedAt"
    | "repo"
    | "assignment"
    | "backend"
    | "attempts"
    | "workspacePath"
    | "displayId"
    | "featured"
    | "taskItems"
  > {
  const title = redactLocalUiText(item.title ?? item.headline ?? item.id);
  const prompt = redactLocalUiText(item.prompt ?? item.detail ?? "");
  const stage = item.stage ?? valueFromMeta(item.meta, "stage ") ?? "unknown";
  const health = item.health ?? valueFromMeta(item.meta, "health ") ?? "unknown";
  const preview = item.preview ?? valueFromMeta(item.meta, "preview ") ?? "none";
  const handoff = item.handoff ?? valueFromMeta(item.meta, "handoff ") ?? "none";
  const updated = item.updated ?? valueFromMeta(item.meta, "updated ") ?? "recent";
  const tasks = item.tasks ?? valueFromMeta(item.meta, "tasks ") ?? "0 / 0";
  const agent = item.agent ?? valueFromMeta(item.meta, "agent ") ?? "worker";
  const group =
    item.group ??
    (stage === "completed" || stage === "ready" || handoff === "ready"
      ? "completed"
      : stage === "blocked" || stage === "failed" || health === "blocked" || health === "failed"
        ? "attention"
        : "running");

  return {
    id: item.id,
    title,
    prompt,
    stage,
    health,
    preview: redactLocalUiText(preview),
    handoff: redactLocalUiText(handoff),
    updated,
    tasks,
    agent,
    href: item.href ?? null,
    group,
    requestedBy: item.requestedBy ?? null,
    workspace: item.workspace ? redactLocalUiText(item.workspace) : null,
    sessions: item.sessions ?? 0,
    startedAt: item.startedAt ?? null,
    repo: item.repo ? redactLocalUiText(item.repo) : null,
    assignment: item.assignment ? redactLocalUiText(item.assignment) : null,
    backend: item.backend ? redactLocalUiText(item.backend) : null,
    attempts: item.attempts ?? null,
    workspacePath: item.workspacePath ? redactLocalUiText(item.workspacePath) : null,
    displayId: item.displayId ?? null,
    featured: item.featured ?? false,
    taskItems: item.taskItems ?? [],
  };
}

function shortId(value: string | null | undefined) {
  if (!value) {
    return "run";
  }
  const trimmed = value.split("-").at(-1) ?? value;
  return trimmed.slice(0, 6);
}

function compactTaskTag(task: AutonomousBoardTask) {
  if (task.tag) {
    return `#${task.tag.replace(/[_\s]+/g, "_")}`;
  }
  return "#task";
}

function taskAttemptLabel(task: AutonomousBoardTask) {
  return task.attempts ?? (task.status === "completed" ? "1/1" : task.status === "running" ? "1/2" : "0/0");
}

function taskPercent(task: AutonomousBoardTask) {
  if (typeof task.pct === "number") {
    return task.pct;
  }
  if (task.total <= 0) {
    return 0;
  }
  return Math.round((task.value / task.total) * 100);
}

function formatStartedAt(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function AutonomousRecordBoard({
  eyebrow,
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
  headerAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: AutonomousBoardItem[];
  emptyTitle: string;
  emptyDescription: string;
  headerAction?: ReactNode;
}) {
  if (items.length === 0) {
    return (
      <main className="mx-auto flex max-w-[1280px] flex-col gap-5">
        <header className="space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
            {eyebrow}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-white">{title}</h1>
              <p className="max-w-3xl text-[13px] leading-6 text-white/58">{description}</p>
            </div>
            {headerAction}
          </div>
        </header>
        <section className="rounded-[20px] border border-white/8 bg-white/[0.02] px-5 py-6">
          <div className="text-[16px] font-medium text-white">{emptyTitle}</div>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-white/54">{emptyDescription}</p>
        </section>
      </main>
    );
  }

  const normalizedItems = items.map(normalizeItem);
  const selected =
    normalizedItems.find((item) => item.featured) ??
    normalizedItems.find((item) => item.group === "running") ??
    normalizedItems.find((item) => item.group === "completed") ??
    normalizedItems[0]!;
  const grouped = ["running", "attention", "completed"].map((group) => ({
    group,
    rows: normalizedItems.filter((item) => item.group === group),
  }));
  const activeRuns = grouped.find((entry) => entry.group === "running")?.rows.length ?? 0;
  const attentionRuns = grouped.find((entry) => entry.group === "attention")?.rows.length ?? 0;
  const completedRuns = grouped.find((entry) => entry.group === "completed")?.rows.length ?? 0;
  const missingRunRouteReason =
    "Open run requires a concrete execution route; this row is read-only until href is attached.";
  const closeDrawerReason =
    "Drawer close is disabled in this server-rendered board.";
  const previewReason =
    "Preview requires a concrete preview route before it can be enabled.";
  const logsReason =
    "Logs require a concrete run log route before they can be enabled.";

  return (
    <main className="mx-auto grid max-w-[1520px] gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 space-y-5">
        <header className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
                {eyebrow}
              </div>
              <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.05em] text-white">{title}</h1>
              <p className="mt-2 max-w-3xl text-[13px] leading-7 text-white/56">{description}</p>
            </div>
            {headerAction ?? (
              <Link href="/">
                <PlaneButton variant="ghost" size="md" icon={<PencilLine className="h-4 w-4" />}>
                  New run
                </PlaneButton>
              </Link>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: "Active runs", value: activeRuns, detail: "live execution", active: true },
              { label: "Attention", value: attentionRuns, detail: "recovery / blocked", active: false },
              { label: "Completed", value: completedRuns, detail: "ready / delivered", active: false },
              {
                label: "Recoveries",
                value: attentionRuns,
                detail: attentionRuns > 0 ? `1 auto · ${attentionRuns} pending` : "operator follow-up",
                active: false,
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className={`rounded-[16px] border px-4 py-4 ${
                  tile.active
                    ? "border-[rgba(133,169,255,0.28)] bg-[rgba(133,169,255,0.06)]"
                    : "border-white/8 bg-white/[0.03]"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48">
                  {tile.label}
                </div>
                <div className="mt-2 text-[26px] font-semibold tracking-[-0.04em] text-white">
                  {tile.value}
                </div>
                <div className="mt-1 text-[11px] text-white/56">{tile.detail}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-[2px]">
              <span className="inline-flex items-center rounded-[8px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-hover)] px-3 py-1.5 text-[11px] text-white">
                List
              </span>
              <span className="inline-flex items-center rounded-[8px] border border-transparent px-3 py-1.5 text-[11px] text-white/56">
                Board
              </span>
              <span className="inline-flex items-center rounded-[8px] border border-transparent px-3 py-1.5 text-[11px] text-white/56">
                Graph
              </span>
            </div>
            <div className="mx-1 h-[18px] w-px bg-white/6" />
            <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5 text-[11px] text-white/72">
              Stage
            </span>
            <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5 text-[11px] text-white/72">
              Agent
            </span>
            <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5 text-[11px] text-white/72">
              Preview
            </span>
            <div className="flex-1" />
            <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5 text-[11px] text-white/72">
              Group: status
            </span>
            <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5 text-[11px] text-white/56">
              Search runs
            </span>
          </div>
        </header>

        <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[var(--shell-surface-card)]">
          <div className="grid grid-cols-[96px_minmax(280px,1fr)_130px_96px_100px_116px_80px_22px] gap-3 border-b border-white/6 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--shell-sidebar-muted)]">
            <div>ID</div>
            <div>Prompt</div>
            <div>Stage</div>
            <div>Preview</div>
            <div>Tasks</div>
            <div>Agent</div>
            <div>Updated</div>
            <div />
          </div>

          {grouped.map((entry) => {
            if (entry.rows.length === 0) {
              return null;
            }
            const meta = groupMeta(entry.group as AutonomousBoardItem["group"]);

            return (
              <div key={entry.group}>
                <div className="flex items-center gap-3 border-t border-white/5 bg-white/[0.015] px-4 py-3 text-[11px] text-white/86">
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${meta.tone === "completed" ? "bg-emerald-400" : meta.tone === "pending" ? "bg-amber-400" : "bg-sky-400"}`} />
                    {meta.label}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--shell-sidebar-muted)]">
                    {entry.rows.length}
                  </span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                {entry.rows.map((item) => {
                  const isSelected = item.id === selected.id;
                  const rowClassName = `grid grid-cols-[96px_minmax(280px,1fr)_130px_96px_100px_116px_80px_22px] items-center gap-3 border-b border-white/5 px-4 py-3 transition ${
                        isSelected
                          ? "border-l-2 border-l-[var(--primary)] bg-[rgba(133,169,255,0.07)]"
                          : item.href
                            ? "hover:bg-white/[0.025]"
                            : "cursor-not-allowed opacity-70"
                      }`;
                  const rowContent = (
                    <>
                      <div className="font-mono text-[11px] text-white/72">
                        {shortId(item.displayId ?? item.id)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 overflow-hidden text-[13px] text-white">
                          <span className={`h-2 w-2 rounded-full ${item.group === "completed" ? "bg-emerald-400" : item.group === "attention" ? "bg-amber-400" : "bg-sky-400"}`} />
                          <span className="truncate">{item.title}</span>
                        </div>
                      </div>
                      <PlaneStatusPill status={item.stage} mono size="sm">
                        {item.stage}
                      </PlaneStatusPill>
                      <div className="font-mono text-[11px] text-white/56">{item.preview}</div>
                      <div className="font-mono text-[11px] text-white/56">{item.tasks}</div>
                      <div className="text-[11px] text-white/62">{item.agent}</div>
                      <div className="font-mono text-[11px] text-white/56">{item.updated}</div>
                      <div className="text-right text-white/42">›</div>
                    </>
                  );

                  return item.href ? (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={rowClassName}
                    >
                      {rowContent}
                    </Link>
                  ) : (
                    <div
                      key={item.id}
                      className={rowClassName}
                      title={missingRunRouteReason}
                      aria-disabled="true"
                      data-disabled-action="Open run"
                      data-disabled-action-reason={missingRunRouteReason}
                    >
                      {rowContent}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      </section>

      <aside className="hidden xl:block">
        <div className="sticky top-0 h-[calc(100vh-56px)] overflow-auto border-l border-[color:var(--shell-sidebar-border)] bg-[rgba(8,11,15,0.65)] px-5 py-5">
          <div className="flex items-center gap-2 text-[11px] text-white/56">
            <span className="font-mono">{shortId(selected.displayId ?? selected.id)}</span>
            <span>›</span>
            <span>{selected.stage}</span>
            <div className="flex-1" />
            <PlaneIconButton
              size={26}
              disabled
              title={closeDrawerReason}
            >
              ×
            </PlaneIconButton>
          </div>

          <div className="mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shell-sidebar-muted)]">
              Run · {shortId(selected.displayId ?? selected.id)}
            </div>
            <div className="mt-3 text-[18px] font-semibold tracking-[-0.03em] text-white">
              {selected.title}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <PlaneStatusPill status={selected.stage} mono>
              {selected.stage}
            </PlaneStatusPill>
            <PlaneStatusPill status="neutral" mono>
              attempts {selected.attempts ?? "1/3"}
            </PlaneStatusPill>
            <PlaneStatusPill status="neutral" mono>
              {selected.assignment ?? "implementer"}
            </PlaneStatusPill>
          </div>

          <div className="mt-4 flex gap-2">
            {selected.href ? (
              <Link href={selected.href}>
                <PlaneButton variant="ghost" size="sm">
                  Open run
                </PlaneButton>
              </Link>
            ) : null}
            <PlaneDisabledAction
              label="Preview"
              reason={previewReason}
            >
              Preview
            </PlaneDisabledAction>
            <PlaneDisabledAction
              label="Logs"
              reason={logsReason}
            >
              Logs
            </PlaneDisabledAction>
          </div>

          <div className="mt-5 grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 rounded-[14px] border border-white/8 bg-white/[0.025] px-4 py-4 text-[11px]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Repo</div>
            <div className="font-mono text-white">{selected.repo ?? "infinity-shell"}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Assignment</div>
            <div className="text-white">{selected.assignment ?? "implementer"}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Backend</div>
            <div className="font-mono text-white">{selected.backend ?? "codex · gpt-5.1 · high"}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Started</div>
            <div className="text-white">{formatStartedAt(selected.startedAt)}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Sessions</div>
            <div className="text-white">{selected.sessions ?? 0}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">Workspace</div>
            <div className="truncate font-mono text-white/78">
              {selected.workspacePath ?? selected.workspace ?? "n/a"}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
              <span>Progress</span>
              <span className="font-mono normal-case tracking-normal text-white/66">{selected.tasks}</span>
            </div>
            <PlaneProgressBar
              className="mt-2"
              value={Number(selected.tasks.split("/")[0] ?? 0)}
              total={Number(selected.tasks.split("/")[1] ?? 1)}
            />
          </div>

          <div className="mt-5 border-b border-white/8 pb-2 text-[11px] text-white/56">
            tasks · attempts · timing · attachments
          </div>

          <div className="mt-4 space-y-3">
            {(selected.taskItems ?? []).map((task) => (
              <div
                key={task.id}
                className={`rounded-[10px] border px-3 py-3 ${
                  task.status === "running"
                    ? "border-sky-400/25 bg-sky-400/6"
                    : task.status === "completed"
                      ? "border-emerald-400/18 bg-emerald-400/5"
                      : "border-white/6 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[var(--shell-sidebar-muted)]">
                    {task.code ?? shortId(task.id)}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--shell-sidebar-muted)]">
                    {compactTaskTag(task)}
                  </span>
                </div>
                <div className="mt-2 text-[12px] leading-5 text-white">{task.title}</div>
                <div className="mt-3">
                  <PlaneProgressBar
                    value={taskPercent(task)}
                    total={100}
                    color={
                      task.status === "completed"
                        ? "var(--status-running)"
                        : task.status === "running"
                          ? "var(--status-planning)"
                          : "rgba(255,255,255,0.2)"
                    }
                  />
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[var(--shell-sidebar-muted)]">
                  <span>{task.agent ?? "worker"}</span>
                  <span>
                    {task.status === "completed" ? "done" : taskAttemptLabel(task)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}
