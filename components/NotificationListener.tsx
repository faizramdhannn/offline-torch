"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// ─── FIX: Pakai env var, bukan hardcode key berbeda ──────────────────────────
// Dulu ada 2 key berbeda antara file ini dan page.tsx → subscription mismatch
const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BPRJgdT0HHzl7GeptF_hhQ4JncvHV2AzNfdihGrDrd3FEvjIZK_T-t7_1Ggib3UTMA9OYuVyrdnx6X7xWmveLZY";
// ─────────────────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i)
    outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

interface Props {
  // username HARUS berisi user_name (login name), bukan display name
  // Contoh: "lembong" bukan "Torch Lembong"
  // Sidebar sudah difix untuk selalu kirim user_name ke sini
  username: string;
}

export default function NotificationListener({ username }: Props) {
  const pathname = usePathname();
  const sseRef = useRef<EventSource | null>(null);
  const knownStatusRef = useRef<Map<string, string>>(new Map());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!username) return;

    // ─── FIX: Cek apakah sedang di halaman request-store ─────────────────
    // Jika ya, page.tsx sudah DIHAPUS logika SSE-nya sehingga hanya
    // NotificationListener ini yang jalan (tidak ada duplikasi).
    // ─────────────────────────────────────────────────────────────────────

    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") registerPush();
        });
      } else if (Notification.permission === "granted") {
        // Refresh subscription setiap mount agar tidak stale
        registerPush();
      }
    }

    startSSE();

    return () => {
      sseRef.current?.close();
    };
  }, [username]);

  const registerPush = async () => {
    try {
      if (!("serviceWorker" in navigator)) return;

      // ─── FIX: Unregister SEMUA service worker lama (termasuk firebase-messaging-sw.js)
      // Token APA91b... ter-generate karena Firebase SW lama masih aktif di cache browser.
      // Kita unregister semua SW selain /sw.js sebelum register ulang.
      const allRegs = await navigator.serviceWorker.getRegistrations();
      for (const r of allRegs) {
        const swUrl = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || '';
        if (!swUrl.endsWith('/sw.js')) {
          console.log('Unregistering old SW:', swUrl);
          await r.unregister();
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Unsubscribe lama + subscribe baru untuk hindari stale token
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch("/api/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, subscription: sub.toJSON() }),
      });
      console.log("Push subscription refreshed for", username);
    } catch (err) {
      console.error("Push registration failed:", err);
    }
  };

  const startSSE = () => {
    if (sseRef.current) sseRef.current.close();

    const es = new EventSource(`/api/request-store-sse?username=${username}`);
    sseRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "init") {
          msg.data.forEach((item: any) => {
            knownStatusRef.current.set(item.id, item.status);
          });
          isInitializedRef.current = true;
          return;
        }

        if (msg.type === "update" && isInitializedRef.current) {
          msg.data.forEach((item: any) => {
            const prevStatus = knownStatusRef.current.get(item.id);

            if (prevStatus === undefined) {
              // Item baru — notify assignee
              // assigned_to berisi user_name (misal "faizramdhann")
              if (item.assigned_to === username && item.status === "Pending") {
                triggerNotification(
                  "📋 Request Baru Untukmu",
                  `${item.requester}: ${item.reason_request}`
                );
              }
            } else if (prevStatus !== item.status) {
              // Status berubah — notify requester (created_by)
              // created_by berisi user_name, cocok dengan username di sini
              if (item.status === "Completed" && item.created_by === username) {
                triggerNotification(
                  "✅ Request Selesai",
                  `Request "${item.reason_request}" sudah diselesaikan`
                );
              }
            }

            knownStatusRef.current.set(item.id, item.status);
          });
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      setTimeout(() => startSSE(), 5000);
    };
  };

  const triggerNotification = (title: string, body: string) => {
    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/logo_offline_torch.png",
        tag: `request-${Date.now()}`,
      });
    }
  };

  return null;
}