import type {
  AutopilotExecutionApprovalRecord,
  AutopilotExecutionIssueRecord,
  AutopilotToolPermissionRuntimeRecord,
} from "@founderos/api-clients";

import type { ShellExecutionSourceContext } from "@/lib/execution-source";

export type IssueAttentionRecord = {
  type: "issue";
  plane: "execution";
  key: string;
  tone: "info" | "warning" | "danger" | "neutral";
  label: string;
  title: string;
  detail: string;
  status: string;
  attention: number;
  sortAt: string;
  href: string;
  hrefLabel: string;
  searchText: string;
  source: ShellExecutionSourceContext;
  issue: AutopilotExecutionIssueRecord;
};

export type ApprovalAttentionRecord = {
  type: "approval";
  plane: "execution";
  key: string;
  tone: "info" | "warning" | "danger" | "neutral";
  label: string;
  title: string;
  detail: string;
  status: string;
  attention: number;
  sortAt: string;
  href: string;
  hrefLabel: string;
  searchText: string;
  source: ShellExecutionSourceContext;
  approval: AutopilotExecutionApprovalRecord;
};

export type RuntimeAttentionRecord = {
  type: "runtime";
  plane: "execution";
  key: string;
  tone: "info" | "warning" | "danger" | "neutral";
  label: string;
  title: string;
  detail: string;
  status: string;
  attention: number;
  sortAt: string;
  href: string;
  hrefLabel: string;
  searchText: string;
  source: ShellExecutionSourceContext;
  runtime: AutopilotToolPermissionRuntimeRecord;
};

export type ShellExecutionAttentionRecord =
  | IssueAttentionRecord
  | ApprovalAttentionRecord
  | RuntimeAttentionRecord;

export function humanizeAttentionToken(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function executionIssueSeverityTone(severity: string) {
  if (severity === "critical" || severity === "high") return "danger" as const;
  if (severity === "medium") return "warning" as const;
  return "neutral" as const;
}

export function executionStatusTone(status: string) {
  if (status === "pending" || status === "open") return "warning" as const;
  if (status === "approved" || status === "allowed" || status === "resolved") {
    return "success" as const;
  }
  if (status === "rejected" || status === "denied") return "danger" as const;
  return "neutral" as const;
}

export function executionSourceTone(sourceKind: string) {
  if (sourceKind === "intake_session") return "info" as const;
  if (sourceKind === "execution_brief") return "success" as const;
  return "neutral" as const;
}

export function executionSourceLabel(sourceKind?: string) {
  if (sourceKind === "intake_session") return "intake session";
  if (sourceKind === "execution_brief") return "execution brief";
  return (sourceKind || "local_brief").replace(/[_-]+/g, " ");
}
