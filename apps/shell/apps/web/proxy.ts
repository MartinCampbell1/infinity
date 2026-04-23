import { NextResponse, type NextRequest } from "next/server";

import {
  buildPrivilegedApiCorsHeaders,
  getPrivilegedApiCorsRejectionDetail,
  isPrivilegedApiPath,
} from "./lib/server/http/privileged-api-cors";

function applyHeaders(response: NextResponse, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

function applyPrivilegedApiCors(request: NextRequest) {
  if (!isPrivilegedApiPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  const corsHeaders = buildPrivilegedApiCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    if (!corsHeaders) {
      return NextResponse.json(
        { detail: getPrivilegedApiCorsRejectionDetail() },
        { status: 403 },
      );
    }

    return applyHeaders(new NextResponse(null, { status: 204 }), corsHeaders);
  }

  if (origin && !corsHeaders) {
    return NextResponse.json(
      { detail: getPrivilegedApiCorsRejectionDetail() },
      { status: 403 },
    );
  }

  if (!corsHeaders) {
    return NextResponse.next();
  }

  return applyHeaders(NextResponse.next(), corsHeaders);
}

export function proxy(request: NextRequest) {
  return applyPrivilegedApiCors(request);
}

export const config = {
  matcher: ["/api/control/:path*", "/api/shell/:path*"],
};
