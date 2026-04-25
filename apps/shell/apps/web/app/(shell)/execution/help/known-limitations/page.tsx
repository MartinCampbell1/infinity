import React from "react";
import Link from "next/link";

const limitationGroups = [
  {
    title: "Local limitations",
    items: [
      "Local runnable proof is not a production release claim.",
      "localhost, file://, /tmp, and /Users paths cannot be hosted delivery evidence.",
      "Validation packets are local evidence, not source files.",
      "Browser product E2E proof is required for user-facing idea-to-result claims.",
    ],
  },
  {
    title: "Staging limitations",
    items: [
      "Staging needs explicit rollout env, not localhost with staging wording.",
      "Shell and work-ui must be separate non-local HTTPS origins.",
      "The execution kernel must remain private.",
      "External delivery smoke must pass with real provider and signed-artifact evidence.",
    ],
  },
  {
    title: "Production limitations",
    items: [
      "Production wording requires strict rollout env, production readiness tier, and external proof.",
      "Production promotion still depends on ready staging topology and least-privilege credentials.",
      "API-key capacity must not be described as remaining ChatGPT quota.",
      "Local file paths or scratch paths invalidate hosted artifact evidence.",
    ],
  },
] as const;

export default function KnownLimitationsPage() {
  return (
    <main className="space-y-6">
      <section className="rounded-[16px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-surface-elevated)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-sidebar-muted)]">
          Operator help
        </div>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-foreground">
          Known limitations
        </h1>
        <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-[var(--shell-sidebar-muted)]">
          Use the lowest proven tier when evidence is mixed. A green local run is useful, but it is not a
          hosted production release claim.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/execution/validation"
            className="rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2 text-[12px] font-medium text-foreground transition hover:bg-[color:var(--shell-control-hover)]"
          >
            Open validation
          </Link>
          <Link
            href="/execution/deliveries"
            className="rounded-[10px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] px-3 py-2 text-[12px] font-medium text-foreground transition hover:bg-[color:var(--shell-control-hover)]"
          >
            Open deliveries
          </Link>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {limitationGroups.map((group) => (
          <article
            key={group.title}
            className="rounded-[14px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4"
          >
            <h2 className="text-[16px] font-semibold text-foreground">{group.title}</h2>
            <ul className="mt-3 space-y-2 text-[13px] leading-6 text-[var(--shell-sidebar-muted)]">
              {group.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--primary)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-[14px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4">
        <h2 className="text-[15px] font-semibold text-foreground">Source documents</h2>
        <p className="mt-2 text-[12px] leading-5 text-[var(--shell-sidebar-muted)]">
          The Markdown source lives in <code>docs/known-limitations.md</code> and should stay aligned with
          <code> docs/production-readiness.md</code>, <code> docs/ops/staging-topology.md</code>, and
          <code> docs/validation/README.md</code>.
        </p>
      </section>
    </main>
  );
}
