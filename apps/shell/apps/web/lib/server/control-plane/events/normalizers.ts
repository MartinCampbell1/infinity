import {
  buildNormalizedExecutionEventId,
  type ExecutionProvider,
  type ExecutionSessionPhase,
  type NormalizedExecutionEvent,
  type NormalizedExecutionEventKind,
} from "../contracts/session-events";

type JsonRecord = Record<string, unknown>;

export interface NormalizeCodexJsonlInput {
  lines: string[];
  sessionId: string;
  projectId: string;
  groupId?: string | null;
}

export interface NormalizeHermesSseInput {
  stream: string;
  sessionId: string;
  projectId: string;
  groupId?: string | null;
}

export interface NormalizeSupervisorNdjsonInput {
  lines: string[];
  sessionId?: string;
  projectId: string;
  groupId?: string | null;
}

interface EventSeed {
  kind: NormalizedExecutionEventKind;
  summary: string;
  status?: NormalizedExecutionEvent["status"];
  phase?: ExecutionSessionPhase | null;
  payload?: JsonRecord;
}

const PHASE_SET = new Set<ExecutionSessionPhase>([
  "planning",
  "acting",
  "validating",
  "blocked",
  "review",
  "completed",
  "unknown",
]);

const EVENT_KIND_SET = new Set<NormalizedExecutionEventKind>([
  "session.started",
  "session.updated",
  "turn.started",
  "turn.completed",
  "turn.failed",
  "agent.message.delta",
  "agent.message.completed",
  "tool.started",
  "tool.completed",
  "command.started",
  "command.completed",
  "approval.requested",
  "approval.resolved",
  "file.changed",
  "phase.changed",
  "quota.updated",
  "account.switched",
  "recovery.started",
  "recovery.completed",
  "error.raised",
]);

export function normalizeCodexJsonlEvents(
  input: NormalizeCodexJsonlInput
): NormalizedExecutionEvent[] {
  const events: NormalizedExecutionEvent[] = [];

  for (let index = 0; index < input.lines.length; index += 1) {
    const line = input.lines[index]?.trim();
    if (!line) {
      continue;
    }

    const raw = parseJsonRecord(line);
    if (!raw) {
      continue;
    }

    const seed = normalizeCodexRawEvent(raw);
    if (!seed) {
      continue;
    }

    events.push(
      buildEvent({
        sessionId: input.sessionId,
        projectId: input.projectId,
        groupId: input.groupId ?? null,
        source: "codex_jsonl",
        provider: "codex",
        ordinal: index,
        raw,
        seed,
      })
    );
  }

  return sortNormalizedEvents(events);
}

export function normalizeHermesSseEvents(
  input: NormalizeHermesSseInput
): NormalizedExecutionEvent[] {
  const blocks = parseSseBlocks(input.stream);
  const events: NormalizedExecutionEvent[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block) {
      continue;
    }

    const seed = normalizeHermesBlock(block);
    if (!seed) {
      continue;
    }

    events.push(
      buildEvent({
        sessionId: input.sessionId,
        projectId: input.projectId,
        groupId: input.groupId ?? null,
        source: "hermes_sse",
        provider: "hermes",
        ordinal: index,
        raw: block.raw,
        seed,
      })
    );
  }

  return sortNormalizedEvents(events);
}

export function normalizeSupervisorNdjsonEvents(
  input: NormalizeSupervisorNdjsonInput
): NormalizedExecutionEvent[] {
  const events: NormalizedExecutionEvent[] = [];

  for (let index = 0; index < input.lines.length; index += 1) {
    const line = input.lines[index]?.trim();
    if (!line) {
      continue;
    }
    const raw = parseJsonRecord(line);
    if (!raw) {
      continue;
    }
    const seed = normalizeSupervisorRawEvent(raw);
    if (!seed) {
      continue;
    }

    const sessionId =
      input.sessionId ||
      asString(raw.sessionId).trim() ||
      asString(raw.session_id).trim() ||
      "unknown_session";

    events.push(
      buildEvent({
        sessionId,
        projectId: input.projectId,
        groupId: input.groupId ?? null,
        source: "manual",
        provider: "mixed",
        ordinal: index,
        raw,
        seed,
      })
    );
  }

  return sortNormalizedEvents(events);
}

function normalizeCodexRawEvent(raw: JsonRecord): EventSeed | null {
  const rawType = asString(raw.type).toLowerCase();
  const item = asRecord(raw.item);
  const itemType = asString(item.type).toLowerCase();
  const status = normalizeStatus(raw.status ?? item.status);
  const phase = normalizePhase(raw.phase ?? item.phase);

  if (rawType === "thread.started" || rawType === "session.started") {
    return { kind: "session.started", summary: "Session started", status, phase, payload: raw };
  }
  if (
    rawType === "thread.updated" ||
    rawType === "session.updated" ||
    rawType === "thread.forked" ||
    rawType === "thread.resumed"
  ) {
    return { kind: "session.updated", summary: "Session updated", status, phase, payload: raw };
  }
  if (rawType === "turn.started") {
    return {
      kind: "turn.started",
      summary: "Turn started",
      status: status ?? "in_progress",
      phase,
      payload: raw,
    };
  }
  if (rawType === "turn.completed") {
    return {
      kind: "turn.completed",
      summary: "Turn completed",
      status: status ?? "completed",
      phase,
      payload: raw,
    };
  }
  if (rawType === "turn.failed") {
    return {
      kind: "turn.failed",
      summary: "Turn failed",
      status: status ?? "failed",
      phase,
      payload: raw,
    };
  }
  if (rawType === "error") {
    return {
      kind: "error.raised",
      summary: asString(raw.message) || "Runtime error",
      status: "failed",
      phase,
      payload: raw,
    };
  }
  if (rawType === "quota.updated") {
    return {
      kind: "quota.updated",
      summary: "Quota updated",
      status,
      phase,
      payload: raw,
    };
  }
  if (rawType === "phase.changed") {
    return {
      kind: "phase.changed",
      summary: asString(raw.summary) || "Phase changed",
      status,
      phase,
      payload: raw,
    };
  }
  if (rawType === "account.switched") {
    return {
      kind: "account.switched",
      summary: "Account switched",
      status,
      phase,
      payload: raw,
    };
  }
  if (rawType === "recovery.started") {
    return {
      kind: "recovery.started",
      summary: "Recovery started",
      status: status ?? "in_progress",
      phase,
      payload: raw,
    };
  }
  if (rawType === "recovery.completed") {
    return {
      kind: "recovery.completed",
      summary: "Recovery completed",
      status: status ?? "completed",
      phase,
      payload: raw,
    };
  }

  if (rawType === "item" || rawType.startsWith("item.")) {
    const entryType =
      itemType ||
      rawType.replace(/^item\./, "").replace(/\./g, "_").trim() ||
      "unknown";

    if (entryType === "agent_message" || entryType === "agent_message_delta") {
      const isDelta = status === "in_progress" || asString(item.phase) === "commentary";
      return {
        kind: isDelta ? "agent.message.delta" : "agent.message.completed",
        summary: asString(item.text) || "Agent message",
        status: status ?? (isDelta ? "in_progress" : "completed"),
        phase: isDelta ? phase : null,
        payload: raw,
      };
    }

    if (entryType === "command_execution") {
      const completed = status === "completed" || status === "failed";
      return {
        kind: completed ? "command.completed" : "command.started",
        summary: asString(item.command) || "Command activity",
        status: status ?? (completed ? "completed" : "in_progress"),
        phase,
        payload: raw,
      };
    }

    if (entryType === "tool_call" || entryType === "tool_use") {
      const completed = status === "completed" || status === "failed";
      return {
        kind: completed ? "tool.completed" : "tool.started",
        summary: asString(item.tool_name) || asString(item.toolName) || "Tool activity",
        status: status ?? (completed ? "completed" : "in_progress"),
        phase,
        payload: raw,
      };
    }

    if (entryType === "approval") {
      const requested = status !== "completed" && status !== "declined";
      return {
        kind: requested ? "approval.requested" : "approval.resolved",
        summary: asString(item.summary) || "Approval flow",
        status: status ?? (requested ? "in_progress" : "completed"),
        phase,
        payload: raw,
      };
    }

    if (entryType === "file_change") {
      return {
        kind: "file.changed",
        summary: asString(item.path) || "File changed",
        status,
        phase,
        payload: raw,
      };
    }
  }

  return {
    kind: "session.updated",
    summary: asString(rawType) || "Runtime update",
    status,
    phase,
    payload: raw,
  };
}

function normalizeHermesBlock(block: ParsedSseBlock): EventSeed | null {
  const eventName = block.event.toLowerCase();
  const payload = block.data ?? {};
  const phase = normalizePhase(payload.phase);
  const status = normalizeStatus(payload.status);

  if (EVENT_KIND_SET.has(eventName as NormalizedExecutionEventKind)) {
    return {
      kind: eventName as NormalizedExecutionEventKind,
      summary: resolveHermesSummary(eventName, payload),
      status,
      phase,
      payload,
    };
  }

  if (eventName === "message.delta") {
    return {
      kind: "agent.message.delta",
      summary: asString(payload.text) || "Agent delta",
      status: status ?? "in_progress",
      phase,
      payload,
    };
  }
  if (eventName === "message.completed" || eventName === "agent.message") {
    return {
      kind: "agent.message.completed",
      summary: asString(payload.text) || "Agent message",
      status: status ?? "completed",
      phase,
      payload,
    };
  }
  if (eventName === "tool") {
    const completed = status === "completed" || status === "failed";
    return {
      kind: completed ? "tool.completed" : "tool.started",
      summary: asString(payload.toolName) || "Tool activity",
      status: status ?? (completed ? "completed" : "in_progress"),
      phase,
      payload,
    };
  }
  if (eventName === "workspace.ready") {
    return {
      kind: "session.updated",
      summary: asString(payload.summary) || "Workspace ready",
      status: status ?? "completed",
      phase,
      payload,
    };
  }

  return null;
}

function normalizeSupervisorRawEvent(raw: JsonRecord): EventSeed | null {
  const eventName = asString(raw.event).toLowerCase();
  const phase = normalizePhase(raw.phase);
  const status = normalizeStatus(raw.status);

  if (eventName === "session.bound") {
    return {
      kind: "session.updated",
      summary: "Session binding updated",
      status: status ?? "completed",
      phase,
      payload: {
        ...raw,
        externalSessionId: asString(raw.externalId).trim() || undefined,
      },
    };
  }

  if (eventName === "approval.forwarded") {
    return {
      kind: "approval.requested",
      summary: asString(raw.summary) || "Approval forwarded to shell",
      status: status ?? "in_progress",
      phase: phase ?? "blocked",
      payload: raw,
    };
  }

  if (eventName === "recovery.decision") {
    return {
      kind: "recovery.started",
      summary: asString(raw.mode) || "Recovery decision applied",
      status: status ?? "in_progress",
      phase: phase ?? "blocked",
      payload: raw,
    };
  }

  if (eventName === "recovery.completed") {
    return {
      kind: "recovery.completed",
      summary: asString(raw.summary) || "Recovery completed",
      status: status ?? "completed",
      phase: phase ?? "completed",
      payload: raw,
    };
  }

  return {
    kind: "session.updated",
    summary: eventName || "Supervisor update",
    status,
    phase,
    payload: raw,
  };
}

function resolveHermesSummary(eventName: string, payload: JsonRecord): string {
  if (eventName === "approval.requested") {
    return asString(payload.summary) || "Approval requested";
  }
  if (eventName === "approval.resolved") {
    return asString(payload.summary) || "Approval resolved";
  }
  if (eventName === "tool.started" || eventName === "tool.completed") {
    return asString(payload.toolName) || "Tool activity";
  }
  if (eventName === "command.started" || eventName === "command.completed") {
    return asString(payload.command) || "Command activity";
  }
  if (eventName === "error.raised") {
    return asString(payload.message) || "Runtime error";
  }
  return asString(payload.summary) || eventName;
}

interface BuildEventInput {
  sessionId: string;
  projectId: string;
  groupId: string | null;
  source: NormalizedExecutionEvent["source"];
  provider: ExecutionProvider;
  ordinal: number;
  raw: JsonRecord;
  seed: EventSeed;
}

function buildEvent(input: BuildEventInput): NormalizedExecutionEvent {
  const timestamp = resolveTimestampCandidate(
    input.raw.timestamp ?? input.seed.payload?.timestamp,
    input.ordinal
  );

  const event: NormalizedExecutionEvent = {
    id: buildDeterministicId({
      sessionId: input.sessionId,
      source: input.source,
      kind: input.seed.kind,
      timestamp,
      ordinal: input.ordinal,
    }),
    sessionId: input.sessionId,
    projectId: input.projectId,
    groupId: input.groupId,
    source: input.source,
    provider: input.provider,
    kind: input.seed.kind,
    status: input.seed.status ?? "unknown",
    phase: input.seed.phase ?? null,
    timestamp,
    summary: input.seed.summary,
    payload: input.seed.payload ?? {},
    raw: input.raw,
  };

  return event;
}

function buildDeterministicId(args: {
  sessionId: string;
  source: NormalizedExecutionEvent["source"];
  kind: NormalizedExecutionEventKind;
  timestamp: string;
  ordinal: number;
}) {
  return buildNormalizedExecutionEventId({
    sessionId: args.sessionId,
    source: args.source,
    kind: args.kind,
    timestamp: args.timestamp,
    ordinal: args.ordinal,
  });
}

function resolveTimestampCandidate(candidate: unknown, ordinal: number) {
  const ts = asString(candidate).trim();
  if (ts) {
    return ts;
  }
  return new Date(Date.UTC(1970, 0, 1, 0, 0, 0, ordinal)).toISOString();
}

function normalizeStatus(value: unknown): NormalizedExecutionEvent["status"] | undefined {
  const status = asString(value).toLowerCase();
  if (status === "running" || status === "started" || status === "pending") {
    return "in_progress";
  }
  if (status === "ok" || status === "success" || status === "succeeded") {
    return "completed";
  }
  if (status === "error" || status === "timeout") {
    return "failed";
  }
  if (status === "denied" || status === "rejected") {
    return "declined";
  }
  if (
    status === "in_progress" ||
    status === "completed" ||
    status === "failed" ||
    status === "declined" ||
    status === "unknown"
  ) {
    return status;
  }
  return undefined;
}

function normalizePhase(value: unknown): ExecutionSessionPhase | undefined {
  const rawPhase = asString(value).toLowerCase();
  let phase = rawPhase;
  if (rawPhase === "execution" || rawPhase === "running") {
    phase = "acting";
  } else if (rawPhase === "validation") {
    phase = "validating";
  } else if (rawPhase === "done") {
    phase = "completed";
  }
  const normalized = phase as ExecutionSessionPhase;
  if (PHASE_SET.has(normalized)) {
    return normalized;
  }
  return undefined;
}

interface ParsedSseBlock {
  event: string;
  data: JsonRecord;
  raw: JsonRecord;
}

function parseSseBlocks(stream: string): ParsedSseBlock[] {
  const chunks = stream
    .split(/\r?\n\r?\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const parsed: ParsedSseBlock[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/g);
    let event = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trim());
      }
    }

    const dataRaw = dataLines.join("\n").trim();
    const parsedData = parseJsonRecord(dataRaw);
    const data = parsedData ?? (dataRaw ? ({ text: dataRaw } as JsonRecord) : {});
    parsed.push({ event, data, raw: { event, data } });
  }

  return parsed;
}

function parseJsonRecord(value: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonRecord;
    }
    return null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function sortNormalizedEvents(
  events: readonly NormalizedExecutionEvent[]
): NormalizedExecutionEvent[] {
  return [...events].sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp.localeCompare(right.timestamp);
    }
    return left.id.localeCompare(right.id);
  });
}
