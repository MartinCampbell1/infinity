"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ShellRouteScope } from "@/lib/route-scope";
import {
  buildExecutionAccountsScopeHref,
  buildExecutionAuditScopeHref,
  buildExecutionAuditsScopeHref,
  buildExecutionGroupsScopeHref,
  buildExecutionRecoveriesScopeHref,
  buildExecutionSessionsScopeHref,
} from "@/lib/route-scope";
import type {
  ApprovalDecision,
  ApprovalRequest,
} from "@/lib/server/control-plane/contracts/approvals";
import type {
  OperatorActionAuditEvent,
} from "@/lib/server/control-plane/contracts/operator-actions";
import type {
  RecoveryActionKind,
  RecoveryIncident,
} from "@/lib/server/control-plane/contracts/recoveries";
import type {
  ExecutionSessionSummary,
  NormalizedExecutionEvent,
} from "@/lib/server/control-plane/contracts/session-events";
import type {
  HostToWorkspaceMessage,
  SessionWorkspaceHostContext,
  WorkspaceLaunchViewModel,
  WorkspaceRuntimeIngestResponse,
  WorkspaceToHostMessage,
} from "@/lib/server/control-plane/contracts/workspace-launch";
import { buildWorkUiLaunchUrl } from "@/lib/server/control-plane/contracts/workspace-launch";

type HostConnectionState = "booting" | "awaiting_ready" | "ready" | "errored";

type HostSignal = {
  id: string;
  label: string;
  detail: string;
  at: string;
};

const MAX_HOST_SIGNALS = 18;
const HANDSHAKE_WARN_AFTER_MS = 12000;

type RuntimeIngestState = "idle" | "queued" | "posted" | "failed";
type OperatorActionState = "idle" | "posting" | "posted" | "failed";

type RecoveryState = ExecutionSessionSummary["recoveryState"];

function isRuntimeSnapshot(value: unknown): value is WorkspaceRuntimeIngestResponse["runtimeSnapshot"] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as WorkspaceRuntimeIngestResponse["runtimeSnapshot"];
  return (
    !!candidate.session &&
    typeof candidate.session === "object" &&
    typeof candidate.session.id === "string" &&
    !!candidate.hostContext &&
    typeof candidate.hostContext === "object" &&
    typeof candidate.hostContext.sessionId === "string" &&
    (candidate.latestEvent === null ||
      (typeof candidate.latestEvent === "object" &&
        typeof candidate.latestEvent?.id === "string"))
  );
}

function isRuntimeIngestResponse(value: unknown): value is WorkspaceRuntimeIngestResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as WorkspaceRuntimeIngestResponse;
  return (
    typeof candidate.source === "string" &&
    typeof candidate.storageKind === "string" &&
    typeof candidate.integrationState === "string" &&
    candidate.canonicalTruth === "sessionId" &&
    typeof candidate.accepted === "boolean" &&
    Array.isArray(candidate.persistedEvents) &&
    Array.isArray(candidate.touchedApprovals) &&
    Array.isArray(candidate.touchedRecoveries) &&
    isRuntimeSnapshot(candidate.runtimeSnapshot)
  );
}

function isApprovalRequestRecord(value: unknown): value is ApprovalRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as ApprovalRequest;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.status === "string"
  );
}

function isRecoveryIncidentRecord(value: unknown): value is RecoveryIncident {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as RecoveryIncident;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.status === "string"
  );
}

function isOperatorActionAuditEventRecord(
  value: unknown
): value is OperatorActionAuditEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as OperatorActionAuditEvent;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.targetId === "string" &&
    typeof candidate.targetKind === "string" &&
    typeof candidate.kind === "string" &&
    typeof candidate.outcome === "string"
  );
}

function isApprovalActionResponse(
  value: unknown
): value is {
  approvalRequest: ApprovalRequest;
  operatorAction: OperatorActionAuditEvent;
  accepted: boolean;
  idempotent: boolean;
  rejectedReason?: string | null;
  runtimeSnapshot: WorkspaceRuntimeIngestResponse["runtimeSnapshot"];
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    approvalRequest?: unknown;
    operatorAction?: unknown;
    accepted?: unknown;
    idempotent?: unknown;
    rejectedReason?: unknown;
    runtimeSnapshot?: unknown;
  };

  return (
    isApprovalRequestRecord(candidate.approvalRequest) &&
    isOperatorActionAuditEventRecord(candidate.operatorAction) &&
    typeof candidate.accepted === "boolean" &&
    typeof candidate.idempotent === "boolean" &&
    (candidate.rejectedReason === undefined ||
      candidate.rejectedReason === null ||
      typeof candidate.rejectedReason === "string") &&
    isRuntimeSnapshot(candidate.runtimeSnapshot)
  );
}

function isRecoveryActionResponse(
  value: unknown
): value is {
  recoveryIncident: RecoveryIncident;
  operatorAction: OperatorActionAuditEvent;
  accepted: boolean;
  idempotent: boolean;
  rejectedReason?: string | null;
  runtimeSnapshot: WorkspaceRuntimeIngestResponse["runtimeSnapshot"];
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    recoveryIncident?: unknown;
    operatorAction?: unknown;
    accepted?: unknown;
    idempotent?: unknown;
    rejectedReason?: unknown;
    runtimeSnapshot?: unknown;
  };

  return (
    isRecoveryIncidentRecord(candidate.recoveryIncident) &&
    isOperatorActionAuditEventRecord(candidate.operatorAction) &&
    typeof candidate.accepted === "boolean" &&
    typeof candidate.idempotent === "boolean" &&
    (candidate.rejectedReason === undefined ||
      candidate.rejectedReason === null ||
      typeof candidate.rejectedReason === "string") &&
    isRuntimeSnapshot(candidate.runtimeSnapshot)
  );
}

function formatValue(value?: string | null) {
  return value || "n/a";
}

function nowLabel() {
  return new Date().toISOString();
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function messageType(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybeType = (value as { type?: unknown }).type;
  return typeof maybeType === "string" ? maybeType : null;
}

function pushSignal(
  previous: HostSignal[],
  next: HostSignal
): HostSignal[] {
  const merged = [next, ...previous];
  if (merged.length <= MAX_HOST_SIGNALS) {
    return merged;
  }
  return merged.slice(0, MAX_HOST_SIGNALS);
}

function parseWorkspaceMessage(value: unknown): WorkspaceToHostMessage | null {
  const type = messageType(value);
  if (!type || !type.startsWith("workspace.")) {
    return null;
  }

  return value as WorkspaceToHostMessage;
}

function supportsRuntimeIngest(message: WorkspaceToHostMessage) {
  return (
    message.type === "workspace.ready" ||
    message.type === "workspace.session.updated" ||
    message.type === "workspace.producer.batch"
  );
}

function runtimeIngestRoute(sessionId: string) {
  return `/api/control/execution/workspace/${encodeURIComponent(sessionId)}/runtime`;
}

function mergeLatestById<T extends { id: string }>(
  previous: readonly T[],
  incoming: readonly T[]
) {
  const next = new Map<string, T>();

  for (const item of incoming) {
    next.set(item.id, item);
  }

  for (const item of previous) {
    if (!next.has(item.id)) {
      next.set(item.id, item);
    }
  }

  return Array.from(next.values()).slice(0, 6);
}

function formatRuntimeEventSignal(
  event: NormalizedExecutionEvent | null,
  response: WorkspaceRuntimeIngestResponse
): HostSignal | null {
  if (!event) {
    return null;
  }

  const detailParts = [
    `kind=${event.kind}`,
    response.source ? `source=${response.source}` : null,
    response.storageKind ? `storage=${response.storageKind}` : null,
    response.integrationState ? `integration=${response.integrationState}` : null,
    event.status ? `status=${event.status}` : null,
    event.phase ? `phase=${event.phase}` : null,
    response.touchedApprovals.length ? `approvals=${response.touchedApprovals.length}` : null,
    response.touchedRecoveries.length ? `recoveries=${response.touchedRecoveries.length}` : null,
  ].filter((part): part is string => Boolean(part));

  return {
    id: event.id,
    label: event.summary || event.kind,
    detail: detailParts.join(" · "),
    at: event.timestamp,
  };
}

function formatSnapshotEventSignal(event: NormalizedExecutionEvent | null): HostSignal | null {
  if (!event) {
    return null;
  }

  const detailParts = [
    `kind=${event.kind}`,
    event.status ? `status=${event.status}` : null,
    event.phase ? `phase=${event.phase}` : null,
  ].filter((part): part is string => Boolean(part));

  return {
    id: event.id,
    label: event.summary || event.kind,
    detail: detailParts.join(" · "),
    at: event.timestamp,
  };
}

function ExecutionWorkspaceHandoffRuntime({
  viewModel,
  hostContext,
  routeScope,
  hostOrigin,
}: {
  viewModel: WorkspaceLaunchViewModel;
  hostContext: SessionWorkspaceHostContext;
  routeScope?: ShellRouteScope;
  hostOrigin: string | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bootstrapIntervalRef = useRef<number | null>(null);
  const readyRef = useRef(false);

  const [connectionState, setConnectionState] =
    useState<HostConnectionState>(hostOrigin ? "awaiting_ready" : "errored");
  const [runtimeIngestState, setRuntimeIngestState] =
    useState<RuntimeIngestState>("idle");
  const [runtimeIngestDetail, setRuntimeIngestDetail] =
    useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(
    hostOrigin ? null : "Invalid embedded workspace origin."
  );
  const [hostContextState, setHostContextState] =
    useState<SessionWorkspaceHostContext>(hostContext);
  const hostContextRef = useRef(hostContextState);
  const [workspaceReadyAt, setWorkspaceReadyAt] = useState<string | null>(null);
  const [handshakeDelayed, setHandshakeDelayed] = useState(false);
  const [signals, setSignals] = useState<HostSignal[]>([
    {
      id: `boot-${hostContext.sessionId}`,
      label: "Host boot",
      detail: `Opened ${hostContext.sessionId} from ${hostContext.openedFrom}`,
      at: viewModel.launchTokenIssuedAt,
    },
  ]);
  const [sessionTitle, setSessionTitle] = useState(viewModel.sessionTitle);
  const [sessionStatus, setSessionStatus] = useState<string>(viewModel.status);
  const [sessionPhase, setSessionPhase] = useState<string | null>(viewModel.phase ?? null);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("none");
  const [lastRuntimeEvent, setLastRuntimeEvent] = useState<HostSignal | null>(null);
  const [approvalTouches, setApprovalTouches] = useState<ApprovalRequest[]>([]);
  const [recoveryTouches, setRecoveryTouches] = useState<RecoveryIncident[]>([]);
  const [auditTouches, setAuditTouches] = useState<OperatorActionAuditEvent[]>([]);
  const [operatorActionState, setOperatorActionState] =
    useState<OperatorActionState>("idle");
  const [operatorActionDetail, setOperatorActionDetail] = useState<string | null>(null);
  const [showDiagnosticsPanel, setShowDiagnosticsPanel] = useState(false);

  const embedUrl = useMemo(
    () =>
      buildWorkUiLaunchUrl(
        viewModel.workUiBaseUrl,
        {
          projectId: viewModel.projectId,
          sessionId: viewModel.sessionId,
          groupId: viewModel.groupId,
          accountId: viewModel.accountId,
          workspaceId: viewModel.workspaceId,
        },
        viewModel.workUiLaunchPath,
        {
          openedFrom: viewModel.openedFrom || "unknown",
          hostOrigin,
          embedded: true,
          launchToken: viewModel.launchToken,
        }
      ),
    [hostOrigin, viewModel]
  );
  const standaloneUrl = useMemo(
    () =>
      buildWorkUiLaunchUrl(
        viewModel.workUiBaseUrl,
        {
          projectId: viewModel.projectId,
          sessionId: viewModel.sessionId,
          groupId: viewModel.groupId,
          accountId: viewModel.accountId,
          workspaceId: viewModel.workspaceId,
        },
        viewModel.workUiLaunchPath,
        {
          openedFrom: viewModel.openedFrom || "unknown",
          hostOrigin,
          launchToken: viewModel.launchToken,
        }
      ),
    [hostOrigin, viewModel]
  );
  const expectedOrigin = useMemo(() => normalizeOrigin(embedUrl), [embedUrl]);

  const postHostMessage = useCallback(
    (message: HostToWorkspaceMessage) => {
      const frame = iframeRef.current;
      if (!frame?.contentWindow || !expectedOrigin) {
        return false;
      }

      frame.contentWindow.postMessage(message, expectedOrigin);
      return true;
    },
    [expectedOrigin]
  );

  const sendBootstrap = useCallback(
    () => postHostMessage({ type: "founderos.bootstrap", payload: hostContextRef.current }),
    [postHostMessage]
  );
  const sendSessionMeta = useCallback(
    (payload?: SessionWorkspaceHostContext) =>
      postHostMessage({
        type: "founderos.session.meta",
        payload: payload ?? hostContextRef.current,
      }),
    [postHostMessage]
  );

  const syncHostContextState = useCallback(
    (next: SessionWorkspaceHostContext, reason?: string) => {
      setHostContextState(next);
      hostContextRef.current = next;

      if (!readyRef.current) {
        return;
      }

      sendSessionMeta(next);
      if (reason) {
        setSignals((previous) =>
          pushSignal(previous, {
            id: `meta-${Date.now()}`,
            label: "Session meta sync",
            detail: reason,
            at: nowLabel(),
          })
        );
      }
    },
    [sendSessionMeta]
  );

  const postRuntimeIngest = useCallback(
    (
      message:
        | WorkspaceToHostMessage
        | Extract<HostToWorkspaceMessage, { type: "founderos.account.switch" | "founderos.session.retry" }>
    ) => {
      setRuntimeIngestState("queued");
      setRuntimeIngestDetail(null);

      void fetch(runtimeIngestRoute(hostContextRef.current.sessionId), {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(
          message.type === "workspace.producer.batch"
            ? {
                hostContext: hostContextRef.current,
                producer: message.payload.producer,
                messages: message.payload.messages,
              }
            : {
                hostContext: hostContextRef.current,
                message,
              }
        ),
      })
        .then(async (response) => {
          let body: WorkspaceRuntimeIngestResponse | { detail?: string } | null = null;
          try {
            body = (await response.json()) as WorkspaceRuntimeIngestResponse | { detail?: string };
          } catch {
            body = null;
          }

          if (!response.ok) {
            setRuntimeIngestState("failed");
            setRuntimeIngestDetail(
              (body && "detail" in body && typeof body.detail === "string"
                ? body.detail
                : `runtime ingest failed (${response.status})`)
            );
            return;
          }

          setRuntimeIngestState("posted");
          setRuntimeIngestDetail(
            isRuntimeIngestResponse(body) &&
              body.storageKind &&
              body.integrationState
              ? `${body.storageKind} · ${body.integrationState}`
              : "accepted"
          );
          if (isRuntimeIngestResponse(body)) {
            const runtimeSnapshot = body.runtimeSnapshot;
            const latestRuntimeSignal = formatRuntimeEventSignal(
              runtimeSnapshot.latestEvent,
              body
            );

            syncHostContextState(
              runtimeSnapshot.hostContext,
              "Host pushed founderos.session.meta"
            );
            setSessionTitle(runtimeSnapshot.session.title);
            setSessionStatus(runtimeSnapshot.session.status);
            setSessionPhase(runtimeSnapshot.session.phase ?? null);
            setRecoveryState(runtimeSnapshot.session.recoveryState);
            setLastRuntimeEvent(latestRuntimeSignal);
            setApprovalTouches((previous) =>
              mergeLatestById(previous, body.touchedApprovals)
            );
            setRecoveryTouches((previous) =>
              mergeLatestById(previous, body.touchedRecoveries)
            );
          }
        })
        .catch(() => {
          setRuntimeIngestState("failed");
          setRuntimeIngestDetail("network error");
        });
    },
    [syncHostContextState]
  );

  const applyRuntimeSnapshot = useCallback(
    (
      runtimeSnapshot: WorkspaceRuntimeIngestResponse["runtimeSnapshot"],
      options?: {
        approvalRequest?: ApprovalRequest | null;
        recoveryIncident?: RecoveryIncident | null;
      }
    ) => {
      syncHostContextState(
        runtimeSnapshot.hostContext,
        "Host pushed founderos.session.meta"
      );
      setSessionTitle(runtimeSnapshot.session.title);
      setSessionStatus(runtimeSnapshot.session.status);
      setSessionPhase(runtimeSnapshot.session.phase ?? null);
      setRecoveryState(runtimeSnapshot.session.recoveryState);
      setLastRuntimeEvent(formatSnapshotEventSignal(runtimeSnapshot.latestEvent));

      if (options?.approvalRequest) {
        setApprovalTouches((previous) =>
          mergeLatestById(previous, [options.approvalRequest as ApprovalRequest])
        );
      }

      if (options?.recoveryIncident) {
        setRecoveryTouches((previous) =>
          mergeLatestById(previous, [options.recoveryIncident as RecoveryIncident])
        );
      }
    },
    [syncHostContextState]
  );

  useEffect(() => {
    if (!expectedOrigin) {
      return;
    }

    const tick = () => {
      if (readyRef.current) {
        return;
      }

      sendBootstrap();
    };

    tick();
    bootstrapIntervalRef.current = window.setInterval(tick, 1200);

    return () => {
      if (bootstrapIntervalRef.current) {
        window.clearInterval(bootstrapIntervalRef.current);
        bootstrapIntervalRef.current = null;
      }
    };
  }, [expectedOrigin, postRuntimeIngest, sendBootstrap, sendSessionMeta]);

  useEffect(() => {
    if (connectionState !== "awaiting_ready") {
      return;
    }

    const timer = window.setTimeout(() => {
      if (readyRef.current) {
        return;
      }
      setHandshakeDelayed(true);
      setSignals((previous) =>
        pushSignal(previous, {
          id: `delayed-${Date.now()}`,
          label: "Handshake delayed",
          detail: `No workspace.ready after ${Math.floor(
            HANDSHAKE_WARN_AFTER_MS / 1000
          )}s`,
          at: nowLabel(),
        })
      );
    }, HANDSHAKE_WARN_AFTER_MS);

    return () => window.clearTimeout(timer);
  }, [connectionState]);

  useEffect(() => {
    if (!expectedOrigin) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== expectedOrigin) {
        return;
      }

      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const message = parseWorkspaceMessage(event.data);
      if (!message) {
        return;
      }

      if (supportsRuntimeIngest(message)) {
        postRuntimeIngest(message);
      }

      if (message.type === "workspace.ready") {
        readyRef.current = true;
        setHandshakeDelayed(false);
        setConnectionState("ready");
        setWorkspaceReadyAt(nowLabel());
        if (bootstrapIntervalRef.current) {
          window.clearInterval(bootstrapIntervalRef.current);
          bootstrapIntervalRef.current = null;
        }
        sendBootstrap();
        sendSessionMeta();
        setSignals((previous) =>
          pushSignal(previous, {
            id: `ready-${Date.now()}`,
            label: "Workspace ready",
            detail:
              "Received workspace.ready and refreshed bootstrap context · runtime-ingest queued",
            at: nowLabel(),
          })
        );
        return;
      }

      if (message.type === "workspace.producer.batch") {
        return;
      }

      if (message.type === "workspace.session.updated") {
        setSignals((previous) =>
          pushSignal(previous, {
            id: `session-${Date.now()}`,
            label: "Session updated",
            detail:
              message.payload?.title ||
              message.payload?.status ||
              "Workspace reported session metadata update · runtime-ingest queued",
            at: nowLabel(),
          })
        );
        return;
      }

      if (message.type === "workspace.tool.started") {
        setSignals((previous) =>
          pushSignal(previous, {
            id: `${message.payload.eventId}-started`,
            label: "Tool started",
            detail: `${message.payload.toolName} (${message.payload.eventId}) · runtime-ingest queued`,
            at: nowLabel(),
          })
        );
        return;
      }

      if (message.type === "workspace.tool.completed") {
        setSignals((previous) =>
          pushSignal(previous, {
            id: `${message.payload.eventId}-completed`,
            label: "Tool completed",
            detail: `${message.payload.toolName}: ${message.payload.status} · runtime-ingest queued`,
            at: nowLabel(),
          })
        );
        return;
      }

      if (message.type === "workspace.approval.requested") {
        setSignals((previous) =>
          pushSignal(previous, {
            id: message.payload.approvalId,
            label: "Approval requested",
            detail: `${message.payload.summary} · runtime-ingest queued`,
            at: nowLabel(),
          })
        );
        return;
      }

      if (message.type === "workspace.file.opened") {
        setSignals((previous) =>
          pushSignal(previous, {
            id: `file-${Date.now()}`,
            label: "File opened",
            detail: `${message.payload.path} · runtime-ingest queued`,
            at: nowLabel(),
          })
        );
        return;
      }

      if (message.type === "workspace.deepLink") {
        setSignals((previous) =>
          pushSignal(previous, {
            id: `deeplink-${Date.now()}`,
            label: "Deep link",
            detail: `${message.payload.sessionId}${
              message.payload.filePath ? ` -> ${message.payload.filePath}` : ""
            }`,
            at: nowLabel(),
          })
        );
        return;
      }

      if (message.type === "workspace.error") {
        const description = message.payload.message || "Unknown workspace error";
        readyRef.current = false;
        setConnectionState("errored");
        setLastError(
          message.payload.code
            ? `${message.payload.code}: ${description}`
            : description
        );
        setSignals((previous) =>
          pushSignal(previous, {
            id: `error-${Date.now()}`,
            label: "Workspace error",
            detail: `${description} · runtime-ingest queued`,
            at: nowLabel(),
          })
        );
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [expectedOrigin, postRuntimeIngest, sendBootstrap, sendSessionMeta]);

  const sendFocus = (section: "chat" | "files" | "approvals" | "diff") => {
    const posted = postHostMessage({
      type: "founderos.session.focus",
      payload: { section },
    });
    if (!posted) {
      setSignals((previous) =>
        pushSignal(previous, {
          id: `focus-dropped-${Date.now()}`,
          label: "Host message dropped",
          detail: `Could not send focus.${section} before iframe target was ready`,
          at: nowLabel(),
        })
      );
    }
  };

  const runApprovalDecision = useCallback(
    async (decision: ApprovalDecision) => {
      const approvalRequest =
        approvalTouches.find((request) => request.status === "pending") ?? approvalTouches[0];

      if (!approvalRequest) {
        setOperatorActionState("failed");
        setOperatorActionDetail("No approval request available in host state.");
        return;
      }

      setOperatorActionState("posting");
      setOperatorActionDetail(`${decision} queued`);

      try {
        const response = await fetch(
          `/api/control/execution/approvals/${encodeURIComponent(
            approvalRequest.id
          )}/respond`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ decision }),
          }
        );
        const body = (await response.json().catch(() => null)) as unknown;

        if (!isApprovalActionResponse(body)) {
          setOperatorActionState("failed");
          setOperatorActionDetail(`Approval action failed (${response.status})`);
          return;
        }

        applyRuntimeSnapshot(body.runtimeSnapshot, {
          approvalRequest: body.approvalRequest,
        });
        setAuditTouches((previous) => mergeLatestById(previous, [body.operatorAction]));
        setOperatorActionState(body.accepted ? "posted" : "failed");
        setOperatorActionDetail(
          body.accepted
            ? `${decision} · ${body.approvalRequest.status}`
            : body.rejectedReason || `${decision} rejected`
        );
        setSignals((previous) =>
          pushSignal(previous, {
            id: `approval-action-${approvalRequest.id}-${Date.now()}`,
            label: body.accepted ? "Approval action applied" : "Approval action rejected",
            detail: body.accepted
              ? `${decision} -> ${body.approvalRequest.status} · audit ${body.operatorAction.id}`
              : body.rejectedReason || `${decision} rejected`,
            at: nowLabel(),
          })
        );
      } catch {
        setOperatorActionState("failed");
        setOperatorActionDetail("Approval action network error");
      }
    },
    [approvalTouches, applyRuntimeSnapshot]
  );

  const runRecoveryAction = useCallback(
    async (actionKind: RecoveryActionKind) => {
      const recoveryIncident = recoveryTouches[0];

      if (!recoveryIncident) {
        setOperatorActionState("failed");
        setOperatorActionDetail("No recovery incident available in host state.");
        return;
      }

      setOperatorActionState("posting");
      setOperatorActionDetail(`${actionKind} queued`);

      try {
        const response = await fetch(
          `/api/control/execution/recoveries/${encodeURIComponent(recoveryIncident.id)}`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ actionKind }),
          }
        );
        const body = (await response.json().catch(() => null)) as unknown;

        if (!isRecoveryActionResponse(body)) {
          setOperatorActionState("failed");
          setOperatorActionDetail(`Recovery action failed (${response.status})`);
          return;
        }

        applyRuntimeSnapshot(body.runtimeSnapshot, {
          recoveryIncident: body.recoveryIncident,
        });
        setAuditTouches((previous) => mergeLatestById(previous, [body.operatorAction]));
        const retryMode =
          actionKind === "failover" ? "fallback_account" : "same_account";
        if (actionKind === "retry" || actionKind === "failover") {
          postHostMessage({
            type: "founderos.session.retry",
            payload: { retryMode },
          });
        }
        setOperatorActionState(body.accepted ? "posted" : "failed");
        setOperatorActionDetail(
          body.accepted
            ? `${actionKind} · ${body.recoveryIncident.status}`
            : body.rejectedReason || `${actionKind} rejected`
        );
        setSignals((previous) =>
          pushSignal(previous, {
            id: `recovery-action-${recoveryIncident.id}-${Date.now()}`,
            label: body.accepted ? "Recovery action applied" : "Recovery action rejected",
            detail: body.accepted
              ? `${actionKind} -> ${body.recoveryIncident.status} · audit ${body.operatorAction.id}`
              : body.rejectedReason || `${actionKind} rejected`,
            at: nowLabel(),
          })
        );
      } catch {
        setOperatorActionState("failed");
        setOperatorActionDetail("Recovery action network error");
      }
    },
    [applyRuntimeSnapshot, postHostMessage, recoveryTouches]
  );

  const sendRetry = (retryMode: "same_account" | "fallback_account") => {
    if (
      recoveryTouches[0] &&
      ((retryMode === "same_account" &&
        (recoveryTouches[0].status === "retryable" ||
          recoveryTouches[0].status === "open")) ||
        (retryMode === "fallback_account" &&
          (recoveryTouches[0].status === "retryable" ||
            recoveryTouches[0].status === "open" ||
            recoveryTouches[0].status === "failing_over")))
    ) {
      void runRecoveryAction(
        retryMode === "fallback_account" ? "failover" : "retry"
      );
      return;
    }

    const posted = postHostMessage({
      type: "founderos.session.retry",
      payload: { retryMode },
    });
    postRuntimeIngest({
      type: "founderos.session.retry",
      payload: { retryMode },
    });
    setSignals((previous) =>
      pushSignal(previous, {
        id: `retry-mode-${Date.now()}`,
        label: "Retry requested",
        detail: posted
          ? `Host sent ${retryMode} · runtime-ingest queued`
          : `Failed to send retry.${retryMode}; iframe target not ready · runtime-ingest queued`,
        at: nowLabel(),
      })
    );
  };

  const sendAccountSwitch = () => {
    if (!hostContextState.accountId) {
      setSignals((previous) =>
        pushSignal(previous, {
          id: `account-switch-skip-${Date.now()}`,
          label: "Account switch skipped",
          detail: "No accountId available in host context",
          at: nowLabel(),
        })
      );
      return;
    }

    const posted = postHostMessage({
      type: "founderos.account.switch",
      payload: { accountId: hostContextState.accountId },
    });
    postRuntimeIngest({
      type: "founderos.account.switch",
      payload: { accountId: hostContextState.accountId },
    });

    setSignals((previous) =>
      pushSignal(previous, {
        id: `account-switch-${Date.now()}`,
        label: "Account switch",
        detail: posted
          ? `Host sent ${hostContextState.accountId} · runtime-ingest queued`
          : `Failed to send ${hostContextState.accountId}; iframe target not ready · runtime-ingest queued`,
        at: nowLabel(),
      })
    );
  };

  const reloadIframe = () => {
    const frame = iframeRef.current;
    if (!frame) {
      return;
    }
    const currentEmbedUrl = buildWorkUiLaunchUrl(
      viewModel.workUiBaseUrl,
      hostContextRef.current,
      viewModel.workUiLaunchPath,
      {
        openedFrom: viewModel.openedFrom || "unknown",
        hostOrigin,
        embedded: true,
        launchToken: viewModel.launchToken,
      }
    );
    readyRef.current = false;
    setHandshakeDelayed(false);
    setConnectionState("awaiting_ready");
    frame.src = currentEmbedUrl;
    setSignals((previous) =>
      pushSignal(previous, {
        id: `reload-${Date.now()}`,
        label: "Workspace reloaded",
        detail: "Host reloaded the embedded workspace frame",
        at: nowLabel(),
      })
    );
  };

  const onIframeLoad = () => {
    if (readyRef.current) {
      return;
    }
    sendBootstrap();
    setSignals((previous) =>
      pushSignal(previous, {
        id: `iframe-load-${Date.now()}`,
        label: "Iframe loaded",
        detail: "Host resent bootstrap after iframe load",
        at: nowLabel(),
      })
    );
  };

  const retryBootstrap = () => {
    readyRef.current = false;
    setHandshakeDelayed(false);
    setConnectionState("awaiting_ready");
    sendBootstrap();
    setSignals((previous) =>
      pushSignal(previous, {
        id: `retry-${Date.now()}`,
        label: "Bootstrap retried",
        detail: "Host resent founderos.bootstrap",
        at: nowLabel(),
      })
    );
  };

  const canSendInteractiveMessages =
    connectionState === "ready" && lastError === null;
  const showAdvancedDiagnostics =
    handshakeDelayed ||
    Boolean(lastError) ||
    runtimeIngestState !== "idle" ||
    operatorActionState !== "idle" ||
    signals.length > 1;
  const diagnosticsSummary = lastError
    ? lastError
    : handshakeDelayed
      ? "workspace.ready is delayed"
      : runtimeIngestState !== "idle"
        ? `runtime ingest ${runtimeIngestState}`
        : operatorActionState !== "idle"
          ? `operator action ${operatorActionState}`
          : "Link metadata and host controls";

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-6 lg:px-6">
      <header className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/42">
          Execution / Workspace host
        </div>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-white">{sessionTitle}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/58">
              <span>project: {viewModel.projectName}</span>
              <span>session: {viewModel.sessionId}</span>
              <span>status: {sessionStatus}</span>
              <span>phase: {formatValue(sessionPhase)}</span>
              <span>provider: {viewModel.provider}</span>
              <span>model: {formatValue(hostContextState.model || viewModel.model)}</span>
              <span>pending approvals: {hostContextState.pendingApprovals ?? 0}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <a
              className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-white/78"
              href={buildExecutionSessionsScopeHref(routeScope)}
            >
              Sessions
            </a>
            <a
              className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-white/78"
              href={buildExecutionGroupsScopeHref(routeScope)}
            >
              Groups
            </a>
            <a
              className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-white/78"
              href={buildExecutionAccountsScopeHref(routeScope)}
            >
              Accounts
            </a>
            <a
              className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-white/78"
              href={buildExecutionRecoveriesScopeHref(routeScope)}
            >
              Recoveries
            </a>
            <a
              className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-white/78"
              href={buildExecutionAuditsScopeHref(routeScope)}
            >
              Audits
            </a>
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article
          className="rounded-2xl border border-white/8 bg-white/[0.03]"
          data-workspace-host="1"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/58">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1">
                workspace: {connectionState}
              </span>
              {handshakeDelayed ? (
                <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                  handshake delayed
                </span>
              ) : null}
              <span className="text-[11px] text-white/42">
                {hostContextState.openedFrom} · {formatValue(hostContextState.accountLabel || hostContextState.accountId)}
              </span>
            </div>
          </div>

          <div className="h-[72vh] min-h-[480px]">
            <iframe
              ref={iframeRef}
              className="h-full w-full rounded-b-2xl"
              onLoad={onIframeLoad}
              sandbox="allow-same-origin allow-scripts allow-forms allow-downloads allow-popups"
              src={embedUrl}
              title={`Workspace ${viewModel.sessionId}`}
            />
          </div>
        </article>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                  Workspace link
                </div>
                <div className="mt-2 text-sm text-white/78">
                  Embedded workspace is attached to the current shell session.
                </div>
                <div className="mt-1 text-xs text-white/58">
                  {diagnosticsSummary}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-[11px] text-white/78"
                  onClick={() => setShowDiagnosticsPanel((previous) => !previous)}
                  type="button"
                >
                  {showDiagnosticsPanel ? "Hide diagnostics" : "Open diagnostics"}
                </button>
                <a
                  className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-[11px] text-white/78"
                  href={standaloneUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open standalone
                </a>
              </div>
            </div>

            <dl className="mt-3 grid gap-3 text-sm text-white/78 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                  ready at
                </dt>
                <dd className="font-mono text-xs">
                  {workspaceReadyAt || "Awaiting workspace.ready"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                  account / approvals
                </dt>
                <dd className="text-xs text-white/58">
                  {formatValue(hostContextState.accountLabel || hostContextState.accountId)} ·{" "}
                  {hostContextState.pendingApprovals ?? 0} pending
                </dd>
              </div>
            </dl>
          </article>

          {showDiagnosticsPanel ? (
            <article className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                Diagnostics
              </div>
              <dl className="mt-3 space-y-3 text-sm text-white/78">
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                    expected origin
                  </dt>
                  <dd className="break-all font-mono text-xs">{expectedOrigin || "n/a"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                    launch marker
                  </dt>
                  <dd className="font-mono text-xs">founderos_launch=1</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                    launch token
                  </dt>
                  <dd className="font-mono text-xs">{viewModel.launchTokenState}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                    token boundary
                  </dt>
                  <dd className="text-xs text-white/58">{viewModel.launchTokenBoundaryNote}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                    last runtime event
                  </dt>
                  <dd className="text-xs text-white/58">
                    {lastRuntimeEvent
                      ? `${lastRuntimeEvent.label} · ${lastRuntimeEvent.detail}`
                      : "n/a"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                    ingest state
                  </dt>
                  <dd className="font-mono text-xs">
                    {runtimeIngestState}
                    {runtimeIngestDetail ? ` · ${runtimeIngestDetail}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                    operator action
                  </dt>
                  <dd className="font-mono text-xs">
                    {operatorActionState}
                    {operatorActionDetail ? ` · ${operatorActionDetail}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                    audit lane
                  </dt>
                  <dd className="text-xs text-white/58">
                    {auditTouches[0]
                      ? `${auditTouches[0].summary} · ${auditTouches[0].outcome}`
                      : "No operator audit touches yet."}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                    host actions
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    <button
                      className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78 disabled:opacity-50"
                      onClick={() => sendFocus("files")}
                      disabled={!canSendInteractiveMessages}
                      type="button"
                    >
                      Focus files
                    </button>
                    <button
                      className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78 disabled:opacity-50"
                      onClick={() => sendFocus("diff")}
                      disabled={!canSendInteractiveMessages}
                      type="button"
                    >
                      Focus diff
                    </button>
                    <button
                      className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78"
                      onClick={() => sendRetry("same_account")}
                      type="button"
                    >
                      Retry same account
                    </button>
                    <button
                      className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78"
                      onClick={() => sendRetry("fallback_account")}
                      type="button"
                    >
                      Retry fallback
                    </button>
                    <button
                      className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78"
                      onClick={retryBootstrap}
                      type="button"
                    >
                      Retry bootstrap
                    </button>
                    <button
                      className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78"
                      onClick={sendAccountSwitch}
                      type="button"
                    >
                      Sync account
                    </button>
                    <button
                      className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78"
                      onClick={reloadIframe}
                      type="button"
                    >
                      Reload frame
                    </button>
                  </dd>
                </div>
              </dl>
              <div className="mt-4 border-t border-white/8 pt-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                  Live shell state
                </div>
                <dl className="mt-3 space-y-3 text-sm text-white/78">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                      session
                    </dt>
                    <dd className="text-xs text-white/58">
                      {sessionTitle} · {sessionStatus} · {formatValue(sessionPhase)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                      account / quota
                    </dt>
                    <dd className="text-xs text-white/58">
                      {formatValue(hostContextState.accountLabel || hostContextState.accountId)} ·{" "}
                      {hostContextState.quotaState?.pressure || "unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                      latest approval
                    </dt>
                    <dd className="text-xs text-white/58">
                      {approvalTouches[0]
                        ? `${approvalTouches[0].summary} · ${approvalTouches[0].status}`
                        : "No runtime approval touches yet."}
                    </dd>
                    {approvalTouches[0]?.status === "pending" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-sky-500/20 bg-sky-500/15 px-2.5 py-1 text-[11px] text-sky-100 disabled:opacity-50"
                          disabled={operatorActionState === "posting"}
                          onClick={() => void runApprovalDecision("approve_once")}
                          type="button"
                        >
                          Approve once
                        </button>
                        <button
                          className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78 disabled:opacity-50"
                          disabled={operatorActionState === "posting"}
                          onClick={() => void runApprovalDecision("approve_session")}
                          type="button"
                        >
                          Approve session
                        </button>
                        <button
                          className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78 disabled:opacity-50"
                          disabled={operatorActionState === "posting"}
                          onClick={() => void runApprovalDecision("approve_always")}
                          type="button"
                        >
                          Approve always
                        </button>
                        <button
                          className="rounded-full border border-rose-500/20 bg-rose-500/12 px-2.5 py-1 text-[11px] text-rose-100 disabled:opacity-50"
                          disabled={operatorActionState === "posting"}
                          onClick={() => void runApprovalDecision("deny")}
                          type="button"
                        >
                          Deny
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                      latest recovery
                    </dt>
                    <dd className="text-xs text-white/58">
                      {recoveryTouches[0]
                        ? `${recoveryTouches[0].summary} · ${recoveryTouches[0].status}`
                        : "No runtime recovery touches yet."}
                    </dd>
                    {recoveryTouches[0] ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {recoveryTouches[0].status === "retryable" ||
                        recoveryTouches[0].status === "open" ? (
                          <button
                            className="rounded-full border border-sky-500/20 bg-sky-500/15 px-2.5 py-1 text-[11px] text-sky-100 disabled:opacity-50"
                            disabled={operatorActionState === "posting"}
                            onClick={() => void runRecoveryAction("retry")}
                            type="button"
                          >
                            Retry
                          </button>
                        ) : null}
                        {recoveryTouches[0].status !== "recovered" ? (
                          <button
                            className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78 disabled:opacity-50"
                            disabled={operatorActionState === "posting"}
                            onClick={() => void runRecoveryAction("resolve")}
                            type="button"
                          >
                            Resolve
                          </button>
                        ) : null}
                        {recoveryTouches[0].status === "recovered" ||
                        recoveryTouches[0].status === "dead" ? (
                          <button
                            className="rounded-full border border-rose-500/20 bg-rose-500/12 px-2.5 py-1 text-[11px] text-rose-100 disabled:opacity-50"
                            disabled={operatorActionState === "posting"}
                            onClick={() => void runRecoveryAction("reopen")}
                            type="button"
                          >
                            Reopen
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.14em] text-white/42">
                      latest audit
                    </dt>
                    <dd className="text-xs text-white/58">
                      {auditTouches[0]
                        ? `${auditTouches[0].summary} · ${auditTouches[0].outcome}`
                        : "No operator audits recorded in this host rail yet."}
                    </dd>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78"
                        href={buildExecutionAuditsScopeHref(routeScope)}
                      >
                        Open audits
                      </a>
                      {auditTouches[0] ? (
                        <a
                          className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/78"
                          href={buildExecutionAuditScopeHref(auditTouches[0].id, routeScope)}
                        >
                          Latest audit
                        </a>
                      ) : null}
                    </div>
                  </div>
                </dl>
              </div>

              <div className="mt-4 border-t border-white/8 pt-4">
                <div className="text-xs uppercase tracking-[0.16em] text-white/42">
                  Host signals
                </div>
                <ul className="mt-3 space-y-2">
                  {signals.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-white/42">
                      Waiting for workspace events.
                    </li>
                  ) : (
                    signals.map((signal) => (
                      <li
                        key={signal.id}
                        className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                      >
                        <div className="text-xs font-medium text-white">{signal.label}</div>
                        <div className="mt-0.5 text-xs text-white/58">{signal.detail}</div>
                        <div className="mt-1 font-mono text-[10px] text-white/42">
                          {signal.at}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </article>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

export function ExecutionWorkspaceHandoffSurface({
  viewModel,
  hostContext,
  routeScope,
}: {
  viewModel: WorkspaceLaunchViewModel;
  hostContext: SessionWorkspaceHostContext;
  routeScope?: ShellRouteScope;
}) {
  const hostOrigin =
    viewModel.shellPublicOrigin ??
    (typeof window !== "undefined" ? window.location.origin : null);
  const runtimeKey = [
    viewModel.sessionId,
    viewModel.sessionTitle,
    viewModel.status,
    viewModel.phase ?? "",
    hostContext.sessionId,
    hostContext.openedFrom,
    hostContext.accountId ?? "",
    hostContext.groupId ?? "",
    hostContext.workspaceId ?? "",
    hostOrigin ?? "",
  ].join("|");

  return (
    <ExecutionWorkspaceHandoffRuntime
      key={runtimeKey}
      viewModel={viewModel}
      hostContext={hostContext}
      routeScope={routeScope}
      hostOrigin={hostOrigin}
    />
  );
}
