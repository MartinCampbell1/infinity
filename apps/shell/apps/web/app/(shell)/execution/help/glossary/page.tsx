import React from "react";
import Link from "next/link";

const glossaryTerms = [
  {
    term: "Run",
    definition:
      "The top-level operator request moving from New run through planning, execution, validation, recovery, and delivery.",
    useFor: "Use it for the whole goal, not for one worker retry or one planner task.",
  },
  {
    term: "Task",
    definition:
      "A bounded unit of work derived from the run, usually owned by a worker and backed by acceptance criteria.",
    useFor: "Use it for planner output, work-item ownership, and dependency tracking.",
  },
  {
    term: "Attempt",
    definition:
      "One execution try for a task or recovery action. A task can have multiple attempts.",
    useFor: "Use it for retry history, executor state, failure reasons, and account/model attribution.",
  },
  {
    term: "Delivery",
    definition:
      "The operator-facing result record connecting finished work to preview, manifest, verification, and handoff evidence.",
    useFor: "Use it when deciding whether a result is local-only, staging-ready, or production-ready.",
  },
] as const;

const relatedTerms = [
  "Brief",
  "Task graph",
  "Batch",
  "Work unit",
  "Verification",
  "Recovery",
] as const;

export default function ExecutionGlossaryPage() {
  return (
    <main className="space-y-6">
      <section className="rounded-[16px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-surface-elevated)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
          Operator help
        </div>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-foreground">
          Run, task, attempt, delivery
        </h1>
        <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[var(--shell-sidebar-muted)]">
          These terms keep the shell, workspace, handoffs, and recovery notes aligned. A delivery is not
          production-ready unless its proof matches the target environment.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/execution/runs"
            className="rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2 text-[12px] font-medium text-foreground transition hover:bg-[color:var(--shell-control-hover)]"
          >
            Open runs
          </Link>
          <Link
            href="/execution/deliveries"
            className="rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2 text-[12px] font-medium text-foreground transition hover:bg-[color:var(--shell-control-hover)]"
          >
            Open deliveries
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {glossaryTerms.map((item) => (
          <article
            key={item.term}
            className="rounded-[14px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4"
          >
            <h2 className="text-[16px] font-semibold text-foreground">{item.term}</h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--shell-sidebar-muted)]">
              {item.definition}
            </p>
            <p className="mt-3 rounded-[10px] border border-[color:var(--shell-control-border)] bg-black/20 px-3 py-2 text-[12px] leading-5 text-white/78">
              {item.useFor}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-[14px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
        <h2 className="text-[15px] font-semibold text-foreground">Related terms</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {relatedTerms.map((term) => (
            <span
              key={term}
              className="rounded-full border border-[color:var(--shell-control-border)] bg-black/20 px-3 py-1 text-[12px] text-[var(--shell-sidebar-muted)]"
            >
              {term}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12px] leading-5 text-[var(--shell-sidebar-muted)]">
          The Markdown source for this operator glossary lives in <code>docs/operator-glossary.md</code>.
        </p>
      </section>
    </main>
  );
}
