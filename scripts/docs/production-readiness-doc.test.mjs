import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const DOC_PATH = new URL("../../docs/production-readiness.md", import.meta.url);

const readDoc = () => readFileSync(DOC_PATH, "utf8");

test("production readiness keeps tier rules and external smoke requirements", () => {
  const doc = readDoc();

  for (const required of [
    "## Readiness tiers",
    "## External delivery smoke",
    "docs/ops/staging-topology.md",
    "FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV=1",
    "FOUNDEROS_EXTERNAL_DELIVERY_ALLOW_MUTATIONS=1",
    "A passing smoke must prove all of these in one run",
  ]) {
    assert.match(doc, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(
    doc,
    /use that topology check before treating hosted\s+staging evidence as stronger than local proof/,
  );
});

test("production readiness records the latest P0-BE-14 staging evidence", () => {
  const doc = readDoc();

  for (const required of [
    "## Latest P0-BE-14 staging evidence",
    "2026-04-25",
    "https://github.com/MartinCampbell1/infinity/pull/7",
    "delivery/delivery-smoke-1777075954563",
    "dpl_6wkVjvUUA5QbGo5R7wLGvZj8mSpd",
    "FOUNDEROS_EXTERNAL_PREVIEW_EXPECTED_TEXT",
    "signed manifest and first signed artifact checksum headers",
  ]) {
    assert.match(doc, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("production readiness does not overclaim from one staging run", () => {
  const doc = readDoc();

  assert.match(doc, /fresh external proof manifest/i);
  assert.match(doc, /hosted staging proof, not localhost evidence/i);
  assert.match(doc, /fresh external staging proof for the release under review/i);
  assert.match(doc, /does not by itself make every future release production-ready/i);
  assert.doesNotMatch(doc, /P0-BE-14 remains a\s+blocked staging-smoke item/i);
  assert.doesNotMatch(doc, /staging`\s*\|\s*Strict rollout environment is enabled, but the delivery still lacks hosted proof/i);
  assert.doesNotMatch(doc, /\bTODO\b/i);
});
