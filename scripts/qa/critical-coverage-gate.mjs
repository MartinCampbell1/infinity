#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_CRITICAL_COVERAGE_AREAS = [
  {
    name: "control-plane-auth",
    minModuleCoverage: 1,
    modules: [
      {
        name: "control-plane auth middleware",
        sources: ["apps/shell/apps/web/lib/server/http/control-plane-auth.ts"],
        tests: ["apps/shell/apps/web/lib/server/http/control-plane-auth.test.ts"],
      },
      {
        name: "workspace runtime auth boundary",
        sources: [
          "apps/shell/apps/web/app/api/control/execution/workspace/[sessionId]/runtime/route.ts",
        ],
        tests: [
          "apps/shell/apps/web/app/api/control/execution/workspace/[sessionId]/runtime/route.test.ts",
        ],
      },
      {
        name: "approval mutation auth boundary",
        sources: [
          "apps/shell/apps/web/app/api/control/execution/approvals/[approvalId]/respond/route.ts",
        ],
        tests: [
          "apps/shell/apps/web/app/api/control/execution/approvals/[approvalId]/respond/route.test.ts",
        ],
      },
    ],
  },
  {
    name: "control-plane-state",
    minModuleCoverage: 1,
    modules: [
      {
        name: "state store",
        sources: ["apps/shell/apps/web/lib/server/control-plane/state/store.ts"],
        tests: ["apps/shell/apps/web/lib/server/control-plane/state/store.test.ts"],
      },
      {
        name: "postgres state adapter",
        sources: ["apps/shell/apps/web/lib/server/control-plane/state/postgres.ts"],
        tests: ["apps/shell/apps/web/lib/server/control-plane/state/postgres.test.ts"],
      },
      {
        name: "tenant isolation",
        sources: ["apps/shell/apps/web/lib/server/control-plane/state/tenancy.ts"],
        tests: ["apps/shell/apps/web/lib/server/control-plane/state/tenancy.test.ts"],
      },
    ],
  },
  {
    name: "delivery",
    minModuleCoverage: 1,
    modules: [
      {
        name: "delivery API route",
        sources: ["apps/shell/apps/web/app/api/control/orchestration/delivery/route.ts"],
        tests: ["apps/shell/apps/web/app/api/control/orchestration/delivery/route.test.ts"],
      },
      {
        name: "delivery state machine",
        sources: ["apps/shell/apps/web/lib/server/orchestration/delivery-state-machine.ts"],
        tests: ["apps/shell/apps/web/lib/server/orchestration/delivery-state.test.ts"],
      },
      {
        name: "external delivery",
        sources: ["apps/shell/apps/web/lib/server/orchestration/external-delivery.ts"],
        tests: ["apps/shell/apps/web/lib/server/orchestration/external-delivery.test.ts"],
      },
      {
        name: "artifact handling",
        sources: ["apps/shell/apps/web/lib/server/orchestration/artifacts.ts"],
        tests: ["apps/shell/apps/web/lib/server/orchestration/artifacts.test.ts"],
      },
    ],
  },
  {
    name: "kernel-scheduler",
    minModuleCoverage: 1,
    modules: [
      {
        name: "kernel service scheduler",
        sources: ["services/execution-kernel/internal/service/service.go"],
        tests: ["services/execution-kernel/internal/service/service_test.go"],
      },
      {
        name: "kernel supervisor actions",
        sources: ["services/execution-kernel/internal/handler/http.go"],
        tests: [
          "services/execution-kernel/internal/handler/http_test.go",
          "services/execution-kernel/internal/handler/supervisor_http_test.go",
        ],
      },
      {
        name: "kernel durable store",
        sources: ["services/execution-kernel/pkg/db/store.go"],
        tests: ["services/execution-kernel/pkg/db/store_test.go"],
      },
      {
        name: "kernel daemon lifecycle",
        sources: ["services/execution-kernel/internal/daemon/server.go"],
        tests: ["services/execution-kernel/internal/daemon/server_test.go"],
      },
    ],
  },
];

function absolutePath(rootDir, relativePath) {
  return path.join(rootDir, relativePath);
}

function hasTestSignal(filePath) {
  if (!existsSync(filePath)) {
    return false;
  }

  const source = readFileSync(filePath, "utf8");
  return /\b(test|it|describe)\s*\(/.test(source) || /\bfunc\s+Test[A-Za-z0-9_]*\s*\(/.test(source);
}

function evaluateModule(rootDir, module) {
  const missingSources = module.sources.filter(
    (sourcePath) => !existsSync(absolutePath(rootDir, sourcePath))
  );
  const missingTests = module.tests.filter(
    (testPath) => !existsSync(absolutePath(rootDir, testPath))
  );
  const testsWithoutSignals = module.tests.filter(
    (testPath) => existsSync(absolutePath(rootDir, testPath)) && !hasTestSignal(absolutePath(rootDir, testPath))
  );

  return {
    name: module.name,
    sources: module.sources,
    tests: module.tests,
    covered: missingSources.length === 0 && missingTests.length === 0 && testsWithoutSignals.length === 0,
    missingSources,
    missingTests,
    testsWithoutSignals,
  };
}

export function evaluateCriticalCoverage({
  rootDir = process.cwd(),
  areas = DEFAULT_CRITICAL_COVERAGE_AREAS,
} = {}) {
  const areaResults = areas.map((area) => {
    const moduleResults = area.modules.map((module) => evaluateModule(rootDir, module));
    const coveredModules = moduleResults.filter((module) => module.covered).length;
    const moduleCoverage = moduleResults.length ? coveredModules / moduleResults.length : 0;

    return {
      name: area.name,
      minModuleCoverage: area.minModuleCoverage,
      moduleCoverage,
      coveredModules,
      totalModules: moduleResults.length,
      passed: moduleCoverage >= area.minModuleCoverage,
      modules: moduleResults,
    };
  });

  return {
    passed: areaResults.every((area) => area.passed),
    areas: areaResults,
  };
}

export function formatCriticalCoverageReport(result) {
  const lines = ["Critical coverage gate"];

  for (const area of result.areas) {
    const percent = Math.round(area.moduleCoverage * 100);
    const required = Math.round(area.minModuleCoverage * 100);
    lines.push(
      `- ${area.name}: ${percent}% module coverage (${area.coveredModules}/${area.totalModules}), required ${required}%`
    );

    for (const module of area.modules) {
      if (module.covered) {
        continue;
      }

      lines.push(`  - ${module.name}: uncovered`);
      for (const missingSource of module.missingSources) {
        lines.push(`    missing source: ${missingSource}`);
      }
      for (const missingTest of module.missingTests) {
        lines.push(`    missing test: ${missingTest}`);
      }
      for (const testWithoutSignal of module.testsWithoutSignals) {
        lines.push(`    test has no test signal: ${testWithoutSignal}`);
      }
    }
  }

  lines.push(result.passed ? "Status: PASS" : "Status: FAIL");
  return lines.join("\n");
}

export function runCriticalCoverageGate({ rootDir = process.cwd(), areas } = {}) {
  const result = evaluateCriticalCoverage({ rootDir, areas });
  const report = formatCriticalCoverageReport(result);
  return { result, report };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const { result, report } = runCriticalCoverageGate({ rootDir });
  console.log(report);
  process.exitCode = result.passed ? 0 : 1;
}
