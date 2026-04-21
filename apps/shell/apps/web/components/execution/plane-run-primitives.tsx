import { cn } from "@founderos/ui/lib/utils";
import type { ReactNode } from "react";

export function PlaneRunHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-2", className)}>
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/42">{eyebrow}</div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-white">{title}</h1>
          <p className="max-w-3xl text-[13px] leading-5 text-white/58">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function PlaneRunMetricTile({
  label,
  value,
  detail,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  detail: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4", className)}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">{label}</div>
      <div className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-white">{value}</div>
      <div className="mt-1 text-[11px] leading-5 text-white/56">{detail}</div>
    </div>
  );
}

export function PlaneRunModule({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03] px-5 py-5", className)}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/42">{title}</div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PlaneRunPillLink({
  href,
  children,
  active = false,
}: {
  href: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <a
      className={
        active
          ? "inline-flex items-center rounded-full bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-foreground"
          : "inline-flex items-center rounded-full border border-white/10 bg-white/6 px-3.5 py-2 text-[12px] font-medium text-white/82"
      }
      href={href}
    >
      {children}
    </a>
  );
}
