import type { NextConfig } from "next";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      // Preserve trailing slash behavior: if Vercel strips trailing slash
      // forward requests to backend with an explicit trailing slash to
      // avoid Django APPEND_SLASH redirect loops.
      {
        source: '/api/:path*/',
        destination: `${BACKEND_URL}/api/:path*/`,
      },
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*/`, // Proxy /api requests to backend (ensure trailing slash)
      },
    ];
  },
};

export default nextConfig;
