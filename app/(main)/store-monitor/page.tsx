"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import EventLog from "@/components/store-monitor/EventLog";
import PlaylistManager from "@/components/store-monitor/PlaylistManager";
import ScheduleEditor from "@/components/store-monitor/ScheduleEditor";
import { BatteryIcon, BoltIcon, CalendarIcon, ClockIcon, MegaphoneIcon, MusicIcon, MuteIcon, NextIcon, PauseIcon, PencilIcon, PlayIcon, PowerIcon, PrevIcon, RefreshIcon, ShuffleIcon, VolumeIcon } from "@/components/store-monitor/icons";
import { ago, type Device, type Live, type Playlist, type Rule, type StoreMusic } from "@/components/store-monitor/types";

type Status = "connecting" | "live" | "off" | "unconfigured";
type Tab = "devices" | "playlists" | "history";

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

  const doAnnounce = (target: Record<string, unknown>, label: string) => {
    const text = prompt(`Pengumuman untuk ${label}:`);
    if (!text) return;
    const sec = Number(prompt("Tampil berapa detik?", "30")) || 30;
    send("announce", target, { text, seconds: sec });
  };
  const rename = async (d: Device) => {
    const label = prompt("Nama perangkat", d.label || "");
    if (label === null) return;
    await fetch("/api/devices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device_id: d.device_id, label }) });
    loadAll();
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
  const btn = "inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-50 disabled:opacity-40";

  return (
    <div className="p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">Store Monitor</h1>
          <p className="text-xs text-gray-500">
            {onlineCount} dari {devices.length} perangkat online ·{" "}
            <span className={live_ ? "text-emerald-600" : status === "connecting" ? "text-amber-600" : "text-red-500"}>
              {live_ ? "live" : status === "connecting" ? "menyambung…" : status === "unconfigured" ? "realtime belum dikonfigurasi" : "terputus"}
            </span>
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-xs">
          {([["devices", "Perangkat"], ["playlists", "Playlist"], ["history", "Riwayat"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-3 py-1 ${tab === k ? "bg-white font-medium text-gray-800 shadow-sm" : "text-gray-500"}`}>{l}</button>
          ))}
        </div>
      </div>

      {status === "unconfigured" && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Env <code>ABLY_API_KEY</code> belum diset di server. Status live aktif setelah env diisi dan di-redeploy.
        </div>
      )}

      {tab === "playlists" && <PlaylistManager playlists={playlists} onChanged={loadAll} />}
      {tab === "history" && <div className="max-w-3xl rounded-xl border border-gray-200 bg-white p-4"><EventLog /></div>}

      {tab === "devices" && (
        <>
          <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/95 p-2.5 backdrop-blur">
            <span className="text-[11px] font-medium text-gray-500">Target: {scopeLabel}</span>
            {selected.size > 0 && <button className={btn} onClick={() => setSelected(new Set())}>Batal pilih</button>}
            <span className="mx-1 h-4 w-px bg-gray-200" />
            <select defaultValue="" onChange={(e) => { if (e.target.value) send("music", scopeTarget(), { action: "load", playlist_id: Number(e.target.value) }); e.target.value = ""; }} disabled={!live_} className={btn}>
              <option value="">Ganti playlist…</option>
              {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className={btn} disabled={!live_} onClick={() => send("music", scopeTarget(), { action: "play" })}><PlayIcon /> Play</button>
            <button className={btn} disabled={!live_} onClick={() => send("music", scopeTarget(), { action: "pause" })}><PauseIcon /> Pause</button>
            <button className={btn} disabled={!live_} onClick={() => send("music", scopeTarget(), { action: "mute", muted: true })}><MuteIcon /> Mute</button>
            <button className={btn} disabled={!live_} onClick={() => send("music", scopeTarget(), { action: "mute", muted: false })}><VolumeIcon /> Unmute</button>
            <button className={btn} disabled={!live_} onClick={() => send("music", scopeTarget(), { action: "shuffle", shuffle: true })}><ShuffleIcon /> Acak: nyala</button>
            <button className={btn} disabled={!live_} onClick={() => send("music", scopeTarget(), { action: "shuffle", shuffle: false })}><ShuffleIcon /> Acak: mati</button>
            <button className={btn} disabled={!live_} onClick={() => doAnnounce(scopeTarget(), scopeLabel)}><MegaphoneIcon /> Pengumuman</button>
            <button className={btn} onClick={() => setEditing({ title: scopeLabel, users: selected.size ? [...selected] : stores.map((s) => s.user_name) })}><CalendarIcon /> Jadwal</button>
            <button className={btn} disabled={!live_} onClick={() => confirm(`Muat ulang perangkat ${scopeLabel}?`) && send("reload", scopeTarget())}><RefreshIcon /> Reload</button>
          </div>

          {stores.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada perangkat toko yang terdaftar. Perangkat muncul otomatis setelah akun toko login.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {stores.map((s) => {
                const m = musicOf(s.user_name);
                const tablet = s.devices.find((d) => d.kind === "tablet");
                const tl = tablet ? live[tablet.device_id] : undefined;
                const target = { user_names: [s.user_name] };
                const hasSchedule = schedule.some((r) => r.user_name === s.user_name);
                return (
                  <div key={s.user_name} className={`rounded-xl border bg-white p-4 shadow-sm ${selected.has(s.user_name) ? "border-gray-800" : "border-gray-200"}`}>
                    <div className="mb-3 flex items-center gap-2">
                      <input type="checkbox" checked={selected.has(s.user_name)} onChange={() => setSelected((p) => { const n = new Set(p); n.has(s.user_name) ? n.delete(s.user_name) : n.add(s.user_name); return n; })} />
                      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{s.name}</h2>
                      <button className={btn} disabled={!live_} onClick={() => confirm(`Muat ulang ${s.name}?`) && send("reload", target)}><RefreshIcon /></button>
                    </div>

                    <div className="space-y-2">
                      {s.devices.map((d) => {
                        const l = live[d.device_id];
                        return (
                          <div key={d.device_id} className="flex items-start gap-2 text-xs">
                            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${l ? "bg-emerald-500" : "bg-gray-300"}`} />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-700">{d.label || (d.kind === "tablet" ? "Tablet" : "PC")}{d.label && <span className="ml-1 font-normal text-gray-400">{d.kind === "tablet" ? "Tablet" : "PC"}</span>}</p>
                              {l ? (
                                <p className="flex items-center gap-1 truncate text-gray-500">
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
                            <div className="flex shrink-0 gap-1 text-[11px] text-gray-400">
                              <button onClick={() => rename(d)} title="Ubah nama" className="hover:text-gray-700"><PencilIcon /></button>
                              <button onClick={() => setHistoryFor(d)} title="Riwayat" className="hover:text-gray-700"><ClockIcon /></button>
                              {isSuper && <button onClick={() => disconnect(d)} title="Putuskan (logout paksa)" className="hover:text-red-500"><PowerIcon /></button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {tablet && (
                      <div className="mt-3 rounded-lg bg-gray-50 p-2.5 text-xs">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 font-medium text-gray-600"><MusicIcon /> Musik</span>
                          <button onClick={() => setEditing({ title: s.name, users: [s.user_name] })} className="text-[11px] text-gray-500 hover:underline">
                            {hasSchedule ? "Jadwal aktif" : "Atur jadwal"}
                          </button>
                        </div>
                        <p className="mb-1.5 truncate text-gray-500">
                          {tl?.music?.title ? <span className="inline-flex items-center gap-1">{tl.music.state === "playing" ? <PlayIcon width={11} height={11} /> : <PauseIcon width={11} height={11} />}<span className="truncate">{tl.music.title}</span></span> : tl ? (m?.playing ? "Menunggu pemutaran…" : "Tidak memutar") : "Tablet offline"}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select value={m?.playlist_id ?? ""} disabled={!live_} onChange={(e) => e.target.value && send("music", target, { action: "load", playlist_id: Number(e.target.value) })} className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-1.5 py-1 text-[11px]">
                            <option value="">— playlist —</option>
                            {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <button className={btn} disabled={!live_} onClick={() => send("music", target, { action: "prev" })}><PrevIcon /></button>
                          <button className={btn} disabled={!live_} onClick={() => send("music", target, { action: m?.playing === false || tl?.music?.state !== "playing" ? "play" : "pause" })}>
                            {tl?.music?.state === "playing" ? <PauseIcon /> : <PlayIcon />}
                          </button>
                          <button className={btn} disabled={!live_} onClick={() => send("music", target, { action: "next" })}><NextIcon /></button>
                          <button
                            className={`${btn} ${m?.shuffle !== false ? "!border-gray-800 !text-gray-800" : ""}`}
                            title={m?.shuffle !== false ? "Acak nyala (klik untuk mematikan)" : "Acak mati (klik untuk menyalakan)"}
                            disabled={!live_}
                            onClick={() => send("music", target, { action: "shuffle", shuffle: m?.shuffle === false })}
                          ><ShuffleIcon /></button>
                          <button className={btn} disabled={!live_} onClick={() => send("music", target, { action: "mute", muted: !m?.muted })}>{m?.muted ? <MuteIcon /> : <VolumeIcon />}</button>
                        </div>
                        <input
                          key={`${s.user_name}-${m?.volume}`}
                          type="range" min={0} max={100} defaultValue={m?.volume ?? 50} disabled={!live_}
                          onMouseUp={(e) => send("music", target, { action: "volume", volume: Number((e.target as HTMLInputElement).value) })}
                          onTouchEnd={(e) => send("music", target, { action: "volume", volume: Number((e.target as HTMLInputElement).value) })}
                          className="mt-2 w-full"
                        />
                      </div>
                    )}
                    <div className="mt-2 text-right">
                      <button className="text-[11px] text-gray-400 hover:underline" disabled={!live_} onClick={() => doAnnounce(target, s.name)}><span className="inline-flex items-center gap-1"><MegaphoneIcon width={12} height={12} /> Pengumuman toko ini</span></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
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
