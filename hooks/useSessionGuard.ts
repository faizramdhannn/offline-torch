"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 jam dalam ms

export function useSessionGuard() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = () => {
      try {
        const userData = localStorage.getItem("user");
        if (!userData) {
          router.push("/login");
          return;
        }

        const parsed = JSON.parse(userData);
        const loginAt = parsed._loginAt;

        if (!loginAt) {
          // User lama yang belum punya _loginAt → paksa logout
          localStorage.removeItem("user");
          router.push("/login");
          return;
        }

        const elapsed = Date.now() - loginAt;
        if (elapsed >= SESSION_DURATION_MS) {
          localStorage.removeItem("user");
          router.push("/login?reason=session_expired");
        }
      } catch {
        localStorage.removeItem("user");
        router.push("/login");
      }
    };

    // Cek saat mount
    checkSession();

    // Cek setiap menit
    const interval = setInterval(checkSession, 60 * 1000);

    return () => clearInterval(interval);
  }, [router]);
}