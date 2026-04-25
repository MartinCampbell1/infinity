import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const webRoot = process.cwd();
const scanTargets = [
  path.join(webRoot, "app"),
  path.join(webRoot, "components"),
  path.join(webRoot, "lib", "execution-agents.ts"),
  path.join(webRoot, "lib", "delivery-readiness.ts"),
];

const forbiddenPatterns = [
  { label: "user home path", pattern: /\/Users\/martin/ },
  { label: "person-specific username", pattern: /\bmartin\b/i },
  {
    label: "hardcoded localhost delivery copy",
    pattern:
      /localhost-(?:ready|only)|localhost (?:manifest|launch proof|proof|preview|result)|Runnable localhost/i,
  },
  {
    label: "demo app copy",
    pattern: /\b(?:habit tracker|tip calculator|wishlist tracker|invoice generator)\b/i,
  },
];

function isSourceFile(filePath) {
  return /\.(?:ts|tsx)$/.test(filePath);
}

function shouldSkip(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  return (
    normalized.includes(".test.") ||
    normalized.includes("/__tests__/") ||
    normalized.includes("/fixtures/") ||
    normalized.endsWith("/lib/ui-redaction.ts")
  );
}

function collectFiles(target) {
  const stat = statSync(target);
  if (stat.isFile()) {
    return isSourceFile(target) && !shouldSkip(target) ? [target] : [];
  }

  return readdirSync(target).flatMap((entry) => {
    const child = path.join(target, entry);
    const childStat = statSync(child);
    if (childStat.isDirectory()) {
      return collectFiles(child);
    }
    return isSourceFile(child) && !shouldSkip(child) ? [child] : [];
  });
}

describe("production UI local/demo leak check", () => {
  test("production-rendered UI sources do not contain personal paths or demo copy", () => {
    const violations = [];
    for (const filePath of scanTargets.flatMap(collectFiles)) {
      const content = readFileSync(filePath, "utf8");
      for (const { label, pattern } of forbiddenPatterns) {
        const match = content.match(pattern);
        if (match) {
          violations.push(`${path.relative(webRoot, filePath)}: ${label}: ${match[0]}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
