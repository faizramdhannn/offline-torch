'use client';

// hooks/usePushNotification.ts

import { useEffect, useRef } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function usePushNotification(username: string | null) {
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const audioBufferRef  = useRef<AudioBuffer | null>(null);
  const audioReadyRef   = useRef(false);
  // Tandai ada suara tertunda saat tab sedang di background
  const pendingSoundRef = useRef(false);

  // ── Init AudioContext + decode mp3 ────────────────────────────────
  // Wajib dipanggil setelah ada gesture user (autoplay policy browser)
  const initAudio = async () => {
    if (audioReadyRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const res = await fetch('/notification.mp3');
      const arrayBuffer = await res.arrayBuffer();
      audioBufferRef.current = await ctx.decodeAudioData(arrayBuffer);
      audioReadyRef.current = true;
      console.log('[PushNotif] Audio ready');
    } catch (e) {
      console.warn('[PushNotif] Audio init gagal:', e);
    }
  };

  // ── Putar suara lewat AudioContext ───────────────────────────────
  const playSoundViaCtx = async (): Promise<boolean> => {
    if (!audioReadyRef.current || !audioCtxRef.current || !audioBufferRef.current) return false;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    // Jika masih suspended setelah resume (Chrome blokir background audio)
    if (ctx.state !== 'running') return false;
    const source = ctx.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(ctx.destination);
    source.start(0);
    return true;
  };

  // ── Putar suara (dipanggil saat SW kirim postMessage) ────────────
  const playSound = async () => {
    try {
      const ok = await playSoundViaCtx();
      if (ok) {
        pendingSoundRef.current = false;
        return;
      }
      // Fallback HTMLAudio — bisa gagal jika tab background
      const audio = new Audio('/notification.mp3');
      audio.volume = 1;
      await audio.play();
      pendingSoundRef.current = false;
    } catch (e) {
      // Gagal (biasanya karena tab background) → simpan sebagai pending
      console.warn('[PushNotif] playSound gagal, simpan pending:', e);
      pendingSoundRef.current = true;
    }
  };

  // ── Putar pending sound saat tab kembali visible ─────────────────
  const flushPendingSound = async () => {
    if (!pendingSoundRef.current) return;
    pendingSoundRef.current = false;
    console.log('[PushNotif] Tab aktif kembali, memutar pending sound');
    try {
      const ok = await playSoundViaCtx();
      if (!ok) {
        const audio = new Audio('/notification.mp3');
        audio.volume = 1;
        await audio.play();
      }
    } catch (e) {
      console.warn('[PushNotif] flushPendingSound gagal:', e);
    }
  };

  useEffect(() => {
    if (!username || !VAPID_PUBLIC_KEY || typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    // ── Init audio setelah interaksi pertama ─────────────────────────
    const handleFirstInteraction = () => { initAudio(); };
    window.addEventListener('click',      handleFirstInteraction, { once: true });
    window.addEventListener('keydown',    handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });

    // ── visibilitychange: putar pending sound saat tab kembali aktif ─
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        flushPendingSound();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // ── Listener pesan dari Service Worker ───────────────────────────
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
        playSound();
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);

    // ── Register SW & subscribe push ─────────────────────────────────
    const setup = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('[PushNotif] Permission not granted');
          return;
        }

        const existing = await reg.pushManager.getSubscription();
        const serverRes = await fetch(`/api/push-subscription?username=${username}`);
        const serverData = serverRes.ok ? await serverRes.json() : {};

        const needsSubscribe =
          !existing ||
          !serverData.subscription ||
          existing.endpoint !== serverData.subscription?.endpoint;

        if (needsSubscribe) {
          const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
          await fetch('/api/push-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, subscription }),
          });
          console.log('[PushNotif] Subscribed for', username);
        } else {
          console.log('[PushNotif] Subscription already up to date');
        }
      } catch (e) {
        console.error('[PushNotif] Setup error:', e);
      }
    };

    setup();

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [username]);
}