import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbo: false // disable Turbopack
  },
  /* config options here */
}  as any;

export default nextConfig;
