import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.stubGlobal("React", React);

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

const mockUsePathname = vi.fn(() => "/execution/approvals");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

import { ShellFrame } from "./shell-frame";

describe("ShellFrame navigation", () => {
  test("uses a product-facing root breadcrumb aligned with the run control plane nav", () => {
    mockUsePathname.mockReturnValue("/");

    const markup = renderToStaticMarkup(
      <ShellFrame>
        <main>Home</main>
      </ShellFrame>,
    );

    expect(markup).toContain("Control plane / Home");
    expect(markup).toContain("Run control plane");
    expect(markup).not.toContain("Plane / Home");
  });

  test("does not render static sidebar counters that can contradict durable control-plane state", () => {
    mockUsePathname.mockReturnValue("/execution/approvals");

    const markup = renderToStaticMarkup(
      <ShellFrame>
        <main>Approvals board</main>
      </ShellFrame>,
    );

    expect(markup).toContain('href="/execution/approvals"');
    const staleCounters: Array<[string, string]> = [
      ["/execution/runs", "14"],
      ["/execution/tasks", "28"],
      ["/execution/agents", "6"],
      ["/execution/recoveries", "2"],
      ["/execution/approvals", "1"],
    ];

    for (const [href, staleCount] of staleCounters) {
      expect(markup).not.toMatch(
        new RegExp(
          `href="${href.replace("/", "\\/")}"[\\s\\S]*?<span[^>]*>\\s*${staleCount}\\s*<\\/span>`,
        ),
      );
    }
    expect(markup).not.toMatch(
      /href="\/execution\/approvals"[\s\S]*?<span[^>]*>\s*1\s*<\/span>/,
    );
  });
});
