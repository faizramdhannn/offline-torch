"use client";

import { useEffect, useRef } from "react";

interface Props {
  username: string;
}

export default function NotificationListener({ username }: Props) {
  const sseRef = useRef<EventSource | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
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
          // Seed known IDs — no notification on first load
          msg.data.forEach((item: any) => knownIdsRef.current.add(item.id));
          isInitializedRef.current = true;
          return;
        }

        if (msg.type === "update" && isInitializedRef.current) {
          msg.data.forEach((item: any) => {
            if (
              item.assigned_to === username &&
              item.status === "Pending" &&
              !knownIdsRef.current.has(item.id)
            ) {
              triggerNotification(
                "Request Baru Untukmu",
                `${item.requester}: ${item.reason_request}`
              );
            }
            knownIdsRef.current.add(item.id);
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