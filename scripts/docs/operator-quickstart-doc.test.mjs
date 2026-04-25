import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const QUICKSTART_PATH = new URL("../../docs/operator-quickstart.md", import.meta.url);

const readQuickstart = () => readFileSync(QUICKSTART_PATH, "utf8");

test("operator quickstart covers required P3-DOC-01 sections", () => {
  const content = readQuickstart();

  for (const heading of [
    "## Before You Start",
    "## First Run",
    "## Interpreting Results",
    "## Recovery",
    "## When To Escalate",
  ]) {
    assert.match(content, new RegExp(`^${heading}$`, "m"));
  }
});

test("operator quickstart explains first run, results, and recovery", () => {
  const content = readQuickstart();

  for (const requiredText of [
    "New run",
    "generated brief",
    "planning",
    "task graph",
    "Validation",
    "Delivery",
    "runnable result",
    "retry the same account",
    "retry with a fallback account",
    "fresh evidence after the recovery action",
  ]) {
    assert.match(content, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("operator quickstart stays operator-facing and honest about proof", () => {
  const content = readQuickstart();

  assert.match(content, /non-developer operator/i);
  assert.match(content, /not final if browser product E2E is missing/i);
  assert.match(content, /skipped check is acceptable only when the skip reason is explicit/i);
  assert.doesNotMatch(content, /\bTODO\b/i);
  assert.doesNotMatch(content, /production ready/i);
});
