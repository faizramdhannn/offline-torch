// Penanda versi aplikasi (satu nilai per deployment Vercel).
// - Sisi server: dibaca saat runtime dari env sistem Vercel.
// - Sisi klien: NEXT_PUBLIC_BUILD_ID ditanam saat build (lihat next.config.ts).
// Selama dev lokal keduanya "dev" sehingga tidak pernah dianggap ada pembaruan.
export const serverBuildId = (): string =>
  process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || "dev";

export const UPDATE_EVENT = "app:update-available";

// true bila server sudah menjalankan versi yang berbeda dari yang dimuat browser ini.
export function isNewBuild(clientBuild: string | undefined, serverBuild: string | undefined): boolean {
  if (!clientBuild || !serverBuild) return false;
  if (clientBuild === "dev" || serverBuild === "dev") return false;
  return clientBuild !== serverBuild;
}

// Dipanggil klien setelah dapat jawaban server; memicu notifikasi bila ada versi baru.
export function notifyIfNewBuild(serverBuild: string | undefined) {
  if (typeof window === "undefined") return;
  if (isNewBuild(process.env.NEXT_PUBLIC_BUILD_ID, serverBuild)) {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { build: serverBuild } }));
  }
}
