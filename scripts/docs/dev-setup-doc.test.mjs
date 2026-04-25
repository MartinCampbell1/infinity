import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const DOC_PATH = new URL("../../docs/dev-setup.md", import.meta.url);

test("docs/dev-setup.md covers the required onboarding sections", () => {
  const content = readFileSync(DOC_PATH, "utf8");

  for (const heading of [
    "## Toolchain",
    "## Environment",
    "## Common Commands",
    "## Troubleshooting",
  ]) {
    assert.match(content, new RegExp(`^${heading}$`, "m"));
  }
});

test("docs/dev-setup.md names critical local commands and env vars", () => {
  const content = readFileSync(DOC_PATH, "utf8");

  for (const requiredText of [
    "npm ci",
    "npm run localhost:start",
    "npm run shell:typecheck",
    "npm run work-ui:check",
    "npm run security:audit:critical",
    "npm run release:packet",
    "FOUNDEROS_MIGRATION_TEST_DATABASE_URL",
    "FOUNDEROS_CONTROL_PLANE_STATE_DIR",
  ]) {
    assert.match(content, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("docs/dev-setup.md preserves repo boundary warnings", () => {
  const content = readFileSync(DOC_PATH, "utf8");

  assert.match(content, /FounderOS.*read-only/s);
  assert.match(content, /open-webui.*read-only/s);
  assert.match(content, /Do not start watchers/);
  assert.match(content, /Do not commit or paste secrets/);
});
