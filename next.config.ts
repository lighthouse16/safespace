import type { NextConfig } from "next";

// GitHub Actions is a CI runner, not a static hosting target. Full-stack route
// handlers must remain available during CI and on a server-capable host.
// Legacy Pages export is opt-in only for a separate, explicit static build.
const isGithubPages = process.env.EXPORT_GH_PAGES === "true";

const nextConfig: NextConfig = {
  output: isGithubPages ? "export" : undefined,
  basePath: isGithubPages ? "/safespace" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

