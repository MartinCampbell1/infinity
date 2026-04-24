"use client";

import {
  BadgeCheck,
  Bell,
  Bot,
  Boxes,
  BookOpenText,
  ChevronDown,
  Pause,
  GitBranch,
  LayoutGrid,
  LifeBuoy,
  Package,
  PanelLeft,
  PencilLine,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  TriangleAlert,
  UserCircle2,
  Workflow,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";

type ShellNavItem = {
  label: string;
  href: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  count?: string;
  match: (pathname: string) => boolean;
};

type ShellNavGroup = {
  label: string;
  railLabel: string;
  icon: ComponentType<{ className?: string }>;
  items: ShellNavItem[];
};

const CONTROL_PLANE_ITEMS: ShellNavItem[] = [
  {
    label: "Run control plane",
    href: "/execution/runs",
    description: "Canonical autonomous lifecycle",
    icon: LayoutGrid,
    match: (pathname) =>
      pathname === "/" || pathname === "/execution" || pathname.startsWith("/execution/runs"),
  },
  {
    label: "Planner",
    href: "/execution/planner",
    description: "Task graph and planning lane",
    icon: GitBranch,
    match: (pathname) =>
      pathname.startsWith("/execution/planner") ||
      pathname.startsWith("/execution/task-graphs/") ||
      pathname.startsWith("/execution/batches/"),
  },
  {
    label: "Tasks",
    href: "/execution/tasks",
    description: "Work-item ownership",
    icon: Boxes,
    match: (pathname) => pathname.startsWith("/execution/tasks"),
  },
];

const OPERATOR_ITEMS: ShellNavItem[] = [
  {
    label: "Recoveries",
    href: "/execution/recoveries",
    description: "Retry and failover actions",
    icon: TimerReset,
    match: (pathname) => pathname.startsWith("/execution/recoveries"),
  },
  {
    label: "Approvals",
    href: "/execution/approvals",
    description: "Pending operator decisions",
    icon: BadgeCheck,
    match: (pathname) => pathname.startsWith("/execution/approvals"),
  },
  {
    label: "Validation",
    href: "/execution/validation",
    description: "Verification and proof",
    icon: ShieldCheck,
    match: (pathname) => pathname.startsWith("/execution/validation"),
  },
  {
    label: "Refusals",
    href: "/execution/refusals",
    description: "Worker refusals and failures",
    icon: TriangleAlert,
    match: (pathname) => pathname.startsWith("/execution/refusals"),
  },
];

const AUTONOMOUS_ITEMS: ShellNavItem[] = [
  {
    label: "Agents",
    href: "/execution/agents",
    description: "Worker session state",
    icon: Bot,
    match: (pathname) => pathname.startsWith("/execution/agents"),
  },
  {
    label: "Previews",
    href: "/execution/previews",
    description: "Local preview targets",
    icon: PlayCircle,
    match: (pathname) => pathname.startsWith("/execution/previews"),
  },
  {
    label: "Delivery",
    href: "/execution/deliveries",
    description: "Delivery records and outputs",
    icon: Package,
    match: (pathname) =>
      pathname.startsWith("/execution/deliveries") ||
      pathname.startsWith("/execution/delivery/"),
  },
];

const SHELL_NAV_GROUPS: ShellNavGroup[] = [
  {
    label: "Control",
    railLabel: "Core control routes",
    icon: LayoutGrid,
    items: CONTROL_PLANE_ITEMS,
  },
  {
    label: "Autonomous",
    railLabel: "Autonomous execution lanes",
    icon: Workflow,
    items: AUTONOMOUS_ITEMS,
  },
  {
    label: "Operator",
    railLabel: "Operator intervention lanes",
    icon: ShieldCheck,
    items: OPERATOR_ITEMS,
  },
];

function pageMeta(pathname: string) {
  if (pathname === "/") {
    return {
      eyebrow: "Plane / Home",
      title: "Home",
      description: "Plane AI home.",
    };
  }

  if (pathname === "/work-items") {
    return {
      eyebrow: "Projects / Work items",
      title: "Work items",
      description:
        "Plane work-items board.",
    };
  }

  if (pathname === "/execution") {
    return {
      eyebrow: "Execution / Hub",
      title: "Autonomous control plane",
      description:
        "Shell-first entry for one-prompt runs, operator boards, and the live execution lifecycle.",
    };
  }

  if (pathname.startsWith("/execution/runs")) {
    return {
      eyebrow: "Execution / Runs",
      title: "Run control plane",
      description:
        "Canonical autonomous runs with durable lifecycle, preview readiness, and handoff state.",
    };
  }

  if (pathname.startsWith("/execution/spec")) {
    return {
      eyebrow: "Execution / Spec",
      title: "Spec lane",
      description:
        "Shell-authored spec artifacts and clarifications that feed the autonomous planner.",
    };
  }

  if (pathname.startsWith("/execution/planner")) {
    return {
      eyebrow: "Execution / Planner",
      title: "Planner lane",
      description:
        "Dependency-aware task graphs and batch materialization for autonomous execution.",
    };
  }

  if (pathname.startsWith("/execution/task-graphs/")) {
    return {
      eyebrow: "Execution / Task Graph",
      title: "Task graph inspection",
      description:
        "Planner output, dependency shape, and runnable work units for the current autonomous run.",
    };
  }

  if (pathname.startsWith("/execution/batches/")) {
    return {
      eyebrow: "Execution / Batch",
      title: "Batch supervision",
      description:
        "Batch-level attempt state, supervisor actions, and recovery transitions for the current execution lane.",
    };
  }

  if (pathname.startsWith("/execution/tasks")) {
    return {
      eyebrow: "Execution / Tasks",
      title: "Task board",
      description:
        "Work-item scope, executor ownership, and acceptance semantics stay visible in the shell.",
    };
  }

  if (pathname.startsWith("/execution/workspace/")) {
    return {
      eyebrow: "Execution / Workspace",
      title: "Embedded session workspace",
      description:
        "FounderOS stays the outer shell while the work surface opens inside the hosted workspace route.",
    };
  }

  if (pathname.startsWith("/execution/recoveries")) {
    return {
      eyebrow: "Execution / Recoveries",
      title: "Recovery control lane",
      description:
        "Retry, failover, and operator intervention stay visible as first-class shell objects.",
    };
  }

  if (pathname.startsWith("/execution/refusals")) {
    return {
      eyebrow: "Execution / Refusals",
      title: "Refusal lane",
      description:
        "Worker refusals and execution failures remain first-class shell objects, not hidden in logs.",
    };
  }

  if (pathname.startsWith("/execution/approvals")) {
    return {
      eyebrow: "Execution / Approvals",
      title: "Approval board",
      description:
        "Operator decisions remain durable and route-scoped, not buried in the chat canvas.",
    };
  }

  if (pathname.startsWith("/execution/accounts")) {
    return {
      eyebrow: "Execution / Accounts",
      title: "Capacity and quota",
      description:
        "Account pressure, schedulability, and session ownership live in the shell truth layer.",
    };
  }

  if (pathname.startsWith("/execution/groups")) {
    return {
      eyebrow: "Execution / Groups",
      title: "Grouped execution lanes",
      description:
        "Sessions should feel grouped and operationally scannable before the operator even opens a workspace.",
    };
  }

  if (pathname.startsWith("/execution/audits")) {
    return {
      eyebrow: "Execution / Audits",
      title: "Operator audit lane",
      description:
        "Every approval, retry, and recovery mutation needs a visible shell-side audit trail.",
    };
  }

  if (pathname.startsWith("/execution/events")) {
    return {
      eyebrow: "Execution / Events",
      title: "Event timeline",
      description:
        "Append-only autonomous run events, stage transitions, and delivery milestones emitted by the shell.",
    };
  }

  if (pathname.startsWith("/execution/agents")) {
    return {
      eyebrow: "Execution / Agents",
      title: "Agent runtime board",
      description:
        "Worker session ownership and attempt-level execution state for active autonomous batches.",
    };
  }

  if (pathname.startsWith("/execution/validation")) {
    return {
      eyebrow: "Execution / Validation",
      title: "Validation lane",
      description:
        "Verification outputs and autonomous proof artifacts for shell-first one-prompt runs.",
    };
  }

  if (pathname.startsWith("/execution/previews")) {
    return {
      eyebrow: "Execution / Previews",
      title: "Preview targets",
      description:
        "Local preview URLs served through the shell-owned preview boundary.",
    };
  }

  if (pathname.startsWith("/execution/deliveries")) {
    return {
      eyebrow: "Execution / Delivery",
      title: "Delivery board",
      description:
        "Final delivery records, preview links, and operator-facing output paths for completed runs.",
    };
  }

  if (pathname.startsWith("/execution/delivery/")) {
    return {
      eyebrow: "Execution / Delivery",
      title: "Delivery detail",
      description:
        "Single delivery record with preview, launch, and handoff evidence for the current run.",
    };
  }

  if (pathname.startsWith("/execution/handoffs")) {
    return {
      eyebrow: "Execution / Handoffs",
      title: "Handoff packets",
      description:
        "Final handoff packets and summary artifacts produced after preview-ready delivery.",
    };
  }

  if (pathname.startsWith("/execution/continuity/")) {
    return {
      eyebrow: "Execution / Continuity",
      title: "Initiative continuity",
      description:
        "Inspect the durable trace from intake through delivery, plus linked approvals, recoveries, and sidecar context.",
    };
  }

  if (pathname.startsWith("/execution/intake")) {
    return {
      eyebrow: "Execution / Intake",
      title: "Run composer",
      description:
        "Shell-first prompt entry for starting an autonomous run without manual stage gates.",
    };
  }

  if (pathname.startsWith("/execution/issues")) {
    return {
      eyebrow: "Execution / Issues",
      title: "Blocking issues",
      description:
        "When the autonomous path cannot honestly continue, the shell records a durable blocking issue instead of faking progress.",
    };
  }

  if (pathname.startsWith("/execution/projects/")) {
    return {
      eyebrow: "Execution / Project",
      title: "Project-scoped execution",
      description:
        "Project-level shell summary built from the current durable session and event truth.",
    };
  }

  return {
    eyebrow: "Execution / Sessions",
    title: "Session control plane",
    description:
      "Local Infinity shell aligned to the current FounderOS language, with hosted work mode kept separate from control mode.",
  };
}

function topbarMode(pathname: string) {
  if (pathname.startsWith("/execution/runs/")) {
    return "run";
  }
  if (pathname.startsWith("/execution/runs")) {
    return "runs";
  }
  if (pathname.startsWith("/execution/delivery/")) {
    return "delivery";
  }
  if (pathname === "/") {
    return "frontdoor";
  }
  return "default";
}

function NavSection({
  label,
  items,
  pathname,
}: {
  label: string;
  items: ShellNavItem[];
  pathname: string;
}) {
  return (
    <section className="space-y-1.5">
      <div className="shell-section-header px-3">{label}</div>
      <div className="space-y-1">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="shell-nav-item flex items-start gap-3 px-3 py-2.5"
              data-active={active}
            >
              <Icon
                className={
                  active
                    ? "mt-0.5 h-4 w-4 text-[var(--primary)]"
                    : "mt-0.5 h-4 w-4 text-[var(--shell-sidebar-muted)]"
                }
              />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">{item.label}</div>
              </div>
              {item.count ? (
                <span className="ml-auto font-mono text-[10px] text-[var(--shell-sidebar-muted)]">
                  {item.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function GroupRail({
  groups,
  pathname,
  isRootFrontdoor,
}: {
  groups: ShellNavGroup[];
  pathname: string;
  isRootFrontdoor: boolean;
}) {
  if (isRootFrontdoor) {
    return (
      <div className="shell-icon-rail hidden md:flex md:flex-col">
        <div className="flex h-14 items-center justify-center border-b border-[color:var(--shell-sidebar-border)]">
          <div className="shell-rail-brand text-[15px] font-medium text-white">I</div>
        </div>

        <div className="flex flex-1 flex-col items-center gap-4 px-2 py-4">
          {[
            { label: "Projects", icon: LayoutGrid, active: true },
            { label: "Wiki", icon: BookOpenText, active: false },
            { label: "AI", icon: Sparkles, active: false },
            { label: "Settings", icon: Wrench, active: false },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex flex-col items-center gap-1.5">
                <div className="shell-rail-button" data-active={item.active}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-[11px] text-[var(--shell-sidebar-muted)]">{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="shell-icon-rail hidden md:flex md:flex-col">
      <div className="flex h-14 items-center justify-center border-b border-[color:var(--shell-sidebar-border)]">
        <div className="shell-rail-brand text-[15px] font-medium text-white">I</div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-2 px-3 py-4">
        {groups.map((group) => {
          const Icon = group.icon;
          const active = group.items.some((item) => item.match(pathname));
          const activeItem = group.items.find((item) => item.match(pathname)) ?? group.items[0];
          const href = activeItem?.href ?? "/execution";

          return (
            <Link
              key={group.label}
              href={href}
              className="shell-rail-button"
              data-active={active}
              aria-label={group.railLabel}
              title={group.label}
            >
              <Icon className="h-4 w-4" />
            </Link>
          );
        })}
      </div>

      <div className="border-t border-[color:var(--shell-sidebar-border)] px-3 py-4">
        <button type="button" className="shell-rail-button" data-active="false" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function RootSidebarLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const active = pathname === href;

  return (
    <Link
      href={href}
      className="shell-nav-item flex items-center gap-3 px-3 py-2"
      data-active={active}
    >
      <div className="text-[12px] font-medium text-foreground">{label}</div>
    </Link>
  );
}

function RootSidebarGhostLink({ label }: { label: string }) {
  return <div className="px-3 py-2 text-[12px] text-[var(--shell-sidebar-muted)]">{label}</div>;
}

type RootSidebarSessionRecord = {
  id: string;
  title: string;
  status: string;
  projectId: string;
  projectName?: string | null;
  groupId?: string | null;
  accountId?: string | null;
  workspaceId?: string | null;
  pendingApprovals?: number;
  unreadOperatorSignals?: number;
};

function buildRootSidebarSessionHref(session: RootSidebarSessionRecord) {
  const params = new URLSearchParams();
  params.set("project_id", session.projectId);
  params.set("session_id", session.id);
  if (session.groupId) {
    params.set("group_id", session.groupId);
  }
  if (session.accountId) {
    params.set("account_id", session.accountId);
  }
  if (session.workspaceId) {
    params.set("workspace_id", session.workspaceId);
  }
  return `/execution/workspace/${session.id}?${params.toString()}`;
}

function RootSidebarRecentSession({
  session,
}: {
  session: RootSidebarSessionRecord;
}) {
  return (
    <Link
      href={buildRootSidebarSessionHref(session)}
      className="mx-1 block rounded-[14px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2.5 transition hover:bg-[color:var(--shell-control-hover)]"
    >
      <div className="truncate text-[12px] font-medium text-foreground">{session.title}</div>
      <div className="mt-1 truncate text-[11px] text-[var(--shell-sidebar-muted)]">
        {session.projectName ?? "Unknown project"}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2 py-0.5 text-[var(--shell-sidebar-muted)]">
          {session.status}
        </span>
        {typeof session.pendingApprovals === "number" ? (
          <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-2 py-0.5 text-[var(--shell-sidebar-muted)]">
            {session.pendingApprovals} approvals
          </span>
        ) : null}
        {typeof session.unreadOperatorSignals === "number" &&
        session.unreadOperatorSignals > 0 ? (
          <span className="inline-flex items-center rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-sky-200">
            {session.unreadOperatorSignals} signals
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [recentSessions, setRecentSessions] = useState<RootSidebarSessionRecord[]>([]);
  const [recentSessionsLoading, setRecentSessionsLoading] = useState(false);
  const meta = pageMeta(pathname);
  const isRootFrontdoor = pathname === "/";
  const isWorkItemsRoute = pathname === "/work-items";
  const isPlaneWorkspaceRoute = isWorkItemsRoute;
  const currentTopbarMode = topbarMode(pathname);
  const visibleRecentSessions = isPlaneWorkspaceRoute ? recentSessions : [];
  const visibleRecentSessionsLoading = isPlaneWorkspaceRoute
    ? recentSessionsLoading
    : false;

  useEffect(() => {
    if (!isPlaneWorkspaceRoute) {
      return;
    }

    const controller = new AbortController();

    fetch("/api/shell/execution/sessions?limit=5", {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load sessions: ${response.status}`);
        }
        return response.json() as Promise<{
          sessions?: Array<{
            id?: string;
            title?: string;
            status?: string;
            projectId?: string;
            projectName?: string | null;
            groupId?: string | null;
            accountId?: string | null;
            workspaceId?: string | null;
            pendingApprovals?: number;
            unreadOperatorSignals?: number;
          }>;
        }>;
      })
      .then((payload) => {
        const nextSessions = Array.isArray(payload.sessions)
          ? payload.sessions
              .filter(
                (
                  session
                ): session is {
                  id: string;
                  title: string;
                  status: string;
                  projectId: string;
                  projectName?: string | null;
                  groupId?: string | null;
                  accountId?: string | null;
                  workspaceId?: string | null;
                  pendingApprovals?: number;
                  unreadOperatorSignals?: number;
                } =>
                  typeof session?.id === "string" &&
                  typeof session?.title === "string" &&
                  typeof session?.status === "string" &&
                  typeof session?.projectId === "string"
              )
              .map((session) => ({
                id: session.id,
                title: session.title,
                status: session.status,
                projectId: session.projectId,
                projectName: session.projectName ?? null,
                groupId: session.groupId ?? null,
                accountId: session.accountId ?? null,
                workspaceId: session.workspaceId ?? null,
                pendingApprovals:
                  typeof session.pendingApprovals === "number"
                    ? session.pendingApprovals
                    : undefined,
                unreadOperatorSignals:
                  typeof session.unreadOperatorSignals === "number"
                    ? session.unreadOperatorSignals
                    : undefined,
              }))
          : [];
        setRecentSessions(nextSessions);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRecentSessions([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRecentSessionsLoading(false);
        }
      });

    return () => controller.abort();
  }, [isPlaneWorkspaceRoute]);

  return (
    <div className="shell-app-shell min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden border-r border-[color:var(--shell-sidebar-border)] md:flex">
          <GroupRail groups={SHELL_NAV_GROUPS} pathname={pathname} isRootFrontdoor={isPlaneWorkspaceRoute} />

          <div className="shell-sidebar-panel flex min-h-screen flex-col">
            <div className="shell-sidebar-top border-b border-[color:var(--shell-sidebar-border)] px-4 py-4">
              <div className="space-y-1">
                <div className="text-[16px] font-medium tracking-[-0.02em] text-foreground">
                  {isWorkItemsRoute ? "Projects" : "Execution"}
                </div>
                <div className="font-mono text-[11px] text-[var(--shell-sidebar-muted)]">
                  shell · FounderOS
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-[var(--shell-sidebar-muted)]"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
              {isPlaneWorkspaceRoute ? (
                <div className="space-y-6">
                  <section className="space-y-3">
                    {isRootFrontdoor ? (
                      <>
                        <button
                          type="button"
                          className="mx-1 inline-flex w-[calc(100%-8px)] items-center gap-2 rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2.5 text-[12px] text-foreground transition hover:bg-[color:var(--shell-control-hover)]"
                        >
                          <PencilLine className="h-4 w-4 text-[var(--shell-sidebar-muted)]" />
                          New chat
                        </button>
                        <button
                          type="button"
                          className="mx-1 inline-flex w-[calc(100%-8px)] items-center gap-2 rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2.5 text-[12px] text-[var(--shell-sidebar-muted)] transition hover:bg-[color:var(--shell-control-hover)]"
                        >
                          <Search className="h-4 w-4" />
                          Search
                        </button>
                        <div className="px-3 text-[11px] text-[var(--shell-sidebar-muted)]">Recents</div>
                        {visibleRecentSessionsLoading ? (
                          <div className="px-3 text-[12px] text-[var(--shell-sidebar-muted)]">
                            Loading sessions…
                          </div>
                        ) : visibleRecentSessions.length > 0 ? (
                          <div className="space-y-1">
                            {visibleRecentSessions.map((session) => (
                              <RootSidebarRecentSession key={session.id} session={session} />
                            ))}
                          </div>
                        ) : (
                          <div className="px-3 text-[12px] text-[var(--shell-sidebar-muted)]">No threads available</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="px-3 text-[14px] font-medium text-foreground">Live work</div>
                        <button
                          type="button"
                          className="mx-1 inline-flex w-[calc(100%-8px)] items-center gap-2 rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2.5 text-[12px] text-foreground transition hover:bg-[color:var(--shell-control-hover)]"
                        >
                          <PencilLine className="h-4 w-4 text-[var(--shell-sidebar-muted)]" />
                          New work item
                        </button>
                        <div className="space-y-1">
                          <RootSidebarLink href="/" label="Frontdoor" pathname={pathname} />
                          <RootSidebarGhostLink label="Recent operator work" />
                          <RootSidebarLink href="/execution" label="Execution hub" pathname={pathname} />
                          <RootSidebarLink
                            href="/execution/approvals"
                            label="Approval lane"
                            pathname={pathname}
                          />
                          <RootSidebarLink href="/execution/issues" label="Blocking issues" pathname={pathname} />
                        </div>
                        <div className="px-3 pt-2 text-[11px] text-[var(--shell-sidebar-muted)]">Live work</div>
                        <div className="space-y-1">
                          <RootSidebarLink href="/work-items" label="Work items" pathname={pathname} />
                          {visibleRecentSessionsLoading ? (
                            <div className="px-3 py-2 text-[12px] text-[var(--shell-sidebar-muted)]">
                              Loading sessions…
                            </div>
                          ) : visibleRecentSessions.length > 0 ? (
                            visibleRecentSessions.map((session) => (
                              <RootSidebarRecentSession key={session.id} session={session} />
                            ))
                          ) : (
                            <>
                              <RootSidebarGhostLink label="No live sessions" />
                              <RootSidebarGhostLink label="Planner output pending" />
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </section>

                </div>
              ) : (
                <>
                  <div className="space-y-6">
                    <NavSection label="Control" items={CONTROL_PLANE_ITEMS} pathname={pathname} />
                    <NavSection label="Autonomous" items={AUTONOMOUS_ITEMS} pathname={pathname} />
                    <NavSection label="Operator" items={OPERATOR_ITEMS} pathname={pathname} />
                  </div>
                </>
              )}
            </div>

            {!isPlaneWorkspaceRoute ? (
              <div className="border-t border-[color:var(--shell-sidebar-border)] px-4 py-4">
                <div className="flex items-center gap-2 text-[12px] text-white/72">
                  <span className="shell-status-dot-active h-2 w-2 rounded-full" />
                  <span>
                    Local shell <span className="text-[var(--shell-sidebar-muted)]">· ready</span>
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="shell-main-column min-w-0 flex-1">
          <header className="shell-topbar sticky top-0 z-20 border-b border-[color:var(--shell-topbar-border)] bg-[color:var(--shell-topbar-bg)]/92 backdrop-blur-xl">
            <div className="shell-content-area py-3">
              <div className="shell-topbar-layout gap-3">
                <div className="min-w-0">
                  {isPlaneWorkspaceRoute ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-500/85 text-[16px] font-medium text-white">
                        I
                      </div>
                      <div className="flex items-center gap-2 text-[16px] font-medium tracking-[-0.02em] text-foreground">
                        infinity
                        <ChevronDown className="h-4 w-4 text-[var(--shell-sidebar-muted)]" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="md:hidden">
                        <div className="shell-rail-brand">
                          <PanelLeft className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-500/85 text-[16px] font-medium text-white">
                        I
                      </div>
                      <div className="min-w-0 text-[16px] font-medium tracking-[-0.02em] text-foreground">
                        {meta.eyebrow.split("/").map((part, index, parts) => (
                          <span key={`${part}-${index}`} className="inline-flex items-center gap-2">
                            <span className={index === parts.length - 1 ? "text-foreground" : "text-white/78"}>
                              {part.trim()}
                            </span>
                            {index < parts.length - 1 ? (
                              <ChevronDown className="h-4 w-4 rotate-[-90deg] text-[var(--shell-sidebar-muted)]" />
                            ) : null}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button type="button" className="shell-search-control hidden md:flex">
                  <Search className="h-3.5 w-3.5" />
                  <span className="flex-1 text-left">Search runs, tasks, agents...</span>
                  <span className="shell-search-shortcut">⌘K</span>
                </button>

                {isPlaneWorkspaceRoute ? (
                  <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                    {isRootFrontdoor ? (
                      <button type="button" className="shell-topbar-pill">
                        <Sparkles className="h-3.5 w-3.5" />
                        Get Started
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-[var(--shell-sidebar-muted)]"
                    >
                      <Bell className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-[var(--shell-sidebar-muted)]"
                    >
                      <LifeBuoy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/85 text-white"
                    >
                      <UserCircle2 className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                    {currentTopbarMode === "frontdoor" ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-[var(--muted-foreground)]"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-[var(--shell-sidebar-muted)]"
                        >
                          <Bell className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-[var(--shell-sidebar-muted)]"
                        >
                          <LifeBuoy className="h-4 w-4" />
                        </button>
                      </>
                    ) : null}
                    {currentTopbarMode === "runs" ? (
                      <Link
                        href="/"
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4 text-[13px] text-white/78"
                      >
                        <PencilLine className="h-4 w-4" />
                        New run
                        </Link>
                    ) : null}
                    {currentTopbarMode === "run" ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4 text-[13px] text-white/72"
                        >
                          <Pause className="h-4 w-4" />
                          Pause
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4 text-[13px] text-white/72"
                        >
                          <TimerReset className="h-4 w-4" />
                          Recover
                        </button>
                      </>
                    ) : null}
                    {currentTopbarMode === "delivery" ? (
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-[var(--shell-sidebar-muted)]"
                      />
                    ) : null}
                    {currentTopbarMode === "frontdoor" ? (
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/85 text-white"
                      >
                        <UserCircle2 className="h-5 w-5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-[var(--shell-sidebar-muted)]"
                      />
                    )}
                  </div>
                )}
              </div>

            </div>
          </header>

          <div className="shell-content-area">
            <div className={`shell-main-canvas ${isPlaneWorkspaceRoute ? "pt-6" : ""}`}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
