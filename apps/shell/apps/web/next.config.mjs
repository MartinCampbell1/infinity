import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@founderos/ui", "@founderos/api-clients"],
  async headers() {
    return [
      {
        source: "/api/control/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Founderos-Workspace-Session-Grant",
          },
        ],
      },
      {
        source: "/api/shell/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Founderos-Workspace-Session-Grant",
          },
        ],
      },
    ];
  },
  turbopack: {
    root: path.join(appDir, "../../../.."),
  },
};

export default nextConfig;
