import { cn } from "@founderos/ui/lib/utils";
import type { ReactNode } from "react";

export function PlaneShellCanvas({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex w-full max-w-[1680px] flex-col gap-6", className)}>
      {children}
    </div>
  );
}

export function PlaneShellPageHeader({
  eyebrow,
  title,
  detail,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-5 md:flex-row md:items-start md:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/46">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-white">
          {title}
        </h2>
        {detail ? <p className="mt-2 max-w-3xl text-[13px] leading-6 text-white/64">{detail}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PlaneShellStatTile({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.16)]",
        className
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/46">{label}</div>
      <div className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-white">{value}</div>
      {detail ? <div className="mt-2 text-[12px] leading-5 text-white/58">{detail}</div> : null}
    </div>
  );
}

export function PlaneShellChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white/78",
        className
      )}
    >
      {children}
    </span>
  );
}

export function PlaneShellBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-100",
        className
      )}
    >
      {children}
    </span>
  );
}

export function PlaneShellSurface({
  children,
  rightRail,
  className,
}: {
  children: ReactNode;
  rightRail?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]", className)}>
      <div className="min-w-0">{children}</div>
      {rightRail ? <aside className="hidden xl:block">{rightRail}</aside> : null}
    </div>
  );
}

export function PlaneShellRail({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}

export function PlaneShellRailModule({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-4",
        className
      )}
    >
      {children}
    </section>
  );
}

export function PlaneShellSectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0)),#111827] px-6 py-6 shadow-[0_18px_48px_rgba(15,23,42,0.22)]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function PlaneShellEmptyState({
  title,
  detail,
  className,
}: {
  title: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-4",
        className
      )}
    >
      <div className="text-[13px] font-medium text-white/88">{title}</div>
      {detail ? <div className="mt-1 text-[12px] leading-5 text-white/56">{detail}</div> : null}
    </div>
  );
}

export function PlaneShellLoadingSkeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("animate-pulse rounded-[18px] bg-white/[0.06]", className)} aria-hidden="true" />;
}
