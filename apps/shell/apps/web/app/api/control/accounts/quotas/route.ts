import { NextResponse } from "next/server";

import {
  ingestQuotaProducerSnapshot,
  isAccountQuotaProducerIngestRequest,
  buildQuotaFeedResponse,
  listControlPlaneAccounts,
  listControlPlaneQuotaSnapshots,
  listControlPlaneQuotaUpdates,
} from "../../../../../lib/server/control-plane/accounts";
import type {
  AccountAuthMode,
  AccountQuotaProducerIngestRequest,
} from "../../../../../lib/server/control-plane/contracts/quota";

export const dynamic = "force-dynamic";

function parseSince(searchParams: URLSearchParams): number {
  const raw = searchParams.get("since");
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function parseAuthMode(searchParams: URLSearchParams): AccountAuthMode | null {
  const value = searchParams.get("authMode");
  if (
    value === "chatgpt" ||
    value === "chatgptAuthTokens" ||
    value === "apikey" ||
    value === "unknown"
  ) {
    return value;
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const since = parseSince(searchParams);
  const authMode = parseAuthMode(searchParams);
  const accountId = searchParams.get("accountId");
  const includeUpdates = searchParams.get("includeUpdates") !== "0";

  let snapshots = await listControlPlaneQuotaSnapshots();
  if (authMode) {
    snapshots = snapshots.filter((snapshot) => snapshot.authMode === authMode);
  }
  if (accountId) {
    snapshots = snapshots.filter((snapshot) => snapshot.accountId === accountId);
  }

  const accounts = await listControlPlaneAccounts();
  const accountMap = new Map(accounts.map((account) => [account.id, account]));

  const snapshotsWithCapacity = snapshots.map((snapshot) => ({
    snapshot,
    capacity: accountMap.get(snapshot.accountId)?.capacity ?? null,
  }));

  const updates = includeUpdates
    ? (await listControlPlaneQuotaUpdates(since)).filter((update) => {
        if (authMode && update.snapshot.authMode !== authMode) {
          return false;
        }
        if (accountId && update.accountId !== accountId) {
          return false;
        }
        return true;
      })
    : [];

  return NextResponse.json(
    buildQuotaFeedResponse({
      since,
      nextSince: updates.length ? updates[updates.length - 1]?.sequence ?? since : since,
      snapshots: snapshotsWithCapacity,
      updates,
    })
  );
}

export async function POST(request: Request) {
  let body: AccountQuotaProducerIngestRequest | null = null;

  try {
    const parsed = await request.json();
    if (isAccountQuotaProducerIngestRequest(parsed)) {
      body = parsed;
    }
  } catch {
    body = null;
  }

  if (!body) {
    return NextResponse.json(
      {
        error:
          "Invalid quota producer ingest body. Expected { producer, snapshot, summary?, sessionIds? }.",
      },
      { status: 400 }
    );
  }

  const result = await ingestQuotaProducerSnapshot(body);
  return NextResponse.json(result);
}
