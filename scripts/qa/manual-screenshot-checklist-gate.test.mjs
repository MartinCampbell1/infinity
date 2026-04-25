import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const CHECKLIST_PATH = new URL("../../docs/qa/manual-screenshot-checklist.md", import.meta.url);
const MANIFEST_PATH = new URL("../../docs/validation/screenshot-pack.json", import.meta.url);

const checklist = readFileSync(CHECKLIST_PATH, "utf8");
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));

test("manual screenshot checklist covers every required manifest screen id", () => {
  const requiredIds = [
    ...manifest.required_desktop,
    ...manifest.required_failure,
    ...manifest.required_standalone,
  ];

  assert.ok(requiredIds.length > 0);
  for (const screenId of requiredIds) {
    assert.match(checklist, new RegExp(`\\\`${screenId}\\\``));
  }
});

test("manual screenshot checklist has release evidence rules", () => {
  assert.match(checklist, /Redact or avoid credentials/);
  assert.match(checklist, /current commit and validation packet/);
  assert.match(checklist, /release evidence gaps/);
});
