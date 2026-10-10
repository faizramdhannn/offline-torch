"use client";

import { useEffect, useState } from "react";
import { emitLocalCommand, getPresenceExtra } from "@/hooks/useDevicePresence";
import { NextIcon } from "@/components/store-monitor/icons";

// Penanda untuk staf toko di perangkat yang MEMUTAR musik toko: musik berasal dari aplikasi ini, jadi
// tab/aplikasi jangan ditutup. Juga: judul tab diberi awalan, dan browser menanyakan konfirmasi saat tab akan ditutup.
export default function MusicBadge({ isPlayer }: { isPlayer: boolean }) {
  const [m, setM] = useState<{ state?: string; title?: string; note?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [cooling, setCooling] = useState(false);
  const skip = () => {
    if (cooling) return;
    emitLocalCommand({ type: "music", payload: { action: "next" } });
    setCooling(true);
    setTimeout(() => setCooling(false), 3000); // cegah ketukan beruntun
  };

  useEffect(() => {
    if (!isPlayer) return;
    const first = (() => { try { return !sessionStorage.getItem("torch_music_badge_seen"); } catch { return false; } })();
    if (first) {
      setOpen(true);
      try { sessionStorage.setItem("torch_music_badge_seen", "1"); } catch {}
      const t = setTimeout(() => setOpen(false), 12_000);
      return () => clearTimeout(t);
    }
  }, [isPlayer]);

  useEffect(() => {
    if (!isPlayer) { setM(null); return; }
    const read = () => setM(((getPresenceExtra() as any)?.music as any) || null);
    read();
    const t = setInterval(read, 2000);
    return () => clearInterval(t);
  }, [isPlayer]);

  const playing = m?.state === "playing" || m?.state === "buffering";
  const active = isPlayer && (playing || m?.state === "paused" || !!m?.note);

  // awalan judul tab + konfirmasi sebelum menutup selama musik berjalan
  useEffect(() => {
    if (!isPlayer || !playing) return;
    const base = document.title.replace(/^Musik aktif · /, "");
    const apply = () => { if (!document.title.startsWith("Musik aktif · ")) document.title = `Musik aktif · ${base}`; };
    apply();
    const t = setInterval(apply, 3000);
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(t);
      window.removeEventListener("beforeunload", warn);
      document.title = document.title.replace(/^Musik aktif · /, "");
    };
  }, [isPlayer, playing]);

  if (!active) return null;
  return (
    <div className="fixed bottom-4 left-4 z-[70] max-w-[88vw]">
      <div className={`flex max-w-full items-center rounded-full shadow-lg ${m?.note ? "bg-amber-500 text-white" : "bg-gray-900 text-white"}`}>
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 items-center gap-2 py-2 pl-3.5 pr-3 text-left text-xs font-medium">
          <span className="relative flex h-2 w-2 shrink-0">
            {playing && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${playing ? "bg-emerald-400" : "bg-white/60"}`} />
          </span>
          <span className="min-w-0">
            <span className="block truncate">{m?.note ? "Musik toko perlu perhatian" : playing ? "Sedang diputar" : "Musik toko dijeda"}</span>
            {m?.title && !m?.note && <span className="block max-w-[55vw] truncate text-[11px] font-normal text-white/70 sm:max-w-xs">{m.title}</span>}
          </span>
        </button>
        {playing && (
          <button
            onClick={skip}
            disabled={cooling}
            aria-label="Lagu berikutnya"
            title="Lagu berikutnya"
            className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-40"
          ><NextIcon /></button>
        )}
      </div>
      {open && (
        <div className="mt-2 rounded-xl bg-white p-3 text-xs leading-relaxed text-gray-600 shadow-xl ring-1 ring-gray-200">
          {m?.note && <p className="mb-1.5 font-medium text-amber-700">{m.note}</p>}
          {m?.title && <p className="mb-1.5 font-medium text-gray-800">{m.title}</p>}
          <p>Musik toko diputar dari <b>aplikasi Offline Torch di perangkat ini</b>. Tombol panah di samping untuk melewati ke lagu berikutnya. <b>Jangan menutup tab atau aplikasi ini</b>, dan jangan mematikan layar, supaya musik tidak berhenti. Playlist, jeda, dan volume diatur dari pusat.</p>
        </div>
      )}
    </div>
  );
}
