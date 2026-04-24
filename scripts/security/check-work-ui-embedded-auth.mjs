#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const read = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

const failures = [];

const expectSource = (relativePath, predicate, message) => {
  const source = read(relativePath);
  if (!predicate(source)) {
    failures.push(`${relativePath}: ${message}`);
  }
};

expectSource(
  "apps/work-ui/src/lib/components/chat/XTerminal.svelte",
  (source) =>
    !/localStorage\s*\.\s*getItem\s*\(\s*['"]token['"]\s*\)/.test(source) &&
    !/localStorage\s*\.\s*token/.test(source),
  "terminal runtime must not read legacy browser bearer tokens",
);

expectSource(
  "apps/work-ui/src/lib/founderos/credentials.ts",
  (source) =>
    source.includes(
      "isFounderosEmbeddedRuntime() && !isFounderosLocalDevCredentialStorageEnabled()",
    ) && source.includes("!isFounderosEmbeddedRuntime()"),
  "embedded credential resolver must fail closed unless explicit local dev storage is enabled",
);

expectSource(
  "apps/work-ui/src/lib/founderos/index.ts",
  (source) =>
    source.includes("isLocalHostname(url.hostname.toLowerCase())") &&
    source.includes("founderos_local_dev_storage"),
  "launch token sessionStorage path must require an explicit localhost dev gate",
);

expectSource(
  "apps/work-ui/src/hooks.server.ts",
  (source) =>
    source.includes("frame-ancestors ${resolveWorkUiFrameAncestors(env).join(' ')}") &&
    !/frame-ancestors[^`"'\n;]*(?:\*|\shttps:|\shttp:)/.test(source),
  "frame-ancestors must be explicit origins, never wildcard or broad http/https schemes",
);

if (failures.length > 0) {
  console.error("Embedded auth security check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Embedded auth security check passed.");
