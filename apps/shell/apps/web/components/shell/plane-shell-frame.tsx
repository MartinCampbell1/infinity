"use client";

import type { ReactNode } from "react";

import { ShellFrame } from "@/components/shell/shell-frame";
import {
  PlaneShellCanvas,
  PlaneShellSurface,
} from "@/components/shell/plane-shell-primitives";

export function PlaneShellFrame({
  children,
  rightRail,
}: {
  children: ReactNode;
  rightRail?: ReactNode;
}) {
  return (
    <ShellFrame>
      <PlaneShellCanvas>
        <PlaneShellSurface rightRail={rightRail}>{children}</PlaneShellSurface>
      </PlaneShellCanvas>
    </ShellFrame>
  );
}
