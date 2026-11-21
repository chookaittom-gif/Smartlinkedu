import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    inlineCss: true,
  },
};

export default nextConfig;
