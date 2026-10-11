"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Perangkat toko (akun Store/Merchant) melapor ke dashboard pemantau lewat Ably presence:
// online/offline otomatis (koneksi putus = offline), halaman yang dibuka, baterai.
// Paket `ably` dimuat dinamis, hanya untuk akun toko — halaman lain tidak menanggungnya.
const ID_KEY = "torch_device_id";

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, "");
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
// Tipe perangkat terdeteksi otomatis (tanpa menu/pengaturan): perangkat sentuh (pointer utama "coarse":
// tablet/iPad/HP) = tablet, selain itu PC. Laptop layar sentuh tetap PC karena pointer utamanya mouse/touchpad.
export function getDeviceKind(): "tablet" | "pc" {
  try {
    const ua = navigator.userAgent || "";
    if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
    if (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) return "tablet"; // iPadOS menyamar sebagai Mac
    if (window.matchMedia?.("(pointer: coarse)").matches) return "tablet";
  } catch {}
  return "pc";
}

// Bus perintah: hook lain (musik, pengumuman) ikut mendengar perintah Ably & menambah data presence
// lewat koneksi yang SAMA — satu koneksi per perangkat.
export interface DeviceCommand { type: string; payload: any; id?: string }
type Handler = (cmd: DeviceCommand) => void;
const handlers = new Set<Handler>();
export function onDeviceCommand(h: Handler): () => void {
  handlers.add(h);
  return () => { handlers.delete(h); };
}
let extra: Record<string, unknown> = {};
let pushUpdate: (() => void) | null = null;
let extraTimer: ReturnType<typeof setTimeout> | null = null;
export const getPresenceExtra = () => extra;
// Konfirmasi "perintah diterima & dijalankan": id perintah dilaporkan lewat presence → dashboard menghitung perangkat yang menerima.
export function ackCommand(id?: string) {
  if (id) setPresenceExtra({ ack: { id, t: Date.now() } });
}
// Perintah lokal (dari UI di perangkat ini, mis. staf menekan "lagu berikutnya"): tanpa server.
export function emitLocalCommand(cmd: DeviceCommand) {
  handlers.forEach((h) => h(cmd));
}
export function setPresenceExtra(p: Record<string, unknown>) {
  extra = { ...extra, ...p };
  if (extraTimer) clearTimeout(extraTimer);
  extraTimer = setTimeout(() => pushUpdate?.(), 800);
}

interface Me {
  role?: string;
  user_name?: string;
  name?: string;
}

export function useDevicePresence(user: Me | null | undefined) {
  const pathname = usePathname();
  const pageRef = useRef(pathname);
  const updateRef = useRef<(() => void) | null>(null);
  pageRef.current = pathname;

  const eligible = !!user && (user.role === "store" || user.role === "merchant" || user.role === "admin"); // admin: hanya untuk pemutar musik manual
  const userName = user?.user_name || "";
  const storeName = user?.name || "";

  useEffect(() => {
    if (!eligible) return;
    const deviceId = getDeviceId();
    if (!deviceId) return;
    let cancelled = false;
    let client: any = null;
    let channel: any = null;
    let battery: any = null;
    let lastSent = 0;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const snapshot = () => ({
      kind: getDeviceKind(),
      user_name: userName,
      store: storeName,
      page: pageRef.current,
      battery: battery ? Math.round(battery.level * 100) : null,
      charging: battery ? !!battery.charging : null,
      visible: document.visibilityState === "visible",
      ...extra,
    });
    const forceLogout = () => {
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {}).finally(() => {
        try { localStorage.removeItem("user"); } catch {}
        window.location.replace("/login");
      });
    };
    // true = perangkat ini diputuskan super admin → logout paksa (hanya perangkat ini, akun lain tidak terpengaruh)
    const register = async () => {
      try {
        const r = await fetch("/api/devices/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, kind: getDeviceKind() }),
          keepalive: true,
        });
        const d = await r.json().catch(() => ({}));
        if (d.revoked) { forceLogout(); return true; }
        // perangkat sudah terdaftar → pemutar musik boleh memeriksa perannya (pemutar atau bukan)
        handlers.forEach((h) => h({ type: "music", payload: { action: "role" } }));
      } catch {}
      return false;
    };

    (async () => {
      try {
        const Ably = await import("ably");
        if (cancelled) return;
        if (await register()) return;
        let denied = false;
        client = new Ably.Realtime({
          authCallback: async (_params: unknown, cb: (e: any, t: any) => void) => {
            try {
              const r = await fetch(`/api/realtime/token?deviceId=${encodeURIComponent(deviceId)}`, { cache: "no-store" });
              if (!r.ok) {
                if (r.status === 503) denied = true; // realtime belum dikonfigurasi: berhenti, jangan loop
                throw new Error(String(r.status));
              }
              cb(null, await r.json());
              register(); // token diperbarui tiap jam → sekaligus menyegarkan "terakhir terlihat"
            } catch (e) {
              cb(e, null);
              if (denied) client?.close();
            }
          },
        });
        channel = client.channels.get("stores");
        await channel.presence.enter(snapshot());
        channel.subscribe("command", (m: any) => {
          const d = m.data || {};
          const t = d.target || {};
          const mine =
            t.all === true ||
            t.deviceId === deviceId ||
            (Array.isArray(t.user_names) && t.user_names.includes(userName));
          if (!mine) return;
          if (d.type === "reload") window.location.reload();
          else if (d.type === "logout") forceLogout();
          else if (d.type === "navigate" && typeof d.payload?.path === "string") window.location.assign(d.payload.path);
          else handlers.forEach((h) => h({ type: d.type, payload: d.payload || {}, id: d.id }));
        });
        try {
          battery = await (navigator as any).getBattery?.();
          battery?.addEventListener("levelchange", () => updateRef.current?.());
          battery?.addEventListener("chargingchange", () => updateRef.current?.());
        } catch {}
        // Setiap update presence = 1 panggilan webhook ke Vercel. Perubahan halaman/baterai/tab dibatasi
        // paling sering sekali per 30 detik; perubahan musik (jarang) langsung dikirim.
        const send = () => {
          lastSent = Date.now();
          channel?.presence.update(snapshot()).catch(() => {});
        };
        updateRef.current = () => {
          const wait = 30_000 - (Date.now() - lastSent);
          if (wait <= 0) send();
          else if (!pendingTimer) pendingTimer = setTimeout(() => { pendingTimer = null; send(); }, wait);
        };
        pushUpdate = send;
        send();
      } catch {
        // tanpa realtime pun aplikasi tetap jalan normal
      }
    })();

    const onVis = () => updateRef.current?.();
    const onHide = () => {
      try {
        navigator.sendBeacon("/api/devices/register", new Blob([JSON.stringify({ deviceId, kind: getDeviceKind() })], { type: "application/json" }));
      } catch {}
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      updateRef.current = null;
      pushUpdate = null;
      if (pendingTimer) clearTimeout(pendingTimer);
      try {
        client?.close();
      } catch {}
    };
  }, [eligible, userName, storeName]);

  useEffect(() => {
    updateRef.current?.(); // pindah halaman → perbarui "sedang di halaman apa"
  }, [pathname]);
}
