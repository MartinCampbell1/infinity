import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/execution/plane-run-primitives", () => ({
  PlaneButton: ({
    children,
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
    icon?: React.ReactNode;
  }) => <button type="button">{children}</button>,
  PlaneDisabledAction: ({
    label,
    reason,
    children,
  }: {
    label: string;
    reason: string;
    children: React.ReactNode;
  }) => (
    <span data-disabled-action={label} data-disabled-action-reason={reason}>
      <button type="button" disabled>
        {children}
      </button>
    </span>
  ),
  PlaneIconButton: ({
    children,
    disabled,
    title,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    title?: string;
  }) => (
    <button type="button" disabled={disabled} title={title}>
      {children}
    </button>
  ),
  PlaneProgressBar: () => <div data-progress-bar="true" />,
  PlaneStatusPill: ({
    children,
    status,
  }: {
    children: React.ReactNode;
    status?: string | null;
  }) => <span data-status={status ?? ""}>{children}</span>,
}));

import { AutonomousRecordBoard } from "./autonomous-record-board";

describe("AutonomousRecordBoard", () => {
  test("renders missing run routes and sidebar actions as disabled with reasons", () => {
    const markup = renderToStaticMarkup(
      <AutonomousRecordBoard
        eyebrow="Execution"
        title="Runs"
        description="Operator run board."
        emptyTitle="No runs"
        emptyDescription="No runs yet."
        headerAction={<span>Header action</span>}
        items={[
          {
            id: "run-linked-001",
            title: "Linked run",
            prompt: "Build a linked run.",
            stage: "running",
            health: "healthy",
            preview: "pending",
            handoff: "none",
            updated: "10:00",
            tasks: "1 / 2",
            agent: "codex",
            href: "/execution/continuity/initiative-linked-001",
            featured: true,
          },
          {
            id: "run-readonly-001",
            title: "Read-only run",
            prompt: "This run has no route yet.",
            stage: "blocked",
            health: "blocked",
            preview: "none",
            handoff: "none",
            updated: "10:05",
            tasks: "0 / 2",
            agent: "codex",
            href: null,
            group: "attention",
          },
        ]}
      />,
    );

    expect(markup).toContain('href="/execution/continuity/initiative-linked-001"');
    expect(markup).not.toContain('href="#"');
    expect(markup).toContain('data-disabled-action="Open run"');
    expect(markup).toContain("Open run requires a concrete execution route");
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("Drawer close is disabled in this server-rendered board.");
    expect(markup).toContain('data-disabled-action="Preview"');
    expect(markup).toContain("Preview requires a concrete preview route");
    expect(markup).toContain('data-disabled-action="Logs"');
    expect(markup).toContain("Logs require a concrete run log route");
  });
});
