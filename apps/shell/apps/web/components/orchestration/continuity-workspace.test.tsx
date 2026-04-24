import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { BROWSER_E2E_BLOCKED_RUN_CONTINUITY } from "../../lib/server/orchestration/fixtures/browser-e2e-blocked-run";

import { ContinuityWorkspace } from "./continuity-workspace";

describe("ContinuityWorkspace", () => {
  test("shows the browser E2E blocked-run fixture as blocked verification without a delivery link", () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;

    const markup = renderToStaticMarkup(
      <ContinuityWorkspace continuity={BROWSER_E2E_BLOCKED_RUN_CONTINUITY} />,
    );

    expect(markup).toContain("Tiny tip calculator");
    expect(markup).toContain("Delivery blocked");
    expect(markup).toContain("targeted_tests_passed");
    expect(markup).toContain(
      "npm run test:orchestration-readiness --workspace @founderos/web",
    );
    expect(markup).toContain("Cwd: /Users/martin/infinity/apps/shell");
    expect(markup).toContain("delivery remains null");
    expect(markup).not.toContain("/execution/delivery/");
  });
});
