import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { describe, expect, test } from "vitest";

describe("autonomous loop responsiveness", () => {
  test("yields between non-test autonomous passes so API polling stays responsive", () => {
    const sourcePath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "autonomy.ts",
    );
    const source = readFileSync(sourcePath, "utf8");
    const loopStart = source.indexOf("export async function runAutonomousLoopForInitiative");
    const loopBody = loopStart >= 0 ? source.slice(loopStart) : "";

    expect(source).toContain("function yieldAutonomousLoopTurn");
    expect(loopBody).toContain("!shouldRunAutonomousLoopInline()");
    expect(loopBody).toContain("await yieldAutonomousLoopTurn()");
  });
});
