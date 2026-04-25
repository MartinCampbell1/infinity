import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const TEMPLATE_ROOT = new URL("../../docs/dx/agent-task-templates/", import.meta.url);

const templates = {
  backend: readFileSync(new URL("backend-agent.md", TEMPLATE_ROOT), "utf8"),
  frontend: readFileSync(new URL("frontend-agent.md", TEMPLATE_ROOT), "utf8"),
  qa: readFileSync(new URL("qa-agent.md", TEMPLATE_ROOT), "utf8"),
  index: readFileSync(new URL("README.md", TEMPLATE_ROOT), "utf8"),
};

test("agent task template library includes backend, frontend, and QA templates", () => {
  assert.match(templates.index, /Backend agent/);
  assert.match(templates.index, /Frontend agent/);
  assert.match(templates.index, /QA agent/);

  assert.match(templates.backend, /^# Backend Agent Task Template/m);
  assert.match(templates.frontend, /^# Frontend Agent Task Template/m);
  assert.match(templates.qa, /^# QA Agent Task Template/m);
});

test("agent task templates preserve repo and resource guardrails", () => {
  for (const content of [templates.backend, templates.frontend, templates.qa]) {
    assert.match(content, /Do not edit outside \/Users\/martin\/infinity\./);
    assert.match(content, /Read-only references:/);
    assert.match(content, /Do not run watchers/);
    assert.match(content, /git diff --check/);
    assert.match(content, /Independent critic gate result: GO, NO-GO, or BLOCKER/);
  }
});

test("agent task templates are role-specific", () => {
  assert.match(templates.backend, /Backend ownership:/);
  assert.match(templates.backend, /APIs, route handlers, storage, adapters/);
  assert.match(templates.frontend, /Frontend ownership:/);
  assert.match(templates.frontend, /Preserve FounderOS as the outer shell/);
  assert.match(templates.qa, /QA ownership:/);
  assert.match(templates.qa, /Do not weaken validation gates/);
});
