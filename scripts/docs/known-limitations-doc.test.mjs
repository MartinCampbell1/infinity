import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const LIMITATIONS_PATH = new URL("../../docs/known-limitations.md", import.meta.url);
const limitations = readFileSync(LIMITATIONS_PATH, "utf8");

test("known limitations page lists local, staging, and production limitations", () => {
  for (const heading of [
    "## Local Limitations",
    "## Staging Limitations",
    "## Production Limitations",
  ]) {
    assert.match(limitations, new RegExp(`^${heading}$`, "m"));
  }
});

test("known limitations page keeps proof tiers honest", () => {
  assert.match(limitations, /local run does not get mistaken for a hosted production release/);
  assert.match(limitations, /Local preview URLs, `localhost`, `127\.0\.0\.1`, `file:\/\/`, `\/tmp`, and `\/Users`/);
  assert.match(limitations, /P0-BE-14 staging delivery baseline has passed once/);
  assert.match(limitations, /each future staging delivery still\s+needs fresh external proof/);
  assert.match(limitations, /Production wording is allowed only when strict rollout env is enabled/);
  assert.match(limitations, /use the lowest proven tier/);
});

test("known limitations page avoids premature release claims", () => {
  assert.doesNotMatch(limitations, /\bTODO\b/i);
  assert.doesNotMatch(limitations, /\bproduction-ready by default\b/i);
  assert.doesNotMatch(limitations, /\bstaging-ready by default\b/i);
  assert.doesNotMatch(limitations, /Staging delivery remains blocked until/i);
});
