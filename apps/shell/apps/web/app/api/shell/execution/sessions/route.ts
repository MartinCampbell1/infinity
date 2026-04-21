import { NextResponse } from "next/server";

import type { ExecutionSessionSummary } from "@/lib/server/control-plane/contracts/session-events";
import { getExecutionSessionSummaries } from "../../../../../lib/server/control-plane/sessions/index";

export const dynamic = "force-dynamic";

function parseLimit(searchParams: URLSearchParams) {
  const raw = Number(searchParams.get("limit") ?? 8);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 8;
  }
  return Math.min(Math.floor(raw), 20);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams);
  const availableSessions = (await getExecutionSessionSummaries()).filter(
    (session: ExecutionSessionSummary) => !session.archived
  );
  const sessions = availableSessions.slice(0, limit);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sessions,
    totalSessions: availableSessions.length,
    sessionsLoadState: "ready",
    sessionsError: null,
    filters: {
      limit,
    },
  });
}
