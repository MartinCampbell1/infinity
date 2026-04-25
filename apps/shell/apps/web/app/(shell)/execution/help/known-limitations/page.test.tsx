import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import Page from "./page";

const limitationsMarkdown = readFileSync(
  new URL("../../../../../../../../../docs/known-limitations.md", import.meta.url),
  "utf8",
);

describe("execution known limitations page", () => {
  test("renders local, staging, and production limitation groups", () => {
    const markup = renderToStaticMarkup(<Page />);

    for (const heading of ["Local Limitations", "Staging Limitations", "Production Limitations"]) {
      expect(limitationsMarkdown).toContain(`## ${heading}`);
      expect(markup).toContain(heading.replace("Limitations", "limitations"));
    }

    expect(limitationsMarkdown).toContain("When evidence is mixed, use the lowest proven tier.");
    expect(markup).toContain("lowest proven tier");
    expect(markup).toContain("docs/known-limitations.md");
  });
});
