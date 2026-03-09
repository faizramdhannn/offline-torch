"use client";

import { useEffect } from "react";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BOBiokCOlMnIJIjbezPGfv_wY5y8gotsZp0eWdE2jygxx-hxrT4Hm7EtIJKQdukYox_dFezWA6sj2nDHaURyo7A";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i)
    outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function NotificationListener({ username }: { username: string }) {
  useEffect(() => {
    if (!username) return;

    const registerPush = async () => {
      try {
        if (!("serviceWorker" in navigator)) return;

        // Unregister SW lama (selain /sw.js) agar tidak ada konflik
        const allRegs = await navigator.serviceWorker.getRegistrations();
        for (const r of allRegs) {
          const swUrl =
            r.active?.scriptURL ||
            r.installing?.scriptURL ||
            r.waiting?.scriptURL ||
            "";
          if (!swUrl.endsWith("/sw.js")) await r.unregister();
        }

        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Unsubscribe dulu agar token tidak stale
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
      } catch (err) {
        console.error("Push registration failed:", err);
      }
    };

    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") registerPush();
      });
    } else if (Notification.permission === "granted") {
      registerPush();
    }
  }, [username]);

  return null;
}