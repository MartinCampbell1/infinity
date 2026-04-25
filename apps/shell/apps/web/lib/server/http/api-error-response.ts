import { NextResponse } from "next/server";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function buildApiErrorBody(params: {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}): ApiErrorBody {
  return {
    error: {
      code: params.code,
      message: params.message,
      ...(params.details ? { details: params.details } : {}),
    },
  };
}

export function apiErrorResponse(
  params: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  },
  init?: ResponseInit,
) {
  return NextResponse.json(buildApiErrorBody(params), {
    ...init,
    status: params.status,
  });
}

export function extractApiErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    typeof payload.detail === "string"
  ) {
    return payload.detail;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return null;
}
