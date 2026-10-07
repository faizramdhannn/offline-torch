import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || "",
    // Penanda versi untuk notifikasi "ada pembaruan" (lib/buildInfo.ts).
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev",
  },
  serverExternalPackages: ['tesseract.js'],
  turbopack: {},
};

export default nextConfig;