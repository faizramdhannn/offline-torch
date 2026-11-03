import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || "",
    // Penanda versi untuk notifikasi "ada pembaruan" (lib/buildInfo.ts).
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev",
  },
  serverExternalPackages: ['tesseract.js'],
  turbopack: {},
  // Katalog Gundam = file statis di public/; rewrite (bukan redirect) supaya alamat tetap /gundam-catalog tanpa ".html".
  async rewrites() {
    return [{ source: "/gundam-catalog", destination: "/katalog-gundam.html" }];
  },
};

export default nextConfig;