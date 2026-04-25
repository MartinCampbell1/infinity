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

import { ExecutionRouteErrorBoundary } from "./execution-route-error-boundary";

describe("ExecutionRouteErrorBoundary", () => {
  test("keeps execution failures recoverable with retry and diagnostic links", () => {
    const error = new Error("Run detail projection failed.") as Error & {
      digest?: string;
    };
    error.digest = "digest-123";

    const markup = renderToStaticMarkup(
      <ExecutionRouteErrorBoundary error={error} reset={vi.fn()} />,
    );

    expect(markup).toContain('data-execution-error-boundary="true"');
    expect(markup).toContain('data-execution-error-reset="true"');
    expect(markup).toContain("Retry surface");
    expect(markup).toContain("Run detail projection failed.");
    expect(markup).toContain("digest digest-123");
    expect(markup).toContain('href="/execution/recoveries"');
    expect(markup).toContain("Open recoveries");
    expect(markup).toContain('href="/execution/events"');
    expect(markup).toContain("Open event logs");
  });
});
