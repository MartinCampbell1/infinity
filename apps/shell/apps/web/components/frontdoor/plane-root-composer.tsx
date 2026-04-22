"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, GitBranch, Bot } from "lucide-react";

import {
  buildExecutionRunScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import {
  buildAutonomousBriefCreateRequest,
  buildInitiativeCreateRequest,
} from "./plane-root-composer-logic";
import {
  PlaneButton,
  PlaneKbd,
} from "@/components/execution/plane-run-primitives";

const DEFAULT_FRONTDOOR_PROMPT =
  "";

export function PlaneRootComposer({
  routeScope,
}: {
  routeScope?: ShellRouteScope;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(DEFAULT_FRONTDOOR_PROMPT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const normalizedPrompt = prompt.trim();

  async function submitPrompt() {
    if (!normalizedPrompt || isPending) {
      return;
    }

    setIsPending(true);
    setErrorMessage(null);
    setPendingMessage("Autonomous run is being prepared...");

    try {
      const initiativeResponse = await fetch("/api/control/orchestration/initiatives", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(
          buildInitiativeCreateRequest(normalizedPrompt, "operator", routeScope)
        ),
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
      const briefResponse = await fetch("/api/control/orchestration/briefs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(buildAutonomousBriefCreateRequest(initiativeId, normalizedPrompt)),
      });
      if (!briefResponse.ok) {
        const payload = (await briefResponse.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(payload?.detail ?? "Brief creation failed.");
      }

      setPendingMessage("Autonomous run started. Opening the primary run surface...");

      router.push(buildExecutionRunScopeHref(initiativeId, routeScope));
    } catch (error) {
      setPendingMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "Run creation failed.");
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-white/8 bg-[rgba(20,20,20,0.98)] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-sky-400/35 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_6px_rgba(133,169,255,0.05)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/42">
          Start an autonomous run
        </div>
        <div className="mt-3">
          <textarea
            className="min-h-[112px] w-full resize-none bg-transparent text-[15px] leading-8 text-white outline-none placeholder:text-white/32"
            placeholder="Describe the outcome. Tools, constraints, and target environment optional."
            value={prompt}
            onChange={(event) => setPrompt(event.currentTarget.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && normalizedPrompt && !isPending) {
                event.preventDefault();
                void submitPrompt();
              }
            }}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/6 pt-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5 text-[11px] text-[var(--muted-foreground)]">
              <GitBranch className="h-3 w-3" />
              scope: web
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5 text-[11px] text-[var(--muted-foreground)]">
              <Bot className="h-3 w-3" />
              planner · implementer
            </span>
            <span className="inline-flex items-center rounded-full border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-1.5 text-[11px] text-[var(--muted-foreground)]">
              attempts: 3
            </span>
            <div className="flex-1" />
            <span className="text-[12px] text-white/42">Attach spec</span>
            <PlaneButton
              variant="primary"
              size="sm"
              icon={<ArrowUp className="h-3.5 w-3.5" />}
              disabled={!normalizedPrompt || isPending}
              onClick={() => void submitPrompt()}
            >
              {isPending ? "Starting..." : "Start run"}
              <PlaneKbd>⌘⏎</PlaneKbd>
            </PlaneButton>
          </div>
        </div>
      </div>

      {pendingMessage ? (
        <div className="rounded-[18px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[12px] text-emerald-200">
          {pendingMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-[18px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-200">
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}
