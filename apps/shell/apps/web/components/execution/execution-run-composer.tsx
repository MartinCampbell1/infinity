"use client";

import { useMemo, useState } from "react";

import {
  buildExecutionRunScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { buildAutonomousBriefCreateRequest } from "@/components/frontdoor/plane-root-composer-logic";

function deriveTitleFromPrompt(prompt: string) {
  const normalized = prompt.trim().split("\n")[0]?.trim() ?? "";
  if (!normalized) {
    return "Untitled autonomous run";
  }

  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

export function ExecutionRunComposer({
  routeScope,
  compact = false,
}: {
  routeScope?: ShellRouteScope;
  compact?: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [requestedBy, setRequestedBy] = useState("martin");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const normalizedPrompt = useMemo(() => prompt.trim(), [prompt]);

  async function handleSubmit() {
    if (!normalizedPrompt || pending) {
      return;
    }

    setPending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const initiativeResponse = await fetch("/api/control/orchestration/initiatives", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: deriveTitleFromPrompt(normalizedPrompt),
          userRequest: normalizedPrompt,
          requestedBy: requestedBy.trim() || "martin",
          workspaceSessionId: routeScope?.sessionId ?? null,
        }),
      });
      if (!initiativeResponse.ok) {
        const payload = (await initiativeResponse.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(payload?.detail ?? "Initiative creation failed.");
      }
      const initiativePayload = (await initiativeResponse.json()) as {
        initiative: { id: string };
      };
      const initiativeId = initiativePayload.initiative.id;
      const briefRequest = fetch("/api/control/orchestration/briefs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(buildAutonomousBriefCreateRequest(initiativeId, normalizedPrompt)),
        keepalive: true,
      }).then(async (briefResponse) => {
        if (briefResponse.ok) {
          return;
        }

        const payload = (await briefResponse.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(payload?.detail ?? "Brief creation failed.");
      });

      setStatusMessage("Autonomous run started. Redirecting to the primary run surface...");
      void briefRequest.catch((error) => {
        console.error("Autonomous brief bootstrap failed", {
          initiativeId,
          error,
        });
      });
      window.location.assign(
        buildExecutionRunScopeHref(initiativeId, routeScope)
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Run creation failed.");
      setPending(false);
    }
  }

  return (
    <section className="shell-surface-card px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            One Prompt
          </div>
          <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-foreground">
            Start an autonomous run
          </h2>
          <p className="max-w-3xl text-[13px] leading-5 text-muted-foreground">
            The shell creates the initiative, authors the first brief, and lets the autonomous
            loop progress from spec through preview and handoff without required stage clicks.
          </p>
        </div>
        <div className="rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5 text-[11px] text-muted-foreground">
          happy path = shell first
        </div>
      </div>

      <div className={`mt-4 grid gap-4 ${compact ? "" : "xl:grid-cols-[minmax(0,1fr)_220px]"}`}>
        <label className="grid gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Prompt
          </span>
          <textarea
            className="min-h-[180px] rounded-[22px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-surface-card)] px-4 py-3 text-[14px] leading-7 text-foreground outline-none transition focus:border-foreground/30"
            placeholder="Describe the software you want Infinity to build, fix, or verify."
            value={prompt}
            onChange={(event) => setPrompt(event.currentTarget.value)}
          />
        </label>

        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Requested by
            </span>
            <input
              className="rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-surface-card)] px-4 py-3 text-[13px] text-foreground outline-none transition focus:border-foreground/30"
              value={requestedBy}
              onChange={(event) => setRequestedBy(event.currentTarget.value)}
            />
          </label>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-3 text-[13px] font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending || normalizedPrompt.length === 0}
            onClick={() => void handleSubmit()}
          >
            {pending ? "Starting..." : "Start run"}
          </button>

          <div className="rounded-2xl border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-4 py-4 text-[12px] leading-6 text-muted-foreground">
            Use the workspace routes only for review, recovery, or host-scoped follow-up after the
            run already exists.
          </div>
        </div>
      </div>

      {statusMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-200/60 bg-emerald-50/80 px-4 py-3 text-[12px] text-emerald-700">
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-rose-200/60 bg-rose-50/80 px-4 py-3 text-[12px] text-rose-700">
          {errorMessage}
        </div>
      ) : null}
    </section>
  );
}
