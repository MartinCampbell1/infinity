import Link from "next/link";

import {
  type ShellRouteScope,
} from "@/lib/route-scope";
import { PlaneRootComposer } from "@/components/frontdoor/plane-root-composer";
import type { ExecutionKernelAvailability } from "@/lib/server/orchestration/batches";
import type { FrontdoorRecentRunCard } from "@/lib/server/orchestration/claude-design-presentation";

const FRONTDOOR_SUGGESTIONS = [
  {
    eyebrow: "Scaffold",
    prompt:
      "Build a habit tracker with streaks, weekly insights, and push notifications. Next.js, Supabase, Postgres. Ship to Vercel preview.",
  },
  {
    eyebrow: "Feature",
    prompt: "Add a keyboard-driven recovery review surface to the existing shell.",
  },
  {
    eyebrow: "Refactor",
    prompt: "Migrate the runtime board from polling to Postgres LISTEN/NOTIFY.",
  },
] as const;

function sessionAccent(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "ready" || normalized === "recovered") {
    return "bg-emerald-400 shadow-[0_0_8px_rgba(73,209,141,0.45)]";
  }
  if (normalized === "acting" || normalized === "planning" || normalized === "starting" || normalized === "validating" || normalized === "running" || normalized === "verifying") {
    return "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.5)]";
  }
  if (normalized === "blocked" || normalized === "failed" || normalized === "waiting_for_approval") {
    return "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.45)]";
  }
  return "bg-white/30";
}

export function PlaneAiHomeSurface({
  recentRuns,
  routeScope,
}: {
  recentRuns: FrontdoorRecentRunCard[];
  routeScope?: ShellRouteScope;
  kernelAvailability: ExecutionKernelAvailability;
}) {
  return (
    <main className="mx-auto flex max-w-[1240px] flex-col px-4 pb-10 pt-12 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col">
        <div className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/44">
          Infinity · Frontdoor
        </div>
        <h1 className="mt-3 text-center text-[34px] font-semibold tracking-[-0.05em] text-white sm:text-[44px]">
          What should the system build?
        </h1>
        <p className="mx-auto mt-4 max-w-[620px] text-center text-[15px] leading-8 text-white/56">
          One prompt. The system clarifies, plans, orchestrates agents, recovers, and delivers a
          localhost-ready result.
        </p>

        <div className="mt-8">
          <PlaneRootComposer routeScope={routeScope ?? undefined} />
        </div>
      </div>

      <div className="mx-auto mt-8 grid w-full max-w-[1160px] gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shell-sidebar-muted)]">
              Suggested prompts
            </div>
            <span className="text-[11px] text-white/34">shell-owned intake</span>
          </div>

          <div className="space-y-3">
            {FRONTDOOR_SUGGESTIONS.map((suggestion) => (
              <div
                key={suggestion.eyebrow}
                className="rounded-[16px] border border-white/8 bg-white/[0.02] px-4 py-4"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
                  {suggestion.eyebrow}
                </div>
                <div className="mt-2 text-[13px] leading-6 text-white/86">{suggestion.prompt}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--shell-sidebar-muted)]">
              Recent runs
            </div>
            <span className="font-mono text-[11px] text-[var(--shell-sidebar-muted)]">
              {recentRuns.length}
            </span>
          </div>

          <div className="space-y-1 rounded-[16px] border border-white/8 bg-white/[0.02] p-3">
            {recentRuns.length > 0 ? (
              recentRuns.map((session) => (
                <Link
                  key={session.id}
                  href={session.href}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[10px] px-3 py-2.5 transition hover:bg-white/[0.035]"
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${sessionAccent(session.status)}`} />
                    <span className="font-mono text-[11px] text-[var(--shell-sidebar-muted)]">
                      {session.id}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-white/88">{session.title}</span>
                  <span className="text-[10.5px] text-[var(--shell-sidebar-muted)]">
                    {session.updatedLabel}
                  </span>
                </Link>
              ))
            ) : (
              <div className="px-3 py-2 text-[12px] text-white/48">
                No shell-visible runs yet.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-10 inline-flex w-full items-center justify-center gap-3 text-center text-[11px] text-[var(--shell-sidebar-muted)]">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(73,209,141,0.45)]" />
        <span>Local shell ready · 6 agents registered · recovery policy autopilot</span>
      </div>
    </main>
  );
}
