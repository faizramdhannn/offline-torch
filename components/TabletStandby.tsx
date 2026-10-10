"use client";

import { useEffect, useState } from "react";
import { getDeviceKind, getPresenceExtra } from "@/hooks/useDevicePresence";
import { getAnnounceState } from "@/lib/announceStore";
import { nextToday } from "@/lib/announceSchedule";

// Layar standby untuk TABLET toko: setelah tidak disentuh beberapa menit, tampilkan jam, nama toko, dan lagu
// yang sedang diputar di latar gelap (hemat tampilan, rapi dipandang). Ketuk untuk kembali. Murni di perangkat.
const IDLE_MS = 3 * 60_000;

export default function TabletStandby({ user }: { user: { role?: string; name?: string } | null | undefined }) {
  const eligible = !!user && (user.role === "store" || user.role === "merchant");
  const [on, setOn] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [title, setTitle] = useState("");
  const [info, setInfo] = useState<{ text: string; next: string }>({ text: "", next: "" });

  useEffect(() => {
    if (!eligible || getDeviceKind() !== "tablet") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setOn(true), IDLE_MS);
    };
    const touch = () => { setOn(false); arm(); };
    const evs = ["pointerdown", "keydown", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    arm();
    return () => { if (timer) clearTimeout(timer); evs.forEach((e) => window.removeEventListener(e, touch)); };
  }, [eligible]);

  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => {
      setNow(new Date());
      setTitle(String((getPresenceExtra() as any)?.music?.title || ""));
      const st = getAnnounceState();
      const n = nextToday(st.rules);
      setInfo({
        text: st.standbyText,
        next: n ? `${String(Math.floor(n.time_min / 60)).padStart(2, "0")}:${String(n.time_min % 60).padStart(2, "0")} · ${n.text}` : "",
      });
    }, 1000);
    return () => clearInterval(t);
  }, [on]);

  if (!on) return null;
  // geser posisi tiap menit agar piksel yang sama tidak menyala terus (cegah burn-in)
  const m = now.getMinutes();
  const dx = ((m * 37) % 21) - 10;
  const dy = ((m * 53) % 21) - 10;
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black text-center text-white" onClick={() => setOn(false)}>
      <div style={{ transform: `translate(${dx}vw, ${dy}vh)` }} className="px-6">
        <p className="text-6xl font-light tabular-nums md:text-8xl">{now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false })}</p>
        <p className="mt-3 text-sm text-white/60">{now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}</p>
        <p className="mt-6 text-lg font-medium text-white/80">{user?.name}</p>
        {info.text && <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-white/80">{info.text}</p>}
        {info.next && <p className="mx-auto mt-5 max-w-xs truncate text-xs text-white/40">Berikutnya {info.next}</p>}
        {title && <p className="mx-auto mt-2 max-w-xs truncate text-xs text-white/50">{title}</p>}
      </div>
    </div>
  );
}
