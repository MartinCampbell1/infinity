import { NextResponse } from "next/server";

import {
  buildApprovalRequestsDirectory,
  createApprovalRequest,
  isApprovalRequestKind,
} from "../../../../../lib/server/control-plane/approvals";
import type {
  ApprovalCreateRequest,
  ApprovalCreateResponse,
} from "../../../../../lib/server/control-plane/contracts/approvals";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildApprovalRequestsDirectory());
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalString(value: unknown): string | null | undefined {
  return value === undefined || value === null || typeof value === "string" ? value : null;
}

function parseApprovalCreateRequest(value: unknown): ApprovalCreateRequest | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    !isNonEmptyString(candidate.sessionId) ||
    !isNonEmptyString(candidate.projectId) ||
    !isNonEmptyString(candidate.projectName) ||
    !isApprovalRequestKind(candidate.requestKind) ||
    !isNonEmptyString(candidate.title) ||
    !isNonEmptyString(candidate.summary)
  ) {
    return null;
  }

  const id = optionalString(candidate.id);
  const externalSessionId = optionalString(candidate.externalSessionId);
  const groupId = optionalString(candidate.groupId);
  const accountId = optionalString(candidate.accountId);
  const workspaceId = optionalString(candidate.workspaceId);
  const reason = optionalString(candidate.reason);
  const expiresAt = optionalString(candidate.expiresAt);

  if (
    (candidate.id !== undefined && candidate.id !== null && id === null) ||
    (candidate.externalSessionId !== undefined &&
      candidate.externalSessionId !== null &&
      externalSessionId === null) ||
    (candidate.groupId !== undefined && candidate.groupId !== null && groupId === null) ||
    (candidate.accountId !== undefined && candidate.accountId !== null && accountId === null) ||
    (candidate.workspaceId !== undefined && candidate.workspaceId !== null && workspaceId === null) ||
    (candidate.reason !== undefined && candidate.reason !== null && reason === null) ||
    (candidate.expiresAt !== undefined && candidate.expiresAt !== null && expiresAt === null)
  ) {
    return null;
  }

  return {
    id: id?.trim() || null,
    sessionId: candidate.sessionId.trim(),
    externalSessionId: externalSessionId?.trim() || null,
    projectId: candidate.projectId.trim(),
    projectName: candidate.projectName.trim(),
    groupId: groupId?.trim() || null,
    accountId: accountId?.trim() || null,
    workspaceId: workspaceId?.trim() || null,
    requestKind: candidate.requestKind,
    title: candidate.title.trim(),
    summary: candidate.summary.trim(),
    reason: reason?.trim() || null,
    expiresAt: expiresAt?.trim() || null,
    raw:
      candidate.raw && typeof candidate.raw === "object" && !Array.isArray(candidate.raw)
        ? candidate.raw as Record<string, unknown>
        : null,
  };
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const input = parseApprovalCreateRequest(body);
  if (!input) {
    return NextResponse.json(
      {
        detail:
          "Request body must include sessionId, projectId, projectName, requestKind, title, and summary.",
      },
      { status: 400 }
    );
  }

  const approvalRequest = await createApprovalRequest(input);
  if (!approvalRequest) {
    return NextResponse.json(
      {
        detail: `Approval request ${input.id} already exists.`,
      },
      { status: 409 }
    );
  }

  const directory = await buildApprovalRequestsDirectory();
  const response: ApprovalCreateResponse = {
    generatedAt: directory.generatedAt,
    source: directory.source,
    storageKind: directory.storageKind,
    integrationState: directory.integrationState,
    canonicalTruth: directory.canonicalTruth,
    notes: directory.notes,
    approvalRequest,
    summary: directory.summary,
  };

  return NextResponse.json(response, { status: 201 });
}
