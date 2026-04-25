import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const GLOSSARY_PATH = new URL("../../docs/operator-glossary.md", import.meta.url);
const glossary = readFileSync(GLOSSARY_PATH, "utf8");

test("operator glossary defines the required P3-DOC-02 terms", () => {
  for (const heading of ["## Run", "## Task", "## Attempt", "## Delivery"]) {
    assert.match(glossary, new RegExp(`^${heading}$`, "m"));
  }

  assert.match(glossary, /Use `run` when discussing:/);
  assert.match(glossary, /Use `task` when discussing:/);
  assert.match(glossary, /Use `attempt` when discussing:/);
  assert.match(glossary, /Use `delivery` when discussing:/);
});

test("operator glossary separates attempts from tasks and delivery from proof", () => {
  assert.match(glossary, /An attempt can fail while the task and run remain recoverable\./);
  assert.match(glossary, /The task is done only when its acceptance evidence is present\./);
  assert.match(glossary, /A delivery is not production-ready unless its proof matches the target environment\./);
});

test("operator glossary stays operator-facing and production-honest", () => {
  assert.doesNotMatch(glossary, /\bTODO\b/i);
  assert.doesNotMatch(glossary, /\bproduction-ready by default\b/i);
  assert.match(glossary, /Quick Decision Table/);
  assert.match(glossary, /Recovery can retry the same account, fail over to a fallback account/);
});
