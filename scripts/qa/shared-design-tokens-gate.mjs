#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), "utf8");
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`${label} must include ${needle}`);
  }
}

const tokenCss = read("packages/ui/src/styles/tokens.css");
for (const token of [
  "--font-size-mini",
  "--font-size-small",
  "--space-5",
  "--space-6",
  "--radius-pill",
  "--status-pending-bg",
  "--status-failed-bg",
]) {
  assertIncludes(tokenCss, token, "shared token css");
}

assertIncludes(
  read("packages/ui/src/styles/globals.css"),
  '@import "./tokens.css";',
  "@founderos/ui globals",
);
assertIncludes(
  read("packages/ui/package.json"),
  '"./tokens.css": "./src/styles/tokens.css"',
  "@founderos/ui package exports",
);
assertIncludes(
  read("apps/shell/apps/web/app/globals.css"),
  '@import "@founderos/ui/globals.css";',
  "shell globals",
);
assertIncludes(
  read("apps/work-ui/src/app.css"),
  '@import "@founderos/ui/tokens.css";',
  "work-ui app css",
);

const embeddedMetaStrip = read(
  "apps/work-ui/src/lib/components/founderos/EmbeddedMetaStrip.svelte",
);
for (const tokenUse of [
  "var(--space-5)",
  "var(--radius-pill)",
  "var(--font-size-mini)",
  "var(--status-pending-bg)",
  "var(--font-mono)",
]) {
  assertIncludes(embeddedMetaStrip, tokenUse, "embedded meta strip");
}

console.log("Shared design token gate passed.");
