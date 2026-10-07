import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = (process.env.BACKEND_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
    return [{ source: "/api/auth/:path*", destination: `${backend}/api/auth/:path*` }, { source: "/api/store/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
