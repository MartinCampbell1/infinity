import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import Page from "./page";

const glossaryMarkdown = readFileSync(
  new URL("../../../../../../../../../docs/operator-glossary.md", import.meta.url),
  "utf8",
);

describe("execution operator glossary page", () => {
  test("renders the required run/task/attempt/delivery terms", () => {
    const markup = renderToStaticMarkup(<Page />);

    for (const term of ["Run", "Task", "Attempt", "Delivery"]) {
      expect(glossaryMarkdown).toContain(`## ${term}`);
      expect(markup).toContain(`>${term}<`);
    }

    expect(glossaryMarkdown).toContain(
      "A delivery is not production-ready unless its proof matches the target environment.",
    );
    expect(markup).toContain("not production-ready unless its proof matches the target environment");
    expect(markup).toContain("docs/operator-glossary.md");
  });
});
