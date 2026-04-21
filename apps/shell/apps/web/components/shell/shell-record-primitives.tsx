"use client";

import type * as React from "react";

import { cn } from "@founderos/ui/lib/utils";

export function ShellRecordSection({
  title,
  children,
  className,
  headerClassName,
  bodyClassName,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[12px] border border-[color:var(--shell-control-border)] bg-[color:var(--shell-control-bg)] p-4",
        className
      )}
    >
      <div
        className={cn(
          "text-sm font-medium text-foreground",
          headerClassName
        )}
      >
        {title}
      </div>
      <div className={cn("mt-3", bodyClassName)}>{children}</div>
    </section>
  );
}
