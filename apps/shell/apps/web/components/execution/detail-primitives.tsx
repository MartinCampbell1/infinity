import React from "react";
import Link from "next/link";
import type { ReactNode } from "react";

function titleCase(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ExecutionDetailPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-white/42">{eyebrow}</div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">{title}</h1>
          <p className="max-w-3xl text-sm leading-6 text-white/58">{description}</p>
        </div>
      </header>
      {children}
    </main>
  );
}

export function ExecutionDetailEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-3xl font-semibold text-white">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-white/58">{description}</p>
    </main>
  );
}

export function ExecutionDetailMetricGrid({
  children,
}: {
  children: ReactNode;
}) {
  return <section className="grid gap-4 md:grid-cols-3">{children}</section>;
}

export function ExecutionDetailMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-white/42">{label}</div>
      <div className="mt-2 text-sm text-white">{value}</div>
      {detail ? <div className="mt-2 text-xs leading-5 text-white/48">{detail}</div> : null}
    </div>
  );
}

export function ExecutionDetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="text-xs uppercase tracking-[0.16em] text-white/42">{title}</div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ExecutionDetailKeyValueGrid({
  items,
  columns = "md:grid-cols-2",
}: {
  items: Array<{
    label: string;
    value: ReactNode;
  }>;
  columns?: string;
}) {
  return (
    <dl className={`grid gap-4 ${columns}`}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs uppercase tracking-[0.14em] text-white/42">{item.label}</dt>
          <dd className="mt-1 break-all text-sm leading-6 text-white/78">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ExecutionDetailList({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="space-y-3">{children}</div>;
}

export function ExecutionDetailListItem({
  title,
  detail,
  meta,
  action,
}: {
  title: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">{title}</div>
          {detail ? <div className="mt-1 text-xs leading-6 text-white/58">{detail}</div> : null}
          {meta ? <div className="mt-2 text-xs leading-5 text-white/42">{meta}</div> : null}
        </div>
        {action}
      </div>
    </div>
  );
}

export function ExecutionDetailActionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-sm text-white/78 transition hover:bg-white/[0.06]"
    >
      {children}
    </Link>
  );
}

export function ExecutionDetailStatusPill({
  value,
}: {
  value: string | null | undefined;
}) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-white/72">
      {titleCase(value)}
    </span>
  );
}
