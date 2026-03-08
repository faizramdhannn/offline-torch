"use client";

import { useEffect, useRef } from "react";

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BLCpcWVe7ON_yEBseUerxJ6xyX26S3fZjj2CE5X_-Q5EKiRdHh6zr79iD62PjiefZ3X2oAuk_itov_398VAGXPo";

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
  username: string;
}

export default function NotificationListener({ username }: Props) {
  const sseRef = useRef<EventSource | null>(null);
  const knownStatusRef = useRef<Map<string, string>>(new Map());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!username) return;

    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") registerPush();
        });
      } else if (Notification.permission === "granted") {
        // Always re-register on mount to refresh potentially expired subscription
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
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Unsubscribe old + re-subscribe fresh to avoid stale/410 subscriptions
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
              // New item — notify assignee
              if (item.assigned_to === username && item.status === "Pending") {
                triggerNotification(
                  "📋 Request Baru Untukmu",
                  `${item.requester}: ${item.reason_request}`
                );
              }
            } else if (prevStatus !== item.status) {
              // Status changed — notify requester when completed
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