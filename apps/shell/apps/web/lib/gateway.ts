import { getUpstreamBaseUrl as resolveUpstreamBaseUrl } from "@founderos/config";

import type { UpstreamId } from "@/lib/gateway-contract";

export function getUpstreamBaseUrl(upstream: UpstreamId): string {
  return resolveUpstreamBaseUrl(upstream, process.env);
}
