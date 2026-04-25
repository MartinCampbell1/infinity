import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCycloneDxSbom,
  hashFromIntegrity,
  npmPackagePurl,
  parseGenerateSbomArgs,
} from "./generate-sbom.mjs";
import {
  formatCriticalVulnerabilityReport,
  parseAuditJson,
  summarizeCriticalVulnerabilities,
} from "./critical-vulnerability-gate.mjs";

test("buildCycloneDxSbom emits lockfile components with purls and scope", () => {
  const sbom = buildCycloneDxSbom({
    name: "infinity",
    version: "0.0.0",
    lockfileVersion: 3,
    packages: {
      "": { name: "infinity", version: "0.0.0" },
      "node_modules/@scope/pkg": {
        version: "1.2.3",
        license: "MIT",
        integrity: "sha512-abc123",
      },
      "node_modules/optional-pkg": {
        name: "optional-pkg",
        version: "4.5.6",
        optional: true,
      },
    },
  });

  assert.equal(sbom.bomFormat, "CycloneDX");
  assert.equal(sbom.specVersion, "1.5");
  assert.equal(sbom.metadata.component.name, "infinity");
  assert.equal(sbom.components.length, 2);
  assert.deepEqual(
    sbom.components.map((component) => component.name),
    ["@scope/pkg", "optional-pkg"],
  );
  assert.equal(sbom.components[0].purl, "pkg:npm/%40scope/pkg@1.2.3");
  assert.equal(sbom.components[1].scope, "optional");
});

test("generate-sbom argument parser requires explicit values", () => {
  assert.deepEqual(parseGenerateSbomArgs([]), {
    lockfile: "package-lock.json",
    output: "artifacts/security/infinity-sbom.cdx.json",
  });
  assert.throws(() => parseGenerateSbomArgs(["--output"]), /requires a path/);
  assert.throws(() => parseGenerateSbomArgs(["--unknown"]), /Unknown argument/);
});

test("purl and integrity helpers produce CycloneDX-friendly fields", () => {
  assert.equal(npmPackagePurl("@founderos/web", "0.0.0"), "pkg:npm/%40founderos/web@0.0.0");
  assert.deepEqual(hashFromIntegrity("sha512-deadbeef sha1-ignored"), [
    { alg: "SHA-512", content: "deadbeef" },
  ]);
});

test("critical vulnerability gate reports critical advisories", () => {
  const report = parseAuditJson(JSON.stringify({
    vulnerabilities: {
      protobufjs: {
        name: "protobufjs",
        severity: "critical",
        range: "<7.5.5",
        nodes: ["node_modules/protobufjs"],
        via: [
          {
            severity: "critical",
            title: "Arbitrary code execution in protobufjs",
            url: "https://github.com/advisories/GHSA-xq3m-2v4x-88gg",
            range: "<7.5.5",
          },
        ],
      },
      next: {
        name: "next",
        severity: "high",
        via: [],
      },
    },
    metadata: {
      vulnerabilities: {
        critical: 1,
        high: 1,
        total: 2,
      },
    },
  }));

  const summary = summarizeCriticalVulnerabilities(report);
  assert.equal(summary.criticalCount, 1);
  assert.equal(summary.metadataCriticalCount, 1);
  assert.equal(summary.vulnerabilities[0].name, "protobufjs");
  assert.match(formatCriticalVulnerabilityReport(summary), /CI must block this build/);
});

test("critical vulnerability gate allows non-critical reports", () => {
  const summary = summarizeCriticalVulnerabilities({
    vulnerabilities: {
      next: {
        name: "next",
        severity: "high",
        via: [{ severity: "high", title: "High advisory" }],
      },
    },
    metadata: {
      vulnerabilities: {
        critical: 0,
        high: 1,
        total: 1,
      },
    },
  });

  assert.equal(summary.criticalCount, 0);
  assert.match(formatCriticalVulnerabilityReport(summary), /No critical npm vulnerabilities found/);
});
