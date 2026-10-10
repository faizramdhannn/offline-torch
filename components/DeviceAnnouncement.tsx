"use client";

import { useEffect, useState } from "react";
import { ackCommand, emitLocalCommand, onDeviceCommand } from "@/hooks/useDevicePresence";
import { setAnnounceState } from "@/lib/announceStore";
import { isDue, wibParts, type AnnounceRule } from "@/lib/announceSchedule";

// Pengumuman layar penuh: dari perintah dashboard (langsung) dan dari jadwal (dihitung di perangkat ini).
export default function DeviceAnnouncement({ user }: { user?: { role?: string } | null }) {
  const [a, setA] = useState<{ text: string; until: number } | null>(null);
  const [left, setLeft] = useState(0);
  const eligible = !!user && (user.role === "store" || user.role === "merchant");

  useEffect(
    () =>
      onDeviceCommand(({ type, payload, id }) => {
        if (type === "announce" && payload.text) {
          setA({ text: String(payload.text), until: Date.now() + (Number(payload.seconds) || 30) * 1000 });
          ackCommand(id);
        }
      }),
    []
  );

  // Pengumuman terjadwal: aturan diambil sekali (dan saat dashboard mengubahnya), jam dicek lokal tiap 20 detik.
  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    let rules: AnnounceRule[] = [];
    const firedKey = (r: AnnounceRule, ymd: string) => `torch_ann_${r.id}_${ymd}`;
    const load = async () => {
      try {
        const res = await fetch("/api/announce-schedule/mine", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        if (!cancelled) {
          rules = (d.rules || []).map((r: any) => ({ ...r, id: Number(r.id), all_stores: true, user_names: [], name: "" }));
          setAnnounceState(rules, String(d.standby_text || ""));
        }
      } catch {}
    };
    const tick = () => {
      const { ymd } = wibParts();
      for (const r of rules) {
        if (!isDue(r)) continue;
        const key = firedKey(r, ymd);
        try {
          if (localStorage.getItem(key)) continue; // sudah tampil hari ini (mis. setelah halaman dimuat ulang)
          localStorage.setItem(key, "1");
        } catch {}
        emitLocalCommand({ type: "announce", payload: { text: r.text, seconds: r.seconds } }); // tampil + musik mengecil
        break;
      }
    };
    // bersihkan penanda lama (>3 hari) agar localStorage tidak menumpuk
    try {
      const cutoff = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i) || "";
        const m = k.match(/^torch_ann_\d+_(\d{4}-\d{2}-\d{2})$/);
        if (m && m[1] < cutoff) localStorage.removeItem(k);
      }
    } catch {}
    load();
    const t = setInterval(tick, 20_000);
    const off = onDeviceCommand(({ type }) => { if (type === "announce_refresh") load(); });
    return () => { cancelled = true; clearInterval(t); off(); };
  }, [eligible]);

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
