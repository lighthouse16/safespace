import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_ACTIONS === "true" || process.env.EXPORT_GH_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGithubPages ? "/safespace" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

