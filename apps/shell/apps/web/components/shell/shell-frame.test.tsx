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
const mockRouterPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

import { SHELL_SHORTCUT_SECTIONS, ShellFrame, ShellShortcutHelpDialog } from "./shell-frame";

describe("ShellFrame navigation", () => {
  test("uses a product-facing root breadcrumb aligned with the run control plane nav", () => {
    mockUsePathname.mockReturnValue("/");

    const markup = renderToStaticMarkup(
      <ShellFrame>
        <main>Home</main>
      </ShellFrame>,
    );

    expect(markup).toContain("Control plane / Home");
    expect(markup).toContain("New run");
    expect(markup).toContain('href="/"');
    expect(markup).toContain("Run control plane");
    expect(markup).not.toContain("Plane / Home");
  });

  test("keeps a visible frontdoor link while browsing execution routes", () => {
    mockUsePathname.mockReturnValue("/execution/approvals");

    const markup = renderToStaticMarkup(
      <ShellFrame>
        <main>Approvals board</main>
      </ShellFrame>,
    );

    expect(markup).toContain("New run");
    expect(markup).toContain('href="/"');
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

  test("renders cockpit shortcut help with route actions and accessible dialog semantics", () => {
    const markup = renderToStaticMarkup(
      <ShellShortcutHelpDialog open onClose={() => {}} />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("Keyboard shortcuts");
    expect(markup).toContain("Open run control plane");
    expect(markup).toContain("Open planner lane");
    expect(markup).toContain("Open approvals");
    expect(markup).toContain("Open validation");
    expect(markup).toContain("Start a new run");
    expect(SHELL_SHORTCUT_SECTIONS.flatMap((section) => section.items).map((item) => item.label))
      .toEqual(
        expect.arrayContaining([
          "Open keyboard help",
          "Open cockpit shortcuts",
          "Start a new run",
          "Open run control plane",
          "Open planner lane",
          "Open approvals",
          "Open validation",
        ]),
      );
  });

  test("wires the topbar search affordance to the shortcut dialog", () => {
    mockUsePathname.mockReturnValue("/execution/runs");

    const markup = renderToStaticMarkup(
      <ShellFrame>
        <main>Runs board</main>
      </ShellFrame>,
    );

    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-controls="shell-shortcuts-dialog"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("Search runs, tasks, agents...");
    expect(markup).toContain("⌘K");
  });
});
