"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ChevronDown, Mic, Plus } from "lucide-react";

import {
  buildExecutionRunScopeHref,
  type ShellRouteScope,
} from "@/lib/route-scope";
import { buildInitiativeCreateRequest } from "./plane-root-composer-logic";

const SUGGESTED_PROMPTS = [
  "Continue the current initiative, surface blockers, and tell me what needs operator attention next.",
  "Build the requested product, verify it locally, and include the runnable launch command plus handoff proof.",
  "Audit the embedded workspace route, remove duplicate shell chrome, and keep the chat canvas central.",
];

export function PlaneRootComposer({
  routeScope,
}: {
  routeScope?: ShellRouteScope;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [requestedBy, setRequestedBy] = useState("martin");
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
          buildInitiativeCreateRequest(normalizedPrompt, requestedBy, routeScope)
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

      const briefResponse = await fetch("/api/control/orchestration/briefs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          initiativeId: initiativePayload.initiative.id,
          summary: normalizedPrompt,
          goals: [],
          nonGoals: [],
          constraints: [],
          assumptions: [],
          acceptanceCriteria: [],
          repoScope: [],
          deliverables: [],
          clarificationLog: [],
          authoredBy: "hermes-intake",
          status: "clarifying",
        }),
      });

      if (!briefResponse.ok) {
        const payload = (await briefResponse.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(payload?.detail ?? "Brief creation failed.");
      }

      router.push(
        buildExecutionRunScopeHref(initiativePayload.initiative.id, routeScope)
      );
    } catch (error) {
      setPendingMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "Run creation failed.");
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
        <div className="rounded-[20px] border border-white/10 bg-black/14 px-4 py-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/18 bg-sky-500/10 px-3 py-1 text-[12px] font-medium text-sky-100">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/90 text-[13px] text-white">
              I
            </span>
            Infinity
          </div>

          <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/44">
            Start an autonomous run
          </div>
          <textarea
            className="mt-3 min-h-[168px] w-full resize-none bg-transparent text-[18px] leading-8 text-white outline-none placeholder:text-white/30"
            placeholder="How can Infinity help you today?"
            value={prompt}
            onChange={(event) => setPrompt(event.currentTarget.value)}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/5 text-white/72 transition hover:bg-white/8"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-[14px] border border-white/10 bg-white/5 px-4 text-[13px] text-white/88 transition hover:bg-white/8"
              >
                Ask
                <ChevronDown className="h-4 w-4 text-white/44" />
              </button>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/5 text-white/34"
                disabled
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/56">
                requested by
                <input
                  className="w-24 bg-transparent text-right text-white outline-none"
                  value={requestedBy}
                  onChange={(event) => setRequestedBy(event.currentTarget.value)}
                />
              </label>
              <button
                type="button"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-sky-500 px-5 text-[14px] font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!normalizedPrompt || isPending}
                onClick={() => void submitPrompt()}
              >
                {isPending ? "Starting..." : "Start run"}
                {!isPending ? <ArrowUp className="h-4 w-4" /> : null}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-[12px] text-white/48">
          <div>Infinity keeps the autonomous path shell-owned from spec through delivery.</div>
          <div>Plane AI can make mistakes, please double-check responses.</div>
        </div>
      </div>

      <div className="space-y-2 px-1">
        {SUGGESTED_PROMPTS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="block text-left text-[13px] text-white/62 transition hover:text-white"
            onClick={() => setPrompt(suggestion)}
          >
            {suggestion}
          </button>
        ))}
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
