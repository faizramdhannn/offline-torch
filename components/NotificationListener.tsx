"use client";

import { useEffect, useRef } from "react";

interface Props {
  username: string;
}

export default function NotificationListener({ username }: Props) {
  const sseRef = useRef<EventSource | null>(null);
  // Track id → status so we can detect status changes
  const knownStatusRef = useRef<Map<string, string>>(new Map());
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!username) return;

    // Request permission automatically on first load
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    startSSE();

    return () => {
      sseRef.current?.close();
    };
  }, [username]);

  const startSSE = () => {
    if (sseRef.current) sseRef.current.close();

    const es = new EventSource(`/api/request-store-sse?username=${username}`);
    sseRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "init") {
          // Seed known statuses — no notification on first load
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
              // New item — notify if assigned to current user and Pending
              if (
                item.assigned_to === username &&
                item.status === "Pending"
              ) {
                triggerNotification(
                  "📋 Request Baru Untukmu",
                  `${item.requester}: ${item.reason_request}`
                );
              }
            } else if (prevStatus !== item.status) {
              // Status changed — notify requester (created_by) when Completed
              if (
                item.status === "Completed" &&
                item.created_by === username
              ) {
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