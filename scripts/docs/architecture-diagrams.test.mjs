import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const DIAGRAM_PATH = new URL("../../docs/architecture/infinity-topologies.html", import.meta.url);
const README_PATH = new URL("../../docs/architecture/README.md", import.meta.url);

test("architecture diagrams document local, staging, and production topologies", () => {
  const html = readFileSync(DIAGRAM_PATH, "utf8");

  for (const id of ["local-topology", "staging-topology", "production-topology"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.equal((html.match(/<svg /g) ?? []).length, 3);
});

test("architecture diagrams name key components and trust boundaries", () => {
  const html = readFileSync(DIAGRAM_PATH, "utf8");

  for (const requiredText of [
    "FounderOS shell",
    "Work UI",
    "Execution kernel",
    "Postgres",
    "GitHub",
    "Vercel preview",
    "Auth / RBAC",
    "Artifact store",
    "Production target",
  ]) {
    assert.match(html, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("architecture diagrams are static docs without script tags", () => {
  const html = readFileSync(DIAGRAM_PATH, "utf8");
  const readme = readFileSync(README_PATH, "utf8");

  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /docs\/production-readiness\.md/);
  assert.match(readme, /infinity-topologies\.html/);
});
