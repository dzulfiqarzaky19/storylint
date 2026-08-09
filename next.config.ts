import type { NextConfig } from "next";

// distDir defaults to ".next". Set NEXT_DIST_DIR to build/serve from an isolated
// directory (e.g. a coordinator's verification build gate) so a `next build`
// does not overwrite the chunk files a separate long-running dev/e2e server is
// still serving from the default ".next" (stale-chunk 404s break hydration).
const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
