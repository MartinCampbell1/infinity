import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const DOC_PATH = new URL("../../docs/ops/staging-topology.md", import.meta.url);

const readDoc = () => readFileSync(DOC_PATH, "utf8");

test("staging topology documents non-local shell and work-ui boundaries", () => {
  const doc = readDoc();

  for (const required of [
    "FOUNDEROS_SHELL_PUBLIC_ORIGIN",
    "FOUNDEROS_WORK_UI_BASE_URL",
    "non-local HTTPS",
    "must not share the shell origin",
  ]) {
    assert.match(doc, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("staging topology documents private kernel and durable storage requirements", () => {
  const doc = readDoc();

  for (const required of [
    "FOUNDEROS_EXECUTION_KERNEL_BASE_URL",
    "FOUNDEROS_PRIVILEGED_API_ALLOWED_ORIGINS",
    "FOUNDEROS_CONTROL_PLANE_DATABASE_URL",
    "FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL",
    "Postgres URL",
  ]) {
    assert.match(doc, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("staging topology documents object storage, secret manager, and diagnostics check", () => {
  const doc = readDoc();

  for (const required of [
    "FOUNDEROS_ARTIFACT_STORE_MODE",
    "FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX",
    "FOUNDEROS_ARTIFACT_SIGNED_URL_BASE",
    "FOUNDEROS_ARTIFACT_SIGNING_SECRET",
    "FOUNDEROS_SECRETS_MANAGER",
    "/api/control/deployment/boot-diagnostics",
    "stagingTopology",
    "without returning secret values",
  ]) {
    assert.match(doc, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
