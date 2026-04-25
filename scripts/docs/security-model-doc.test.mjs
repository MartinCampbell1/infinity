import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const MODEL_PATH = new URL("../../docs/security/threat-model.md", import.meta.url);

const readThreatModel = () => readFileSync(MODEL_PATH, "utf8");

test("threat model covers required P2-DOC-03 domains", () => {
  const model = readThreatModel();

  for (const term of ["Auth", "Tokens", "Iframe", "Kernel", "Artifacts", "Providers"]) {
    assert.match(model, new RegExp(`\\b${term}\\b`, "i"));
  }
});

test("threat model links controls to repo evidence", () => {
  const model = readThreatModel();

  for (const path of [
    "apps/shell/apps/web/lib/server/http/control-plane-auth.ts",
    "scripts/security/check-work-ui-embedded-auth.mjs",
    "apps/work-ui/src/hooks.server.ts",
    "packages/api-clients/src/multica.ts",
    "apps/shell/apps/web/lib/server/orchestration/artifacts.ts",
    "docs/production-readiness.md",
    "docs/ops/staging-topology.md",
  ]) {
    assert.match(model, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("threat model is explicit about production gaps and forbidden claims", () => {
  const model = readThreatModel();

  assert.match(model, /not a production-readiness attestation/i);
  assert.match(model, /Production Security Checklist/);
  assert.doesNotMatch(model, /\bTODO\b/i);
  assert.doesNotMatch(model, /production ready/i);
});
