"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 jam dalam ms

export function useSessionGuard() {
  const router = useRouter();

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

    // Cek saat mount
    checkSession();

    // Cek setiap menit
    const interval = setInterval(checkSession, 60 * 1000);

    return () => clearInterval(interval);
  }, [router]);
}