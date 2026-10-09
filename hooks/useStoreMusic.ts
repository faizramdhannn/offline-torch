"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDeviceId, onDeviceCommand, setPresenceExtra } from "./useDevicePresence";
import { activeRule, type ScheduleRule } from "@/lib/musicSchedule";

// Pemutar musik toko (hanya TABLET akun Store/Merchant). YouTube IFrame API di elemen tersembunyi;
// dikendalikan dari dashboard lewat perintah Ably + jadwal per jam (WIB). Layout (main) tidak ikut
// di-unmount saat pindah halaman, jadi musik tidak terputus.
interface Playlist { id: number; name?: string; list: string; video: string }
interface Desired { playlist: Playlist | null; volume: number; muted: boolean; playing: boolean; shuffle: boolean }

declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

export function useStoreMusic(user: { role?: string } | null | undefined) {
  const [needTap, setNeedTap] = useState(false);
  const startRef = useRef<(() => void) | null>(null);
  const eligible = !!user && (user.role === "store" || user.role === "merchant");
  // Hanya SATU perangkat per toko yang memutar musik: pilihan dari dashboard, default tablet.
  const [isPlayer, setIsPlayer] = useState(false);

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    const check = async () => {
      const id = getDeviceId();
      if (!id) return;
      try {
        const r = await fetch(`/api/music/state?deviceId=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setIsPlayer(!!d.player);
      } catch {}
    };
    const off = onDeviceCommand(({ type, payload }) => {
      if (type === "music" && payload.action === "role") check();
    });
    return () => { cancelled = true; off(); };
  }, [eligible]);

  useEffect(() => {
    if (!eligible || !isPlayer) return;
    let cancelled = false;
    let player: any = null;
    let ready = false;
    let want: Desired = { playlist: null, volume: 50, muted: false, playing: false, shuffle: true };
    // Setelah playlist dimuat: acak + mulai dari lagu acak (daftar lagu baru diketahui setelah YouTube memuatnya)
    let startPending = false;
    let loadedId: number | null = null;
    let rules: ScheduleRule[] = [];
    let playlists = new Map<number, Playlist>();
    let lastActive: number | undefined;
    let tick: ReturnType<typeof setInterval> | null = null;
    let blockTimer: ReturnType<typeof setTimeout> | null = null;

    const report = () => {
      if (!player || !ready) return;
      const st = player.getPlayerState?.();
      const name = st === 1 ? "playing" : st === 2 ? "paused" : st === 3 ? "buffering" : "idle";
      setPresenceExtra({ music: { state: name, title: player.getVideoData?.()?.title || "", playlist: want.playlist?.name || "", volume: want.volume, muted: want.muted, shuffle: want.shuffle } });
    };

    const apply = () => {
      if (!player || !ready) return;
      try {
        player.setVolume(want.volume);
        want.muted ? player.mute() : player.unMute();
        const pl = want.playlist;
        if (want.playing && pl) {
          if (loadedId !== pl.id) {
            loadedId = pl.id;
            if (pl.list) {
              player.loadPlaylist({ list: pl.list, listType: "playlist", index: 0 });
              startPending = true;
            } else player.loadPlaylist([pl.video]);
            player.setLoop(true);
          } else if (player.getPlayerState() !== 1) player.playVideo();
          // YouTube menahan autoplay tanpa interaksi: kalau 4 detik kemudian belum berputar, minta satu ketukan
          if (blockTimer) clearTimeout(blockTimer);
          blockTimer = setTimeout(() => !cancelled && setNeedTap(want.playing && player.getPlayerState() !== 1 && player.getPlayerState() !== 3), 4000);
        } else {
          player.pauseVideo();
          setNeedTap(false);
        }
        report();
      } catch {}
      syncWake();
    };

    // Dipanggil saat status pemutar berubah: begitu daftar lagu diketahui, terapkan acak & titik mulai acak.
    const applyShuffleStart = () => {
      if (!startPending || !player) return;
      let ids: string[] = [];
      try { ids = player.getPlaylist?.() || []; } catch {}
      if (!ids.length) return;
      startPending = false;
      try {
        if (want.shuffle) {
          player.setShuffle(true);
          player.playVideoAt(Math.floor(Math.random() * ids.length));
        } else player.setShuffle(false);
      } catch {}
    };

    const fromRule = (r: ScheduleRule | null): Desired => ({
      playlist: r?.playlist_id ? playlists.get(r.playlist_id) || null : null,
      volume: r ? r.volume : want.volume,
      muted: false,
      playing: !!r && !!r.playlist_id,
      shuffle: r ? r.shuffle !== false : want.shuffle,
    });

    const load = async () => {
      try {
        const res = await fetch("/api/music/state", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        playlists = new Map((d.playlists || []).map((p: Playlist) => [Number(p.id), { ...p, id: Number(p.id) }]));
        rules = (d.rules || []).map((r: ScheduleRule) => ({ ...r, id: Number(r.id), playlist_id: r.playlist_id == null ? null : Number(r.playlist_id) }));
        const s = d.state;
        const manual: Desired = {
          playlist: s?.playlist_id ? playlists.get(Number(s.playlist_id)) || null : null,
          volume: s?.volume ?? 50,
          muted: !!s?.muted,
          playing: s ? !!s.playing : false,
          shuffle: s ? s.shuffle !== false : true,
        };
        const act = rules.length ? activeRule(rules) : null;
        if (!rules.length) want = manual;
        else if (act) {
          // perintah manual yang lebih baru dari awal jendela jadwal menang
          const manualNewer = s && new Date(s.updated_at).getTime() >= act.startMs;
          want = manualNewer ? manual : { ...fromRule(act.rule), muted: manual.muted };
        } else want = { ...manual, playing: false };
        lastActive = act ? act.rule.id : 0;
        apply();
      } catch {}
    };

    const checkSchedule = () => {
      if (!rules.length) return;
      const act = activeRule(rules);
      const id = act ? act.rule.id : 0;
      if (id === lastActive) return;
      lastActive = id;
      want = act ? { ...fromRule(act.rule), muted: want.muted } : { ...want, playing: false };
      apply();
    };

    const off = onDeviceCommand(async ({ type, payload }) => {
      if (type !== "music") return;
      const a = payload.action;
      if (a === "refresh") { loadedId = null; await load(); return; }
      if (a === "load" && payload.playlist) {
        const p = payload.playlist as Playlist;
        playlists.set(Number(p.id), { ...p, id: Number(p.id), name: playlists.get(Number(p.id))?.name });
        want = { ...want, playlist: playlists.get(Number(p.id))!, playing: true };
        loadedId = null;
        apply();
        // nama playlist untuk tampilan dashboard
        fetch("/api/music/state", { cache: "no-store" }).then((r) => r.json()).then((d) => {
          const f = (d.playlists || []).find((x: any) => Number(x.id) === Number(p.id));
          if (f && want.playlist?.id === Number(p.id)) { want.playlist.name = f.name; report(); }
        }).catch(() => {});
      } else if (a === "play") { want = { ...want, playing: true }; apply(); }
      else if (a === "pause") { want = { ...want, playing: false }; apply(); }
      else if (a === "volume") { want = { ...want, volume: Number(payload.volume) }; apply(); }
      else if (a === "mute") { want = { ...want, muted: !!payload.muted }; apply(); }
      else if (a === "shuffle") {
        want = { ...want, shuffle: payload.shuffle !== false };
        try { player.setShuffle(want.shuffle); } catch {}
      }
      else if (a === "next") { try { player.nextVideo(); } catch {} }
      else if (a === "prev") { try { player.previousVideo(); } catch {} }
    });

    // Tahan layar tetap menyala saat musik seharusnya berbunyi: layar mati/terkunci membuat browser
    // menghentikan halaman (dan audionya). Wake Lock dilepas otomatis oleh browser saat tab disembunyikan,
    // jadi diminta ulang tiap tab kembali terlihat.
    let lock: any = null;
    const syncWake = async () => {
      try {
        const wl = (navigator as any).wakeLock;
        if (!wl) return;
        if (want.playing && document.visibilityState === "visible") {
          if (!lock || lock.released) lock = await wl.request("screen");
        } else if (lock && !lock.released) {
          await lock.release();
          lock = null;
        }
      } catch {}
    };
    const wakeTimer = setInterval(syncWake, 15_000);
    document.addEventListener("visibilitychange", syncWake);

    const unlock = () => {
      if (want.playing && player && ready && player.getPlayerState() !== 1) { try { player.playVideo(); } catch {} }
      setNeedTap(false);
    };
    startRef.current = unlock;
    document.addEventListener("pointerdown", unlock, { once: true });

    (async () => {
      const YT = await loadYouTubeApi();
      if (cancelled) return;
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:fixed;left:-10000px;top:0;width:200px;height:200px;pointer-events:none";
      const inner = document.createElement("div");
      wrap.appendChild(inner);
      document.body.appendChild(wrap);
      player = new YT.Player(inner, {
        width: "200", height: "200",
        playerVars: { autoplay: 1, controls: 0, playsinline: 1, rel: 0 },
        events: {
          onReady: () => { ready = true; load(); },
          onStateChange: () => { applyShuffleStart(); report(); if (player.getPlayerState() === 1) setNeedTap(false); },
          onAutoplayBlocked: () => setNeedTap(true),
          // video tidak boleh disematkan / tidak ada → lompat ke lagu berikutnya
          onError: () => { try { player.nextVideo(); } catch {} },
        },
      });
      (player as any).__wrap = wrap;
      tick = setInterval(checkSchedule, 30_000);
    })();

    return () => {
      cancelled = true;
      off();
      if (tick) clearInterval(tick);
      if (blockTimer) clearTimeout(blockTimer);
      clearInterval(wakeTimer);
      document.removeEventListener("visibilitychange", syncWake);
      try { lock?.release?.(); } catch {}
      document.removeEventListener("pointerdown", unlock);
      startRef.current = null;
      try { player?.destroy?.(); (player as any)?.__wrap?.remove(); } catch {}
      setPresenceExtra({ music: null });
    };
  }, [eligible, isPlayer]);

  const start = useCallback(() => startRef.current?.(), []);
  return { needTap, start };
}
