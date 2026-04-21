"use client";

import type { ReactNode } from "react";

export function PlaneWorkItemsShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#020817] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-6 py-8 lg:px-8">
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(15,23,42,0.55)_38%,rgba(15,23,42,0.88))] px-6 py-5 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/48">
                Infinity / Work items
              </div>
              <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-white">
                Live work board inside the shell
              </h1>
              <p className="max-w-3xl text-[13px] leading-6 text-white/62">
                The shell stays operator-first while the linked work-ui session remains
                the embedded workspace for execution.
              </p>
            </div>
            <div className="inline-flex items-center rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[11px] text-white/74">
              embedded workspace visible
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
