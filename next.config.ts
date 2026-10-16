import type { NextConfig } from "next";

// SafeSpace uses a Next.js server runtime for its API routes.
// GitHub Pages static export is no longer supported by this app.
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

