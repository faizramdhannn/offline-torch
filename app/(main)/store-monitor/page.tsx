"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import EventLog from "@/components/store-monitor/EventLog";
import PlaylistManager from "@/components/store-monitor/PlaylistManager";
import PresetManager from "@/components/store-monitor/PresetManager";
import AnnounceDialog from "@/components/store-monitor/AnnounceDialog";
import SummaryTab from "@/components/store-monitor/SummaryTab";
import type { Group, Preset, Template } from "@/components/store-monitor/localLists";
import ScheduleEditor from "@/components/store-monitor/ScheduleEditor";
import { BatteryIcon, BoltIcon, CalendarIcon, ClockIcon, MegaphoneIcon, MusicIcon, MuteIcon, NextIcon, PauseIcon, PencilIcon, PlayIcon, PowerIcon, PrevIcon, RefreshIcon, ShuffleIcon, VolumeIcon } from "@/components/store-monitor/icons";
import { ago, type Device, type Live, type Playlist, type Rule, type StoreMusic } from "@/components/store-monitor/types";

type Status = "connecting" | "live" | "off" | "unconfigured";
type Tab = "devices" | "playlists" | "summary" | "history";

export default function StoreMonitorPage() {
  const { user } = useUser();
  const isSuper = (user as any)?.role === "super_admin";
  const allowed = !!(user as any)?.user_setting || isSuper;
  const [tab, setTab] = useState<Tab>("devices");
  const [devices, setDevices] = useState<Device[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [music, setMusic] = useState<StoreMusic[]>([]);
  const [schedule, setSchedule] = useState<Rule[]>([]);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [status, setStatus] = useState<Status>("connecting");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ title: string; users: string[] } | null>(null);
  const [historyFor, setHistoryFor] = useState<Device | null>(null);
  const [toast, setToast] = useState("");
  const [presets, setPresetsState] = useState<Preset[]>([]);
  const [groups, setGroupsState] = useState<Group[]>([]);
  const [templates, setTemplatesState] = useState<Template[]>([]);
  const [announce, setAnnounce] = useState<{ target: Record<string, unknown>; label: string } | null>(null);
  // Preset, grup, dan template tersimpan di database (terlihat di semua admin/browser).
  const savePref = (key: string, value: unknown[]) =>
    fetch("/api/devices/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) }).catch(() => {});
  const setPresets = (v: Preset[]) => { setPresetsState(v); savePref("presets", v); };
  const setGroups = (v: Group[]) => { setGroupsState(v); savePref("groups", v); };
  const setTemplates = (v: Template[]) => { setTemplatesState(v); savePref("templates", v); };
  const [managing, setManaging] = useState(false);
  const [filter, setFilter] = useState<"all" | "offline" | "issue">("all");
  const [sheet, setSheet] = useState(false); // panel aksi (mobile)
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // kartu toko yang dibuka (mobile)
  const knownRef = useRef<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    const r = await fetch("/api/devices", { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setDevices(d.devices || []);
    setPlaylists(d.playlists || []);
    setMusic(d.music || []);
    setSchedule(d.schedule || []);
    knownRef.current = new Set((d.devices || []).map((x: Device) => x.device_id));
    // Preset/grup/template dari database. Data lama yang tersimpan di browser ini dipindahkan sekali.
    const pr = d.prefs || {};
    const take = <T,>(key: string, legacy: string, set: (v: T[]) => void) => {
      if (Array.isArray(pr[key])) return set(pr[key]);
      try {
        const old = JSON.parse(localStorage.getItem(legacy) || "[]");
        if (Array.isArray(old) && old.length) { set(old); savePref(key, old); localStorage.removeItem(legacy); }
      } catch {}
    };
    take<Preset>("presets", "torch_monitor_presets", setPresetsState);
    take<Group>("groups", "torch_monitor_groups", setGroupsState);
    take<Template>("templates", "torch_monitor_templates", setTemplatesState);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    loadAll();
    let cancelled = false;
    let client: any = null;
    (async () => {
      try {
        const probe = await fetch("/api/realtime/token", { cache: "no-store" });
        if (probe.status === 503) return setStatus("unconfigured");
        const Ably = await import("ably");
        if (cancelled) return;
        client = new Ably.Realtime({
          authCallback: async (_p: unknown, cb: (e: any, t: any) => void) => {
            try {
              const r = await fetch("/api/realtime/token", { cache: "no-store" });
              if (!r.ok) throw new Error(String(r.status));
              cb(null, await r.json());
            } catch (e) {
              cb(e, null);
            }
          },
        });
        client.connection.on((c: any) => !cancelled && setStatus(c.current === "connected" ? "live" : c.current === "connecting" ? "connecting" : "off"));
        const ch = client.channels.get("stores");
        const apply = (m: any, present: boolean) => {
          const id = m.clientId as string;
          if (!id || id.startsWith("monitor:")) return;
          setLive((prev) => {
            const next = { ...prev };
            if (present) next[id] = m.data || {};
            else delete next[id];
            return next;
          });
          if (present && !knownRef.current.has(id)) loadAll();
        };
        ch.presence.subscribe(["enter", "update", "present"], (m: any) => apply(m, true));
        ch.presence.subscribe("leave", (m: any) => apply(m, false));
        (await ch.presence.get()).forEach((m: any) => apply(m, true));
      } catch {
        if (!cancelled) setStatus("off");
      }
    })();
    return () => {
      cancelled = true;
      try { client?.close(); } catch {}
    };
  }, [allowed, loadAll]);

  const stores = useMemo(() => {
    const map = new Map<string, { name: string; user_name: string; devices: Device[] }>();
    for (const d of devices) {
      const g = map.get(d.user_name) || { name: d.store_name || d.user_name, user_name: d.user_name, devices: [] };
      g.devices.push(d);
      map.set(d.user_name, g);
    }
    return [...map.values()];
  }, [devices]);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2500); };

  const send = async (type: string, target: Record<string, unknown>, payload: Record<string, unknown> = {}) => {
    const r = await fetch("/api/devices/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, target, payload }),
    });
    if (!r.ok) { flash((await r.json().catch(() => ({}))).error || "Gagal mengirim perintah"); return false; }
    flash("Terkirim");
    if (type === "music") setTimeout(loadAll, 600);
    return true;
  };

  const scopeTarget = (): Record<string, unknown> => (selected.size ? { user_names: [...selected] } : { all: true });
  const scopeLabel = selected.size ? `${selected.size} toko dipilih` : "semua toko";
  const musicOf = (u: string) => music.find((m) => m.user_name === u);
  const live_ = status === "live";

  const doAnnounce = (target: Record<string, unknown>, label: string) => setAnnounce({ target, label });
  const rename = async (d: Device) => {
    const label = prompt("Nama perangkat", d.label || "");
    if (label === null) return;
    await fetch("/api/devices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device_id: d.device_id, label }) });
    loadAll();
  };
  const setPlayer = async (d: Device) => {
    if (!confirm(`Jadikan ${d.label || (d.kind === "tablet" ? "Tablet" : "PC")} ${d.store_name} pemutar musik? Perangkat lain di toko ini berhenti memutar.`)) return;
    const r = await fetch("/api/devices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device_id: d.device_id, music_player: true }) });
    flash(r.ok ? "Pemutar musik diganti" : "Gagal");
    setTimeout(loadAll, 800);
  };
  const disconnect = async (d: Device) => {
    if (!confirm(`Putuskan ${d.label || d.kind} ${d.store_name}? Perangkat ini di-logout paksa; akun & perangkat lain tidak terpengaruh.`)) return;
    const r = await fetch("/api/devices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device_id: d.device_id }) });
    flash(r.ok ? "Perangkat diputus" : "Gagal");
    loadAll();
  };
  const saveSchedule = async (users: string[], rules: Rule[]) => {
    const r = await fetch("/api/music/schedule", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_names: users, rules }) });
    if (!r.ok) { flash((await r.json().catch(() => ({}))).error || "Gagal menyimpan"); return; }
    setEditing(null);
    flash("Jadwal tersimpan");
    loadAll();
  };

  if (!allowed) return <div className="p-6 text-sm text-gray-500">Anda tidak punya akses ke halaman ini.</div>;

  const onlineCount = devices.filter((d) => live[d.device_id]).length;
  const btn = "inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs md:px-2.5 md:py-1 md:text-[11px] text-gray-600 hover:bg-gray-50 disabled:opacity-40";

  const btnCtl = "inline-flex items-center justify-center rounded-md border border-gray-200 bg-white py-2.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40 md:py-1.5";
  const btnLg = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 active:bg-gray-100 disabled:opacity-40";

  // Pemutar musik toko: pilihan eksplisit menang; tanpa pilihan = tablet
  const storeInfo = (s: { devices: Device[] }) => {
    const explicit = s.devices.find((d) => d.music_player === true);
    const tablet = explicit || s.devices.find((d) => d.kind === "tablet");
    const isPlayerDev = (d: Device) => (explicit ? d.device_id === explicit.device_id : d.kind === "tablet");
    const tl = tablet ? live[tablet.device_id] : undefined;
    const offline = s.devices.every((d) => !live[d.device_id]);
    const issue = offline || (!!tablet && (!tl || !!tl.music?.note));
    return { tablet, tl, isPlayerDev, offline, issue };
  };
  const stats = stores.reduce((a, s) => {
    const i = storeInfo(s);
    return { offline: a.offline + (i.offline ? 1 : 0), issue: a.issue + (i.issue ? 1 : 0) };
  }, { offline: 0, issue: 0 });
  const shown = stores.filter((s) => {
    const i = storeInfo(s);
    return filter === "offline" ? i.offline : filter === "issue" ? i.issue : true;
  });

  // Aksi massal: dipakai di toolbar desktop (kecil) dan panel aksi mobile (besar)
  const bulk = (big: boolean) => {
    const b = big ? btnLg : btn;
    const sel = big ? `${btnLg} col-span-2 w-full` : btn;
    const afterSheet = () => { if (big) setSheet(false); };
    return (
      <>
        <select defaultValue="" onChange={(e) => { const g = groups.find((x) => x.name === e.target.value); if (g) setSelected(new Set(g.users.filter((u) => stores.some((s) => s.user_name === u)))); e.target.value = ""; afterSheet(); }} className={sel}>
          <option value="">Pilih grup toko…</option>
          {groups.map((g) => <option key={g.name} value={g.name}>{g.name} ({g.users.length})</option>)}
        </select>
        <select defaultValue="" disabled={!live_} onChange={(e) => { const p = presets.find((x) => x.name === e.target.value); if (p && confirm(`Terapkan preset "${p.name}" ke ${scopeLabel}?`)) { send("music", scopeTarget(), { action: "preset", playlist_id: p.playlist_id, volume: p.volume, shuffle: p.shuffle }); afterSheet(); } e.target.value = ""; }} className={sel}>
          <option value="">Terapkan preset…</option>
          {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <select defaultValue="" onChange={(e) => { if (e.target.value) { send("music", scopeTarget(), { action: "load", playlist_id: Number(e.target.value) }); afterSheet(); } e.target.value = ""; }} disabled={!live_} className={sel}>
          <option value="">Ganti playlist…</option>
          {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className={b} disabled={!live_} onClick={() => { send("music", scopeTarget(), { action: "play" }); afterSheet(); }}><PlayIcon /> Play</button>
        <button className={b} disabled={!live_} onClick={() => { send("music", scopeTarget(), { action: "pause" }); afterSheet(); }}><PauseIcon /> Pause</button>
        <button className={b} disabled={!live_} onClick={() => { send("music", scopeTarget(), { action: "mute", muted: true }); afterSheet(); }}><MuteIcon /> Mute</button>
        <button className={b} disabled={!live_} onClick={() => { send("music", scopeTarget(), { action: "mute", muted: false }); afterSheet(); }}><VolumeIcon /> Unmute</button>
        <button className={b} disabled={!live_} onClick={() => { send("music", scopeTarget(), { action: "shuffle", shuffle: true }); afterSheet(); }}><ShuffleIcon /> Acak: nyala</button>
        <button className={b} disabled={!live_} onClick={() => { send("music", scopeTarget(), { action: "shuffle", shuffle: false }); afterSheet(); }}><ShuffleIcon /> Acak: mati</button>
        <button className={b} disabled={!live_ || !isSuper} onClick={() => { afterSheet(); doAnnounce(scopeTarget(), scopeLabel); }}><MegaphoneIcon /> Pengumuman</button>
        <button className={b} onClick={() => { afterSheet(); setEditing({ title: scopeLabel, users: selected.size ? [...selected] : stores.map((s) => s.user_name) }); }}><CalendarIcon /> Jadwal</button>
        <button className={b} disabled={!live_ || !isSuper} onClick={() => { if (confirm(`Muat ulang perangkat ${scopeLabel}?`)) { send("reload", scopeTarget()); afterSheet(); } }}><RefreshIcon /> Reload</button>
        <button className={b} onClick={() => { afterSheet(); setManaging(true); }}>Kelola preset & grup</button>
      </>
    );
  };

  return (
    <div className="p-4 pb-28 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-800">Store Monitor</h1>
          <p className="text-xs text-gray-500">
            {onlineCount} dari {devices.length} perangkat online ·{" "}
            <span className={live_ ? "text-emerald-600" : status === "connecting" ? "text-amber-600" : "text-red-500"}>
              {live_ ? "live" : status === "connecting" ? "menyambung…" : status === "unconfigured" ? "realtime belum dikonfigurasi" : "terputus"}
            </span>
          </p>
        </div>
        <a href="/panduan-tablet" className="text-xs text-gray-500 underline-offset-2 hover:underline md:order-none">Panduan setup tablet</a>
        <div className="grid w-full grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1 text-xs md:flex md:w-auto">
          {([["devices", "Perangkat"], ["playlists", "Playlist"], ["summary", "Ringkasan"], ["history", "Riwayat"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-2 md:py-1 ${tab === k ? "bg-white font-medium text-gray-800 shadow-sm" : "text-gray-500"}`}>{l}</button>
          ))}
        </div>
      </div>

      {status === "unconfigured" && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Env <code>ABLY_API_KEY</code> belum diset di server. Status live aktif setelah env diisi dan di-redeploy.
        </div>
      )}

      {tab === "playlists" && <PlaylistManager playlists={playlists} onChanged={loadAll} />}
      {tab === "summary" && <SummaryTab />}
      {tab === "history" && <div className="max-w-3xl rounded-xl border border-gray-200 bg-white p-4"><EventLog /></div>}

      {tab === "devices" && (
        <>
          {/* Filter cepat + pilih semua */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            {([["all", `Semua (${stores.length})`], ["offline", `Offline (${stats.offline})`], ["issue", `Perlu dicek (${stats.issue})`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1.5 md:py-1 ${filter === k ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 bg-white text-gray-600"}`}>{l}</button>
            ))}
            <button
              onClick={() => setSelected(selected.size === shown.length ? new Set() : new Set(shown.map((x) => x.user_name)))}
              className="ml-auto rounded-full border border-gray-200 bg-white px-3 py-1.5 text-gray-600 md:py-1"
            >{selected.size === shown.length && shown.length > 0 ? "Batal pilih semua" : "Pilih semua"}</button>
          </div>

          {/* Desktop: toolbar aksi massal */}
          <div className="sticky top-0 z-10 mb-4 hidden flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/95 p-2.5 backdrop-blur md:flex">
            <span className="text-[11px] font-medium text-gray-500">Target: {scopeLabel}</span>
            {selected.size > 0 && <button className={btn} onClick={() => setSelected(new Set())}>Batal pilih</button>}
            <span className="mx-1 h-4 w-px bg-gray-200" />
            {bulk(false)}
          </div>

          {shown.length === 0 ? (
            <p className="text-sm text-gray-400">{stores.length === 0 ? "Belum ada perangkat toko yang terdaftar. Perangkat muncul otomatis setelah akun toko login." : "Tidak ada toko pada filter ini."}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((s) => {
                const m = musicOf(s.user_name);
                const info = storeInfo(s);
                const { tablet, tl, isPlayerDev } = info;
                const target = { user_names: [s.user_name] };
                const hasSchedule = schedule.some((r) => r.user_name === s.user_name);
                const open = expanded.has(s.user_name);
                const nowPlaying = tl?.music?.title
                  ? tl.music.title
                  : tl ? (tl.music?.note || (m?.playing ? "Menunggu pemutaran…" : "Tidak memutar")) : tablet ? "Pemutar offline" : "";
                return (
                  <div key={s.user_name} className={`rounded-xl border bg-white shadow-sm ${selected.has(s.user_name) ? "border-gray-800" : info.issue ? "border-amber-300" : "border-gray-200"}`}>
                    {/* Kepala kartu: selalu terlihat (ringkasan) */}
                    <div className="flex items-center gap-3 p-4">
                      <input type="checkbox" className="h-5 w-5 shrink-0 md:h-4 md:w-4" checked={selected.has(s.user_name)} onChange={() => setSelected((p) => { const n = new Set(p); n.has(s.user_name) ? n.delete(s.user_name) : n.add(s.user_name); return n; })} />
                      <button className="min-w-0 flex-1 text-left md:cursor-default" onClick={() => setExpanded((p) => { const n = new Set(p); n.has(s.user_name) ? n.delete(s.user_name) : n.add(s.user_name); return n; })}>
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-gray-800">{s.name}</span>
                          <span className="flex shrink-0 gap-1">
                            {s.devices.map((d) => <span key={d.device_id} title={d.label || d.kind} className={`h-2 w-2 rounded-full ${live[d.device_id] ? "bg-emerald-500" : "bg-gray-300"}`} />)}
                          </span>
                        </span>
                        {nowPlaying && <span className={`mt-0.5 block truncate text-[11px] md:hidden ${tl?.music?.note ? "text-amber-600" : "text-gray-500"}`}>{nowPlaying}</span>}
                      </button>
                      <button className={`${btn} shrink-0`} disabled={!live_ || !isSuper} onClick={() => confirm(`Muat ulang ${s.name}?`) && send("reload", target)} aria-label="Reload"><RefreshIcon /></button>
                      <button className="shrink-0 p-1 text-gray-400 md:hidden" aria-label={open ? "Tutup" : "Buka"} onClick={() => setExpanded((p) => { const n = new Set(p); n.has(s.user_name) ? n.delete(s.user_name) : n.add(s.user_name); return n; })}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={open ? "rotate-180" : ""}><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                    </div>

                    {/* Isi kartu: di mobile hanya saat dibuka */}
                    <div className={`${open ? "block" : "hidden"} border-t border-gray-100 px-4 pb-4 pt-3 md:block md:border-t-0 md:pt-0`}>
                      <div className="space-y-3 md:space-y-2">
                        {s.devices.map((d) => {
                          const l = live[d.device_id];
                          return (
                            <div key={d.device_id} className="flex items-start gap-2 text-xs">
                              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${l ? "bg-emerald-500" : "bg-gray-300"}`} />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-700">{d.label || (d.kind === "tablet" ? "Tablet" : "PC")}{d.label && <span className="ml-1 font-normal text-gray-400">{d.kind === "tablet" ? "Tablet" : "PC"}</span>}</p>
                                {l ? (
                                  <p className="flex items-center gap-1 text-gray-500">
                                    <span className="truncate">{l.page || "-"}{l.visible === false ? " · tab di latar" : ""}</span>
                                    {typeof l.battery === "number" && (
                                      <span className="inline-flex shrink-0 items-center gap-0.5">
                                        · <BatteryIcon width={12} height={12} />{l.battery}%{l.charging ? <BoltIcon width={11} height={11} className="text-amber-500" /> : null}
                                      </span>
                                    )}
                                  </p>
                                ) : (
                                  <p className="text-gray-400">Offline · terakhir {ago(d.last_seen)}</p>
                                )}
                              </div>
                              <div className="flex shrink-0 gap-0.5 text-gray-400">
                                <button
                                  onClick={() => !isPlayerDev(d) && setPlayer(d)}
                                  title={isPlayerDev(d) ? "Pemutar musik toko ini" : "Jadikan pemutar musik (perangkat lain di toko ini otomatis berhenti)"}
                                  className={`rounded-md p-2 md:p-1 ${isPlayerDev(d) ? "text-gray-800" : "hover:text-gray-700"}`}
                                ><MusicIcon /></button>
                                <button onClick={() => rename(d)} title="Ubah nama" className="rounded-md p-2 hover:text-gray-700 md:p-1"><PencilIcon /></button>
                                <button onClick={() => setHistoryFor(d)} title="Riwayat" className="rounded-md p-2 hover:text-gray-700 md:p-1"><ClockIcon /></button>
                                {isSuper && <button onClick={() => disconnect(d)} title="Putuskan (logout paksa)" className="rounded-md p-2 hover:text-red-500 md:p-1"><PowerIcon /></button>}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {tablet && (
                        <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs md:p-2.5">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 font-medium text-gray-600"><MusicIcon /> Musik<span className="font-normal text-gray-400">· di {tablet.label || (tablet.kind === "tablet" ? "Tablet" : "PC")}</span></span>
                            <button onClick={() => setEditing({ title: s.name, users: [s.user_name] })} className="py-1 text-[11px] text-gray-500 hover:underline">
                              {hasSchedule ? "Jadwal aktif" : "Atur jadwal"}
                            </button>
                          </div>
                          <p className="mb-2 truncate text-gray-500">
                            {tl?.music?.title ? <span className="inline-flex items-center gap-1">{tl.music.state === "playing" ? <PlayIcon width={11} height={11} /> : <PauseIcon width={11} height={11} />}<span className="truncate">{tl.music.title}</span></span> : tl ? (tl.music?.note ? <span className="text-amber-600">{tl.music.note}</span> : m?.playing ? "Menunggu pemutaran…" : "Tidak memutar") : "Perangkat pemutar offline"}
                          </p>
                          <select value={m?.playlist_id ?? ""} disabled={!live_} onChange={(e) => e.target.value && send("music", target, { action: "load", playlist_id: Number(e.target.value) })} className="mb-2 w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-xs md:py-1.5">
                            <option value="">— playlist —</option>
                            {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <div className="grid grid-cols-6 gap-1.5">
                            <button className={btnCtl} disabled={!live_} onClick={() => send("music", target, { action: "prev" })} aria-label="Sebelumnya"><PrevIcon /></button>
                            <button className={btnCtl} disabled={!live_} onClick={() => send("music", target, { action: m?.playing === false || tl?.music?.state !== "playing" ? "play" : "pause" })} aria-label="Play/Pause">
                              {tl?.music?.state === "playing" ? <PauseIcon /> : <PlayIcon />}
                            </button>
                            <button className={btnCtl} disabled={!live_} onClick={() => send("music", target, { action: "next" })} aria-label="Berikutnya"><NextIcon /></button>
                            <button
                              className={`${btnCtl} ${m?.shuffle !== false ? "!border-gray-800 !text-gray-800" : ""}`}
                              title={m?.shuffle !== false ? "Acak nyala" : "Acak mati"}
                              disabled={!live_}
                              onClick={() => send("music", target, { action: "shuffle", shuffle: m?.shuffle === false })}
                              aria-label="Acak"
                            ><ShuffleIcon /></button>
                            <button className={btnCtl} disabled={!live_} onClick={() => send("music", target, { action: "mute", muted: !m?.muted })} aria-label="Mute">{m?.muted ? <MuteIcon /> : <VolumeIcon />}</button>
                            <button className={btnCtl} disabled={!live_ || !isSuper} onClick={() => doAnnounce(target, s.name)} aria-label="Pengumuman"><MegaphoneIcon /></button>
                          </div>
                          <input
                            key={`${s.user_name}-${m?.volume}`}
                            type="range" min={0} max={100} defaultValue={m?.volume ?? 50} disabled={!live_}
                            onPointerUp={(e) => send("music", target, { action: "volume", volume: Number((e.target as HTMLInputElement).value) })}
                            className="mt-3 h-6 w-full md:mt-2 md:h-4"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mobile: bar aksi tetap di bawah + panel aksi */}
          <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-700">Target: {scopeLabel}</p>
              {selected.size > 0 && <button className="text-[11px] text-gray-500 underline" onClick={() => setSelected(new Set())}>Batal pilih</button>}
            </div>
            <button onClick={() => setSheet(true)} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white">Aksi</button>
          </div>
          {sheet && (
            <div className="fixed inset-0 z-50 flex items-end bg-black/40 md:hidden" onClick={() => setSheet(false)}>
              <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Aksi untuk {scopeLabel}</p>
                  <button onClick={() => setSheet(false)} className="px-2 py-1 text-xs text-gray-500">Tutup</button>
                </div>
                <div className="grid grid-cols-2 gap-2">{bulk(true)}</div>
              </div>
            </div>
          )}
        </>
      )}

      {announce && (
        <AnnounceDialog
          label={announce.label}
          templates={templates}
          onTemplates={setTemplates}
          onSend={async (text, seconds) => { if (await send("announce", announce.target, { text, seconds })) setAnnounce(null); }}
          onClose={() => setAnnounce(null)}
        />
      )}
      {managing && (
        <PresetManager presets={presets} groups={groups} playlists={playlists} selected={[...selected]} onPresets={setPresets} onGroups={setGroups} onClose={() => setManaging(false)} />
      )}
      {editing && (
        <ScheduleEditor
          title={editing.title}
          playlists={playlists}
          initial={editing.users.length === 1 ? schedule.filter((r) => r.user_name === editing.users[0]) : []}
          onSave={(rules) => saveSchedule(editing.users, rules)}
          onClose={() => setEditing(null)}
        />
      )}
      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setHistoryFor(null)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Riwayat · {historyFor.store_name} {historyFor.label || historyFor.kind}</h3>
            <EventLog deviceId={historyFor.device_id} />
          </div>
        </div>
      )}
      {toast && <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-xs text-white shadow-lg">{toast}</div>}
    </div>
  );
}
