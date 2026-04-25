import { NextResponse, type NextRequest } from "next/server";

import { authorizeControlPlaneRequest } from "./lib/server/http/control-plane-auth";
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

function responseWithCors(
  response: NextResponse,
  headers: Record<string, string> | null,
) {
  return headers ? applyHeaders(response, headers) : response;
}

function isSignedArtifactDownloadPath(pathname: string) {
  return pathname === "/api/control/orchestration/artifacts/download";
}

function isMutationMethod(method: string) {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function isCrossSiteBrowserMutation(request: NextRequest) {
  return (
    isMutationMethod(request.method.toUpperCase()) &&
    request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site"
  );
}

function applyPrivilegedApiGate(request: NextRequest) {
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

  if (!origin && isCrossSiteBrowserMutation(request)) {
    return NextResponse.json(
      { detail: getPrivilegedApiCorsRejectionDetail() },
      { status: 403 },
    );
  }

  if (isSignedArtifactDownloadPath(request.nextUrl.pathname)) {
    return responseWithCors(NextResponse.next(), corsHeaders);
  }

  const auth = authorizeControlPlaneRequest(request);
  if (!auth.allowed) {
    return responseWithCors(
      NextResponse.json(
        {
          code: auth.code,
          detail: auth.detail,
        },
        { status: auth.status },
      ),
      corsHeaders,
    );
  }

  const requestHeaders = new Headers(request.headers);
  for (const [key, value] of Object.entries(auth.requestHeaders)) {
    requestHeaders.set(key, value);
  }

  return responseWithCors(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    corsHeaders,
  );
}

export function proxy(request: NextRequest) {
  return applyPrivilegedApiGate(request);
}

export const config = {
  matcher: ["/api/control/:path*", "/api/shell/:path*"],
};
