import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite loads its WASM files from node_modules at runtime, so it must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // the public API lives at /v1/... (the route files are under /api/v1)
  async rewrites() {
    return [{ source: "/v1/:path*", destination: "/api/v1/:path*" }];
  },
};

export default nextConfig;
