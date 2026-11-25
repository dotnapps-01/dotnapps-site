import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite loads its WASM files from node_modules at runtime, so it must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
