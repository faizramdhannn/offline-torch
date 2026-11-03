import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || "",
    // Penanda versi untuk notifikasi "ada pembaruan" (lib/buildInfo.ts).
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev",
  },
  serverExternalPackages: ['tesseract.js'],
  turbopack: {},
  // Katalog Gundam & Women = file statis di public/; rewrite (bukan redirect) supaya alamat tetap tanpa ".html".
  // Alamat langsung ke file statis diarahkan ke alamat bersih (tanpa ".html").
  async redirects() {
    return [
      { source: "/katalog-gundam.html", destination: "/gundam-catalog", permanent: false },
      { source: "/katalog-women.html", destination: "/women-catalog", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/gundam-catalog", destination: "/katalog-gundam.html" },
      { source: "/women-catalog", destination: "/katalog-women.html" },
    ];
  },
};

export default nextConfig;