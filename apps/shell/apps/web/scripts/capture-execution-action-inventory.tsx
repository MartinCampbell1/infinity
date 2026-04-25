import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as ts from "typescript";

import { AutonomousRecordBoard } from "../components/execution/autonomous-record-board";
import { DeliverySummary } from "../components/orchestration/delivery-summary";

const observedAt = new Date().toISOString();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");
const defaultOutputDir = path.resolve(
  scriptDir,
  "../../../../../.local-state/p0-fe-02-action-inventory",
  observedAt.replace(/[:.]/g, "-"),
);
const outputDir = path.resolve(process.argv[2] ?? defaultOutputDir);
const htmlDir = path.join(outputDir, "html");
const inventoryPath = path.join(outputDir, "action-inventory.json");
const sourceInventoryPath = path.join(outputDir, "source-action-inventory.json");
const reportPath = path.join(outputDir, "action-inventory-report.html");
const manifestPath = path.join(outputDir, "manifest.json");

type Scenario = {
  id: "delivery-summary" | "autonomous-record-board";
  html: string;
  expectedText: string[];
};

type ActionClassification =
  | "link"
  | "api_action"
  | "client_action"
  | "in_page_anchor"
  | "disabled_read_only";

type SourceActionRecord = {
  file: string;
  line: number;
  component: string;
  tag: string;
  classification: ActionClassification | "unclassified";
  target: string;
  reason: string | null;
  text: string;
};

const controlTags = new Set([
  "ActionLink",
  "Link",
  "a",
  "button",
  "DisabledProofActionButton",
  "ExecutionDetailActionLink",
  "PlaneButton",
  "PlaneDisabledAction",
  "PlaneIconButton",
  "PlaneRunPillLink",
  "SelectionToggleButton",
  "ShellActionLink",
  "ShellActionLinkCard",
  "ShellListLink",
  "ShellPillButton",
  "ShellRecordLinkButton",
  "ShellRecordSelectionButton",
  "ShellRefreshButton",
]);

const actionPropNames = [
  "onClick",
  "onToggleSelected",
  "onResolve",
  "onApprove",
  "onReject",
  "onAllow",
  "onDeny",
  "onRefresh",
  "onSubmit",
];

const inventoryRoots = [
  "app/(shell)/execution",
  "components/execution",
  "components/orchestration",
  "components/work-items",
].map((relativePath) => path.join(webRoot, relativePath));

function htmlPage(title: string, body: string) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${title}</title>`,
    "<style>",
    "body{margin:0;background:#06080d;color:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}",
    "a{color:inherit}button{font:inherit}code{white-space:pre-wrap}",
    "[hidden]{display:none!important}",
    "</style>",
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
  ].join("");
}

function renderDeliverySummary() {
  const previousStrict = process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
  process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = "1";
  try {
    return htmlPage(
      "P0-FE-02 delivery summary actions",
      renderToStaticMarkup(
        <DeliverySummary
          delivery={{
            id: "delivery-action-inventory",
            initiativeId: "initiative-action-inventory",
            verificationRunId: "verification-action-inventory",
            taskGraphId: "task-graph-action-inventory",
            resultSummary: "Runnable proof exists, but external rollout proof is missing.",
            localOutputPath: "/tmp/infinity-action-inventory",
            manifestPath: "/tmp/infinity-action-inventory/delivery-manifest.json",
            previewUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/action-inventory",
            launchManifestPath: "/tmp/infinity-action-inventory/launch-manifest.json",
            launchProofKind: "runnable_result",
            launchTargetLabel: "Action inventory preview",
            launchProofUrl: "http://127.0.0.1:4100",
            launchProofAt: observedAt,
            command: "python3 launch-localhost.py --port 0 --entry /index.html",
            status: "ready",
            deliveredAt: observedAt,
          }}
          initiativeTitle="Action inventory delivery"
          initiativePrompt="Render delivery action controls."
          verification={{
            id: "verification-action-inventory",
            initiativeId: "initiative-action-inventory",
            assemblyId: "assembly-action-inventory",
            overallStatus: "passed",
            checks: [{ name: "targeted_tests_passed", status: "passed" }],
            startedAt: observedAt,
            finishedAt: observedAt,
          }}
          assembly={{
            id: "assembly-action-inventory",
            initiativeId: "initiative-action-inventory",
            taskGraphId: "task-graph-action-inventory",
            inputWorkUnitIds: ["work-unit-action"],
            artifactUris: ["file:///tmp/infinity-action-inventory/work-unit-action.json"],
            outputLocation: "/tmp/infinity-action-inventory",
            summary: "Action inventory assembly.",
            status: "assembled",
            createdAt: observedAt,
            updatedAt: observedAt,
          }}
          taskGraphId="task-graph-action-inventory"
          runId="run-action-inventory"
          handoffId="handoff-action-inventory"
          sourceWorkUnits={[]}
        />,
      ),
    );
  } finally {
    if (previousStrict === undefined) {
      delete process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
    } else {
      process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = previousStrict;
    }
  }
}

function renderAutonomousRecordBoard() {
  return htmlPage(
    "P0-FE-02 autonomous board actions",
    renderToStaticMarkup(
      <AutonomousRecordBoard
        eyebrow="Execution"
        title="Runs"
        description="Operator action inventory fixture."
        emptyTitle="No runs"
        emptyDescription="No runs yet."
        headerAction={<span>Header action</span>}
        items={[
          {
            id: "run-linked-action",
            title: "Linked run",
            prompt: "Run with concrete route.",
            stage: "running",
            health: "healthy",
            preview: "pending",
            handoff: "none",
            updated: "10:00",
            tasks: "1 / 2",
            agent: "codex",
            href: "/execution/continuity/initiative-linked-action",
            featured: true,
          },
          {
            id: "run-readonly-action",
            title: "Read-only run",
            prompt: "Run without concrete route.",
            stage: "blocked",
            health: "blocked",
            preview: "none",
            handoff: "none",
            updated: "10:05",
            tasks: "0 / 2",
            agent: "codex",
            href: null,
            group: "attention",
          },
        ]}
      />,
    ),
  );
}

function assertPrimaryRunSurfaceSource() {
  const sourcePath = path.join(webRoot, "components/execution/primary-run-surface.tsx");
  const source = readFileSync(sourcePath, "utf8");
  const expectedLabels = [
    "Task action menu",
    "Abort run",
    "Force retry",
    "Pause for review",
  ];
  const missing = expectedLabels.filter((label) => !source.includes(`label="${label}"`));
  if (!source.includes("PlaneDisabledAction") || missing.length > 0) {
    throw new Error(`PrimaryRunSurface missing disabled-action source mapping: ${missing.join(", ")}`);
  }
  return {
    file: sourcePath,
    expectedLabels,
    status: "passed",
  };
}

function walkTsxFiles(root: string): string[] {
  const entries = readdirSync(root)
    .map((entry) => path.join(root, entry))
    .sort();
  const files: string[] = [];
  for (const entry of entries) {
    const stat = statSync(entry);
    if (stat.isDirectory()) {
      files.push(...walkTsxFiles(entry));
    } else if (
      entry.endsWith(".tsx") &&
      !entry.endsWith(".test.tsx") &&
      !entry.includes(`${path.sep}node_modules${path.sep}`)
    ) {
      files.push(entry);
    }
  }
  return files;
}

function tagName(name: ts.JsxTagNameExpression): string {
  return name.getText();
}

function jsxAttributes(
  node: ts.JsxOpeningLikeElement
): ts.NodeArray<ts.JsxAttributeLike> {
  return node.attributes.properties;
}

function findAttribute(
  node: ts.JsxOpeningLikeElement,
  name: string
): ts.JsxAttribute | null {
  for (const attribute of jsxAttributes(node)) {
    if (ts.isJsxAttribute(attribute) && attribute.name.text === name) {
      return attribute;
    }
  }
  return null;
}

function hasAttribute(node: ts.JsxOpeningLikeElement, name: string) {
  return Boolean(findAttribute(node, name));
}

function attributeText(
  node: ts.JsxOpeningLikeElement,
  name: string,
  sourceFile: ts.SourceFile
) {
  const attribute = findAttribute(node, name);
  if (!attribute) {
    return null;
  }
  if (!attribute.initializer) {
    return "true";
  }
  if (ts.isStringLiteral(attribute.initializer)) {
    return attribute.initializer.text;
  }
  return attribute.initializer.getText(sourceFile);
}

function hasReason(
  node: ts.JsxOpeningLikeElement,
  ancestors: ts.JsxOpeningLikeElement[],
  sourceFile: ts.SourceFile
) {
  return Boolean(disabledReason(node, ancestors, sourceFile));
}

function disabledReason(
  node: ts.JsxOpeningLikeElement,
  ancestors: ts.JsxOpeningLikeElement[],
  sourceFile: ts.SourceFile
) {
  for (const candidate of [node, ...ancestors]) {
    const value =
      attributeText(candidate, "reason", sourceFile) ??
      attributeText(candidate, "data-disabled-action-reason", sourceFile) ??
      attributeText(candidate, "title", sourceFile) ??
      attributeText(candidate, "data-disabled-proof-action", sourceFile);
    if (value) {
      return value;
    }
  }
  return null;
}

function nearestLinkAncestor(
  ancestors: ts.JsxOpeningLikeElement[],
) {
  return ancestors.find((ancestor) => {
    const tag = tagName(ancestor.tagName);
    return tag === "Link" || tag === "a";
  }) ?? null;
}

function lineFor(sourceFile: ts.SourceFile, node: ts.Node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function compactText(value: string | null) {
  if (!value) {
    return "";
  }
  return value.replace(/\s+/g, " ").slice(0, 160);
}

function actionPropText(node: ts.JsxOpeningLikeElement, sourceFile: ts.SourceFile) {
  for (const propName of actionPropNames) {
    const value = attributeText(node, propName, sourceFile);
    if (value) {
      return value;
    }
  }
  return null;
}

function classifyOnClick(expression: string | null): ActionClassification {
  if (!expression) {
    return "client_action";
  }
  return /fetch\(|runApprovalDecision|runRecoveryAction|createProject|respond|refreshDetail|launchBatch|run\(/.test(
    expression
  )
    ? "api_action"
    : "client_action";
}

function classifyControl(
  file: string,
  sourceFile: ts.SourceFile,
  node: ts.JsxOpeningLikeElement,
  ancestors: ts.JsxOpeningLikeElement[]
): SourceActionRecord | null {
  const tag = tagName(node.tagName);
  const component = path.relative(webRoot, file);
  const href = attributeText(node, "href", sourceFile);
  const actionProp = actionPropText(node, sourceFile);
  const label = attributeText(node, "label", sourceFile);
  const reason = attributeText(node, "reason", sourceFile);
  const disabled = hasAttribute(node, "disabled");
  const ancestorLink = nearestLinkAncestor(ancestors);
  const ancestorHref = ancestorLink ? attributeText(ancestorLink, "href", sourceFile) : null;
  const text = compactText(node.getText(sourceFile));
  const actionLikeProps = Boolean(href || actionProp || disabled || reason);
  if (!controlTags.has(tag) && !actionLikeProps) {
    return null;
  }

  if (tag === "PlaneButton" && ancestorLink) {
    return null;
  }

  if (tag === "Link" || tag === "a" || href) {
    const classification = href?.startsWith("#") ? "in_page_anchor" : "link";
    return {
      file,
      line: lineFor(sourceFile, node),
      component,
      tag,
      classification,
      target: href ?? "",
      reason: null,
      text,
    };
  }

  if (tag === "PlaneDisabledAction" || tag === "DisabledProofActionButton") {
    return {
      file,
      line: lineFor(sourceFile, node),
      component,
      tag,
      classification: reason ? "disabled_read_only" : "unclassified",
      target: label ?? tag,
      reason,
      text,
    };
  }

  if (ancestorLink && ancestorHref) {
    return {
      file,
      line: lineFor(sourceFile, node),
      component,
      tag,
      classification: ancestorHref.startsWith("#") ? "in_page_anchor" : "link",
      target: ancestorHref,
      reason: null,
      text,
    };
  }

  if (actionProp) {
    return {
      file,
      line: lineFor(sourceFile, node),
      component,
      tag,
      classification: classifyOnClick(actionProp),
      target: actionProp,
      reason: null,
      text,
    };
  }

  if (disabled) {
    const disabledReasonValue = disabledReason(node, ancestors, sourceFile);
    return {
      file,
      line: lineFor(sourceFile, node),
      component,
      tag,
      classification: disabledReasonValue ? "disabled_read_only" : "unclassified",
      target: label ?? tag,
      reason: disabledReasonValue,
      text,
    };
  }

  return {
    file,
    line: lineFor(sourceFile, node),
    component,
    tag,
    classification: "unclassified",
    target: "",
    reason: null,
    text,
  };
}

function collectSourceInventory() {
  const files = [...new Set(inventoryRoots.flatMap((root) => walkTsxFiles(root)))].sort();
  const actions: SourceActionRecord[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );

    const visit = (node: ts.Node, ancestors: ts.JsxOpeningLikeElement[]) => {
      if (ts.isJsxElement(node)) {
        const opening = node.openingElement;
        const action = classifyControl(file, sourceFile, opening, ancestors);
        if (action) {
          actions.push(action);
        }
        jsxAttributes(opening).forEach((attribute) => visit(attribute, ancestors));
        node.children.forEach((child) => visit(child, [opening, ...ancestors]));
        return;
      }
      if (ts.isJsxSelfClosingElement(node)) {
        const action = classifyControl(file, sourceFile, node, ancestors);
        if (action) {
          actions.push(action);
        }
        jsxAttributes(node).forEach((attribute) => visit(attribute, ancestors));
        return;
      }
      ts.forEachChild(node, (child) => visit(child, ancestors));
    };

    visit(sourceFile, []);
  }

  const errors = actions
    .filter((action) => {
      if (action.classification === "unclassified") {
        return true;
      }
      if ((action.classification === "link" || action.classification === "in_page_anchor") && (!action.target || action.target === "#")) {
        return true;
      }
      if (action.classification === "disabled_read_only" && !action.reason && !/data-disabled-proof-action|data-disabled-action-reason|title=/.test(action.text)) {
        return true;
      }
      return false;
    })
    .map((action) => ({
      component: action.component,
      line: action.line,
      tag: action.tag,
      classification: action.classification,
      target: action.target,
      text: action.text,
    }));

  if (errors.length > 0) {
    throw new Error(`Execution action inventory has unclassified controls:\n${JSON.stringify(errors, null, 2)}`);
  }

  return {
    files: files.map((file) => path.relative(webRoot, file)),
    actions,
    counts: actions.reduce<Record<string, number>>((accumulator, action) => {
      accumulator[action.classification] = (accumulator[action.classification] ?? 0) + 1;
      return accumulator;
    }, {}),
  };
}

function renderInventoryReport(sourceInventory: ReturnType<typeof collectSourceInventory>) {
  const rows = sourceInventory.actions
    .map((action) => (
      `<tr data-action-classification="${action.classification}">` +
      `<td>${action.component}:${action.line}</td>` +
      `<td>${action.tag}</td>` +
      `<td>${action.classification}</td>` +
      `<td>${action.target.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>` +
      `<td>${(action.reason ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>` +
      "</tr>"
    ))
    .join("");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    "<title>P0-FE-02 action inventory report</title>",
    "<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#06080d;color:white}table{border-collapse:collapse;width:100%}td,th{border:1px solid rgba(255,255,255,.14);padding:6px;font-size:12px;vertical-align:top}</style>",
    "</head>",
    "<body>",
    "<h1>P0-FE-02 action inventory</h1>",
    `<p data-source-file-count="${sourceInventory.files.length}" data-source-action-count="${sourceInventory.actions.length}">Files: ${sourceInventory.files.length}; actions: ${sourceInventory.actions.length}</p>`,
    "<table><thead><tr><th>Location</th><th>Tag</th><th>Classification</th><th>Target</th><th>Reason</th></tr></thead><tbody>",
    rows,
    "</tbody></table>",
    "</body></html>",
  ].join("");
}

const scenarios: Scenario[] = [
  {
    id: "delivery-summary",
    html: renderDeliverySummary(),
    expectedText: [
      'data-disabled-action="Resume w/ prompt"',
      'data-disabled-action="Archive"',
      'data-disabled-proof-action="Open hosted preview"',
      'data-disabled-proof-action="Open pull request"',
    ],
  },
  {
    id: "autonomous-record-board",
    html: renderAutonomousRecordBoard(),
    expectedText: [
      'data-disabled-action="Open run"',
      'data-disabled-action="Preview"',
      'data-disabled-action="Logs"',
      "Drawer close is disabled in this server-rendered board.",
    ],
  },
];
const primarySourceCheck = assertPrimaryRunSurfaceSource();
const sourceInventory = collectSourceInventory();

mkdirSync(htmlDir, { recursive: true });
const files = scenarios.map((scenario) => {
  for (const expected of scenario.expectedText) {
    if (!scenario.html.includes(expected)) {
      throw new Error(`${scenario.id} action inventory missing expected marker: ${expected}`);
    }
  }
  const htmlPath = path.join(htmlDir, `${scenario.id}.html`);
  writeFileSync(htmlPath, scenario.html, "utf8");
  return { id: scenario.id, htmlPath };
});
writeFileSync(sourceInventoryPath, `${JSON.stringify(sourceInventory, null, 2)}\n`, "utf8");
writeFileSync(reportPath, renderInventoryReport(sourceInventory), "utf8");

const python = `
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

files = json.loads(${JSON.stringify(JSON.stringify(files))})
inventory_path = ${JSON.stringify(inventoryPath)}
report_path = ${JSON.stringify(reportPath)}
errors = []
inventory = []

with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="chrome", headless=True)
    except Exception:
        browser = p.chromium.launch(headless=True)
    try:
        page = browser.new_page(viewport={"width": 1440, "height": 1200})
        for item in files:
            page.goto(Path(item["htmlPath"]).as_uri())
            actions = page.evaluate("""() => Array.from(document.querySelectorAll('a,button,[data-disabled-action],[data-disabled-proof-action]')).map((el) => ({
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || '').trim().replace(/\\s+/g, ' '),
                href: el.getAttribute('href'),
                disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
                disabledAction: el.getAttribute('data-disabled-action'),
                disabledProofAction: el.getAttribute('data-disabled-proof-action'),
                reason: el.getAttribute('data-disabled-action-reason') || el.getAttribute('title') || ''
            }))""")
            for action in actions:
                if action["tag"] == "a" and (action["href"] is None or action["href"] == "" or action["href"] == "#"):
                    errors.append(f'{item["id"]}: anchor has no concrete href: {action["text"]}')
                if action["disabledAction"] and not action["reason"]:
                    errors.append(f'{item["id"]}: disabled action has no reason: {action["disabledAction"]}')
                if action["disabledProofAction"] and not action["reason"]:
                    errors.append(f'{item["id"]}: disabled proof action has no reason: {action["disabledProofAction"]}')
            inventory.append({"id": item["id"], "actions": actions})
        page.goto(Path(report_path).as_uri())
        report_summary = page.evaluate("""() => ({
            files: Number(document.querySelector('[data-source-file-count]')?.getAttribute('data-source-file-count') || 0),
            actions: Number(document.querySelector('[data-source-action-count]')?.getAttribute('data-source-action-count') || 0),
            unclassified: document.querySelectorAll('[data-action-classification="unclassified"]').length
        })""")
        if report_summary["files"] <= 0 or report_summary["actions"] <= 0:
            errors.append("source inventory report is empty")
        if report_summary["unclassified"] > 0:
            errors.append(f'source inventory report has {report_summary["unclassified"]} unclassified actions')
    finally:
        browser.close()

Path(inventory_path).write_text(json.dumps(inventory, indent=2), encoding="utf8")
if errors:
    raise SystemExit("\\n".join(errors))
`;

const inventoryResult = spawnSync("python3", ["-"], {
  input: python,
  encoding: "utf8",
});

if (inventoryResult.status !== 0) {
  process.stderr.write(inventoryResult.stdout);
  process.stderr.write(inventoryResult.stderr);
  process.exit(inventoryResult.status ?? 1);
}

writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      observedAt,
      outputDir,
      files,
      inventoryPath,
      sourceInventoryPath,
      reportPath,
      sourceCoverage: {
        files: sourceInventory.files,
        counts: sourceInventory.counts,
      },
      primarySourceCheck,
    },
    null,
    2
  )}\n`,
  "utf8",
);

process.stdout.write(`${manifestPath}\n`);
