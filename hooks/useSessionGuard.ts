"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { notifyIfNewBuild } from "@/lib/buildInfo";

// Pengecekan ke server dibatasi (hemat invocation/CPU Vercel): paling sering 1x per 5 menit,
// walau hook ini dipasang di banyak halaman dan dipanggil tiap pindah halaman.
const SERVER_CHECK_INTERVAL_MS = 5 * 60 * 1000;
let lastServerCheck = 0;

const SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 jam dalam ms

export function useSessionGuard() {
  const router = useRouter();
  const { setUser } = useUser();
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  useEffect(() => {
    // Bawa path+query saat ini sebagai `next` supaya setelah login user
    // dibalikkan ke halaman (dan filter) yang tadi dia coba buka, bukan
    // selalu ke /dashboard — penting untuk link yang di-share/dibuka di
    // device lain yang belum login.
    const loginUrlWithNext = (extraQuery?: string) => {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      return `/login?${extraQuery ? `${extraQuery}&` : ""}next=${next}`;
    };

    const checkSession = () => {
      try {
        const userData = localStorage.getItem("user");
        if (!userData) {
          router.push(loginUrlWithNext());
          return;
        }

        const parsed = JSON.parse(userData);
        const loginAt = parsed._loginAt;

        // Sesi lama (sebelum cookie server ada) → login ulang sekali.
        if (parsed._auth !== 2) {
          localStorage.removeItem("user");
          router.push(loginUrlWithNext());
          return;
        }

        if (!loginAt) {
          // User lama yang belum punya _loginAt → paksa logout
          localStorage.removeItem("user");
          router.push(loginUrlWithNext());
          return;
        }

        const elapsed = Date.now() - loginAt;
        if (elapsed >= SESSION_DURATION_MS) {
          localStorage.removeItem("user");
          router.push(loginUrlWithNext("reason=session_expired"));
        }
      } catch {
        localStorage.removeItem("user");
        router.push(loginUrlWithNext());
      }
    };

    // Sesi bisa dicabut dari server (logout paksa / akun dinonaktifkan).
    const checkServer = () => {
      if (Date.now() - lastServerCheck < SERVER_CHECK_INTERVAL_MS) return;
      lastServerCheck = Date.now();
      fetch("/api/auth/me", { cache: "no-store" })
        .then(async (r) => {
          if (r.status === 401) {
            localStorage.removeItem("user");
            router.push(loginUrlWithNext("reason=session_expired"));
            return;
          }
          if (!r.ok) return;
          // Segarkan permission/role dari server (mis. role diganti Super Admin).
          const { user: fresh, build } = await r.json();
          notifyIfNewBuild(build); // ada deployment baru → tampilkan notifikasi "Muat ulang"
          const raw = localStorage.getItem("user");
          if (!fresh || !raw) return;
          const cur = JSON.parse(raw);
          const next = { ...cur, ...fresh };
          if (JSON.stringify(next) !== JSON.stringify(cur)) {
            localStorage.setItem("user", JSON.stringify(next));
            setUserRef.current(next);
          }
        })
        .catch(() => {});
    };

    // Cek saat mount
    checkSession();
    checkServer();

    // Cek lokal tiap menit (gratis); cek server hanya saat tab terlihat (dibatasi 5 menit di atas)
    const interval = setInterval(() => {
      checkSession();
      if (!document.hidden) checkServer();
    }, 60 * 1000);
    const onVisible = () => { if (!document.hidden) checkServer(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
}