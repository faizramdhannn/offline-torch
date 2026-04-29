import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || "",
  },
  serverExternalPackages: ['tesseract.js'],
  turbopack: {},
};

export default nextConfig;