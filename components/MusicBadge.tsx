"use client";

import { useEffect, useRef, useState } from "react";
import { emitLocalCommand, getPresenceExtra } from "@/hooks/useDevicePresence";
import { MusicIcon, NextIcon, PauseIcon, PlayIcon } from "@/components/store-monitor/icons";

const POS_KEY = "torch_music_badge_pos";
const HIDE_KEY = "torch_music_badge_hidden";

// Penanda untuk staf toko di perangkat yang MEMUTAR musik toko: musik berasal dari aplikasi ini, jadi
// tab/aplikasi jangan ditutup. Juga: judul tab diberi awalan, dan browser menanyakan konfirmasi saat tab akan ditutup.
// canPause: Admin, Store, dan Merchant boleh menjeda/melanjutkan musik di perangkat pemutarnya sendiri (+ "lagu berikutnya").
export default function MusicBadge({ isPlayer, canPause = false }: { isPlayer: boolean; canPause?: boolean }) {
  const [m, setM] = useState<{ state?: string; title?: string; note?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [cooling, setCooling] = useState(false);

  // Mengambang: bisa digeser (seret) dan disembunyikan jadi bulatan kecil supaya tidak menutupi menu/form/data.
  // Posisi & status sembunyi diingat di perangkat ini.
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean; last?: { x: number; y: number } } | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null); // null = pojok kiri bawah bawaan
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (p && typeof p.x === "number" && typeof p.y === "number") setPos(p);
      setHidden(localStorage.getItem(HIDE_KEY) === "1");
    } catch {}
  }, []);
  const clamp = (x: number, y: number) => {
    const r = wrap.current?.getBoundingClientRect();
    const w = r?.width || 200, h = r?.height || 40;
    return { x: Math.min(Math.max(4, x), Math.max(4, window.innerWidth - w - 4)), y: Math.min(Math.max(4, y), Math.max(4, window.innerHeight - h - 4)) };
  };
  useEffect(() => {
    const on = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const setHide = (v: boolean) => {
    setHidden(v);
    try { v ? localStorage.setItem(HIDE_KEY, "1") : localStorage.removeItem(HIDE_KEY); } catch {}
    requestAnimationFrame(() => setPos((p) => (p ? clamp(p.x, p.y) : p)));
  };
  const dragProps = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button > 0) return;
      const r = wrap.current?.getBoundingClientRect();
      if (!r) return;
      drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      d.moved = true;
      d.last = clamp(d.ox + dx, d.oy + dy);
      setPos(d.last);
    },
    onPointerUp: () => {
      const d = drag.current;
      if (d?.moved && d.last) { try { localStorage.setItem(POS_KEY, JSON.stringify(d.last)); } catch {} }
      // `moved` dibaca onClick (berikutnya) untuk membatalkan klik setelah menyeret
      setTimeout(() => { drag.current = null; }, 0);
    },
    style: { touchAction: "none" as const, cursor: "grab" },
  };
  const wasDragged = () => !!drag.current?.moved;
  const toggle = () => {
    if (cooling) return;
    emitLocalCommand({ type: "music", payload: { action: playing ? "pause" : "play" } });
    setCooling(true);
    setTimeout(() => setCooling(false), 1500);
  };
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
  const above = pos ? pos.y > window.innerHeight / 2 : true;
  const place = pos ? { left: pos.x, top: pos.y } : { left: 16, bottom: 16 };

  if (hidden) {
    return (
      <div ref={wrap} className="fixed z-[70]" style={place}>
        <button
          {...dragProps}
          onClick={() => { if (!wasDragged()) setHide(false); }}
          aria-label="Tampilkan pemutar musik"
          title="Tampilkan musik (bisa digeser)"
          className={`relative flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg ${m?.note ? "bg-amber-500" : "bg-gray-900"}`}
        >
          <MusicIcon width={18} height={18} />
          {playing && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-gray-900" />}
        </button>
      </div>
    );
  }

  return (
    <div ref={wrap} className="fixed z-[70] max-w-[88vw]" style={place}>
      <div className={`flex max-w-full items-center rounded-full shadow-lg ${m?.note ? "bg-amber-500 text-white" : "bg-gray-900 text-white"}`}>
        <button
          {...dragProps}
          onClick={() => { if (!wasDragged()) setOpen((v) => !v); }}
          title="Seret untuk memindah, ketuk untuk info"
          className="flex min-w-0 items-center gap-2 py-2 pl-3.5 pr-3 text-left text-xs font-medium"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            {playing && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${playing ? "bg-emerald-400" : "bg-white/60"}`} />
          </span>
          <span className="min-w-0">
            <span className="block truncate">{m?.note ? "Musik toko perlu perhatian" : playing ? "Sedang diputar" : "Musik toko dijeda"}</span>
            {m?.title && !m?.note && <span className="block max-w-[55vw] truncate text-[11px] font-normal text-white/70 sm:max-w-xs">{m.title}</span>}
          </span>
        </button>
        {canPause && (
          <button
            onClick={toggle}
            disabled={cooling}
            aria-label={playing ? "Jeda musik" : "Lanjutkan musik"}
            title={playing ? "Jeda" : "Lanjutkan"}
            className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-40"
          >{playing ? <PauseIcon /> : <PlayIcon />}</button>
        )}
        {playing && (
          <button
            onClick={skip}
            disabled={cooling}
            aria-label="Lagu berikutnya"
            title="Lagu berikutnya"
            className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-40"
          ><NextIcon /></button>
        )}
        <button
          onClick={() => setHide(true)}
          aria-label="Sembunyikan pemutar musik"
          title="Sembunyikan (tetap berbunyi)"
          className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      {open && (
        <div className={`absolute left-0 w-[min(20rem,88vw)] rounded-xl bg-white p-3 text-xs leading-relaxed text-gray-600 shadow-xl ring-1 ring-gray-200 ${above ? "bottom-full mb-2" : "top-full mt-2"}`}>
          {m?.note && <p className="mb-1.5 font-medium text-amber-700">{m.note}</p>}
          {m?.title && <p className="mb-1.5 font-medium text-gray-800">{m.title}</p>}
          <p>Musik toko diputar dari <b>aplikasi Offline Torch di perangkat ini</b>. Tombol panah di samping untuk melewati ke lagu berikutnya. <b>Jangan menutup tab atau aplikasi ini</b>, dan jangan mematikan layar, supaya musik tidak berhenti. Playlist, jeda, dan volume diatur dari pusat. Lencana ini bisa <b>digeser</b>, dan tombol silang menyembunyikannya (musik tetap berbunyi).</p>
        </div>
      )}
    </div>
  );
}
