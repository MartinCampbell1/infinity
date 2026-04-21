"use client";

import type { ReactNode } from "react";

import { PlaneShellFrame } from "@/components/shell/plane-shell-frame";

export function PlaneAiShell({ children }: { children: ReactNode }) {
  return <PlaneShellFrame>{children}</PlaneShellFrame>;
}
