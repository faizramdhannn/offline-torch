"use client";

import { useEffect, useState } from "react";
import { onDeviceCommand } from "@/hooks/useDevicePresence";

// Pengumuman layar penuh dari pusat (dikirim lewat dashboard Store Monitor).
export default function DeviceAnnouncement() {
  const [a, setA] = useState<{ text: string; until: number } | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(
    () =>
      onDeviceCommand(({ type, payload }) => {
        if (type === "announce" && payload.text) setA({ text: String(payload.text), until: Date.now() + (Number(payload.seconds) || 30) * 1000 });
      }),
    []
  );

  useEffect(() => {
    if (!a) return;
    const t = setInterval(() => {
      const s = Math.ceil((a.until - Date.now()) / 1000);
      if (s <= 0) setA(null);
      else setLeft(s);
    }, 500);
    return () => clearInterval(t);
  }, [a]);

  if (!a) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-gray-900/95 p-8 text-center text-white">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-gray-400">Pengumuman</p>
      <p className="max-w-3xl text-3xl font-semibold leading-snug md:text-5xl">{a.text}</p>
      <button onClick={() => setA(null)} className="rounded-full border border-white/30 px-4 py-1.5 text-xs text-white/70 hover:bg-white/10">
        Tutup ({left}s)
      </button>
    </div>
  );
}
