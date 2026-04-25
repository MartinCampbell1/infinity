import type { WorkspaceToHostMessage } from "./server/control-plane/contracts/workspace-launch";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function messageType(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return typeof value.type === "string" ? value.type : null;
}

function isWorkspaceRuntimeBridgeWorkspaceMessage(
  value: unknown
): value is Exclude<WorkspaceToHostMessage, { type: "workspace.producer.batch" }> {
  if (!isRecord(value) || !isNonEmptyString(value.type)) {
    return false;
  }

  if (value.type === "workspace.ready") {
    return true;
  }

  if (value.type === "workspace.session.updated") {
    return (
      isRecord(value.payload) &&
      (value.payload.title === undefined || typeof value.payload.title === "string") &&
      (value.payload.status === undefined || typeof value.payload.status === "string") &&
      (isNonEmptyString(value.payload.title) || isNonEmptyString(value.payload.status))
    );
  }

  if (value.type === "workspace.tool.started") {
    return (
      isRecord(value.payload) &&
      isNonEmptyString(value.payload.toolName) &&
      isNonEmptyString(value.payload.eventId)
    );
  }

  if (value.type === "workspace.tool.completed") {
    return (
      isRecord(value.payload) &&
      isNonEmptyString(value.payload.toolName) &&
      isNonEmptyString(value.payload.eventId) &&
      (value.payload.status === "completed" || value.payload.status === "failed")
    );
  }

  if (value.type === "workspace.approval.requested") {
    return (
      isRecord(value.payload) &&
      isNonEmptyString(value.payload.approvalId) &&
      isNonEmptyString(value.payload.summary)
    );
  }

  if (value.type === "workspace.file.opened") {
    return isRecord(value.payload) && isNonEmptyString(value.payload.path);
  }

  if (value.type === "workspace.error") {
    return isRecord(value.payload) && isNonEmptyString(value.payload.message);
  }

  if (value.type === "workspace.deepLink") {
    return (
      isRecord(value.payload) &&
      isNonEmptyString(value.payload.sessionId) &&
      (value.payload.filePath === undefined || typeof value.payload.filePath === "string") &&
      (value.payload.anchor === undefined || typeof value.payload.anchor === "string")
    );
  }

  return false;
}

export function parseWorkspaceMessage(value: unknown): WorkspaceToHostMessage | null {
  const type = messageType(value);
  if (!type || !type.startsWith("workspace.")) {
    return null;
  }

  if (type === "workspace.producer.batch") {
    if (
      !isRecord(value) ||
      !isRecord(value.payload) ||
      value.payload.producer !== "workspace_runtime_bridge" ||
      !Array.isArray(value.payload.messages) ||
      value.payload.messages.length === 0 ||
      !value.payload.messages.every((message) =>
        isWorkspaceRuntimeBridgeWorkspaceMessage(message)
      )
    ) {
      return null;
    }

    return value as WorkspaceToHostMessage;
  }

  if (!isWorkspaceRuntimeBridgeWorkspaceMessage(value)) {
    return null;
  }

  return value as WorkspaceToHostMessage;
}
