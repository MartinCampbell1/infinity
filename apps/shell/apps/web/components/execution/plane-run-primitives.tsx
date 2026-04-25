import { cn } from "@founderos/ui/lib/utils";
import React from "react";
import type { ReactNode } from "react";

const PLANE_STATUS_STYLES = {
  running: {
    background: "var(--status-running-bg)",
    border: "var(--status-running-border)",
    color: "var(--status-running-fg)",
  },
  completed: {
    background: "var(--status-running-bg)",
    border: "var(--status-running-border)",
    color: "var(--status-running-fg)",
  },
  ready: {
    background: "var(--status-running-bg)",
    border: "var(--status-running-border)",
    color: "var(--status-running-fg)",
  },
  delivered: {
    background: "var(--status-running-bg)",
    border: "var(--status-running-border)",
    color: "var(--status-running-fg)",
  },
  planning: {
    background: "var(--status-planning-bg)",
    border: "var(--status-planning-border)",
    color: "var(--status-planning-fg)",
  },
  starting: {
    background: "var(--status-planning-bg)",
    border: "var(--status-planning-border)",
    color: "var(--status-planning-fg)",
  },
  clarifying: {
    background: "var(--status-planning-bg)",
    border: "var(--status-planning-border)",
    color: "var(--status-planning-fg)",
  },
  verifying: {
    background: "var(--status-planning-bg)",
    border: "var(--status-planning-border)",
    color: "var(--status-planning-fg)",
  },
  building: {
    background: "var(--status-planning-bg)",
    border: "var(--status-planning-border)",
    color: "var(--status-planning-fg)",
  },
  pending: {
    background: "var(--status-pending-bg)",
    border: "var(--status-pending-border)",
    color: "var(--status-pending-fg)",
  },
  retryable: {
    background: "var(--status-pending-bg)",
    border: "var(--status-pending-border)",
    color: "var(--status-pending-fg)",
  },
  blocked: {
    background: "var(--status-pending-bg)",
    border: "var(--status-pending-border)",
    color: "var(--status-pending-fg)",
  },
  failed: {
    background: "var(--status-failed-bg)",
    border: "var(--status-failed-border)",
    color: "var(--status-failed-fg)",
  },
  cancelled: {
    background: "var(--status-failed-bg)",
    border: "var(--status-failed-border)",
    color: "var(--status-failed-fg)",
  },
  neutral: {
    background: "var(--status-neutral-bg)",
    border: "var(--status-neutral-border)",
    color: "var(--status-neutral-fg)",
  },
} as const satisfies Record<string, { background: string; border: string; color: string }>;

export function PlaneStatusPill({
  status = "neutral",
  children,
  mono = false,
  size = "md",
  className,
}: {
  status?: string | null;
  children?: ReactNode;
  mono?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const resolved = status ? status.toLowerCase() : "neutral";
  const style = PLANE_STATUS_STYLES[resolved as keyof typeof PLANE_STATUS_STYLES] ?? PLANE_STATUS_STYLES.neutral;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border", className)}
      style={{
        background: style.background,
        borderColor: style.border,
        color: style.color,
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        fontSize: size === "sm" ? 10 : 11,
        fontWeight: mono ? 400 : 500,
        letterSpacing: mono ? "0.02em" : "0",
        padding: size === "sm" ? "3px 8px" : "4px 10px",
        textTransform: mono ? "lowercase" : "none",
        whiteSpace: "nowrap",
      }}
    >
      {children ?? resolved}
    </span>
  );
}

export function PlaneKbd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("ids-kbd", className)}>{children}</span>;
}

export function PlaneProgressBar({
  value,
  total,
  color = "var(--status-planning)",
  className,
}: {
  value: number;
  total: number;
  color?: string;
  className?: string;
}) {
  const percent = Math.min(100, Math.max(0, (value / Math.max(total, 1)) * 100));

  return (
    <div
      className={cn("overflow-hidden rounded-full bg-white/[0.06]", className)}
      style={{ height: 3 }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: "100%",
          background: color,
          transition: "width var(--transition-fade)",
        }}
      />
    </div>
  );
}

export function PlaneButton({
  variant = "ghost",
  size = "md",
  children,
  icon,
  disabled = false,
  className,
  onClick,
}: {
  variant?: "primary" | "ghost" | "subtle" | "topbar";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const sizeClass =
    size === "sm"
      ? "h-[26px] px-[10px] text-[11px]"
      : size === "lg"
        ? "h-[38px] px-[18px] text-[13px]"
        : "h-[32px] px-[14px] text-[12px]";
  const variantClass =
    variant === "primary"
      ? "border-[color:var(--shell-nav-active-border)] bg-[rgba(133,169,255,0.14)] text-[#dfe8ff]"
      : variant === "subtle"
        ? "border-transparent bg-transparent text-[var(--muted-foreground)]"
        : variant === "topbar"
          ? "border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] text-[var(--muted-foreground)]"
          : "border-[color:var(--shell-control-border)] bg-[rgba(255,255,255,0.03)] text-white/82";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        sizeClass,
        variantClass,
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function PlaneDisabledAction({
  label,
  reason,
  variant = "subtle",
  size = "sm",
  children,
  className,
}: {
  label: string;
  reason: string;
  variant?: "primary" | "ghost" | "subtle" | "topbar";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className="inline-flex"
      title={reason}
      data-disabled-action={label}
      data-disabled-action-reason={reason}
    >
      <PlaneButton
        variant={variant}
        size={size}
        disabled
        className={className}
      >
        {children}
      </PlaneButton>
    </span>
  );
}

export function PlaneIconButton({
  children,
  active = false,
  size = 36,
  className,
  disabled = false,
  title,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  size?: number;
  className?: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center rounded-[14px] border border-[color:var(--shell-control-border)] text-[var(--shell-sidebar-muted)] transition disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      style={{
        width: size,
        height: size,
        background: active ? "var(--shell-control-hover)" : "var(--shell-control-bg)",
        color: active ? "var(--foreground)" : "var(--shell-sidebar-muted)",
      }}
    >
      {children}
    </button>
  );
}

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
