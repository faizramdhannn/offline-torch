import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { audit } from "@/lib/audit";
import { actorName, sessionUser } from "@/lib/authz";
import { publishCommand, realtimeConfigured } from "@/lib/ablyServer";
import { DEVICE_ID_RE, ensureDevicesSchema } from "@/lib/devices";

export const dynamic = "force-dynamic";

const MUSIC_ACTIONS = ["load", "play", "pause", "volume", "mute", "shuffle", "preset", "next", "prev"];

// Kirim perintah ke perangkat toko lewat Ably. Izin (user_setting) ditegakkan proxy; tercatat di activity log.
// target: { all } | { user_names: [...] } | { deviceId }
// type: music (Admin & Super Admin) | reload, announce, logout, navigate (hanya Super Admin)
export async function POST(request: NextRequest) {
  if (!realtimeConfigured()) return NextResponse.json({ error: "Realtime belum dikonfigurasi" }, { status: 503 });
  const me = await sessionUser(request);
  const b = await request.json().catch(() => ({}));
  const type = String(b.type || "");
  if (!["reload", "logout", "navigate", "announce", "music"].includes(type)) {
    return NextResponse.json({ error: "Perintah tidak dikenal" }, { status: 400 });
  }
  // Admin (pemegang akses Settings) hanya boleh mengatur musik; reload, pengumuman, logout, dan pindah halaman = Super Admin.
  if (type !== "music" && me?.role !== "super_admin") {
    return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  }

  const t = b.target || {};
  const target: Record<string, unknown> = {};
  if (t.deviceId) {
    if (!DEVICE_ID_RE.test(String(t.deviceId))) return NextResponse.json({ error: "deviceId tidak valid" }, { status: 400 });
    target.deviceId = String(t.deviceId);
  } else if (Array.isArray(t.user_names) && t.user_names.length) {
    target.user_names = t.user_names.slice(0, 100).map((x: unknown) => String(x).slice(0, 80));
  } else if (t.all === true) target.all = true;
  else return NextResponse.json({ error: "Target kosong" }, { status: 400 });

  const p = b.payload || {};
  const payload: Record<string, unknown> = {};
  if (type === "navigate") {
    const path = String(p.path || "");
    if (!/^\/[A-Za-z0-9/_-]*$/.test(path)) return NextResponse.json({ error: "Path tidak valid" }, { status: 400 });
    payload.path = path;
  }
  if (type === "announce") {
    const text = String(p.text || "").trim().slice(0, 300);
    if (!text) return NextResponse.json({ error: "Teks pengumuman kosong" }, { status: 400 });
    payload.text = text;
    payload.seconds = Math.min(600, Math.max(5, Number(p.seconds) || 30));
  }
  if (type === "music") {
    const action = String(p.action || "");
    if (!MUSIC_ACTIONS.includes(action)) return NextResponse.json({ error: "Aksi musik tidak dikenal" }, { status: 400 });
    payload.action = action;
    await ensureDevicesSchema();
    // toko yang terdampak (untuk menyimpan status keinginan: playlist, volume, mute, play/pause)
    let stores: string[];
    if (target.all) {
      stores = (await sql`SELECT user_name FROM app_users WHERE active = true AND role IN ('store','merchant')`).map((r: any) => r.user_name);
    } else if (target.user_names) stores = target.user_names as string[];
    else {
      stores = (await sql`SELECT user_name FROM store_devices WHERE device_id = ${target.deviceId as string}`).map((r: any) => r.user_name);
    }
    const by = actorName(request);
    if (action === "preset") {
      // Satu perintah = playlist + volume + acak sekaligus (hemat panggilan dibanding tiga perintah terpisah)
      const id = Number(p.playlist_id);
      const pl = await sql`SELECT id, name, yt_list, yt_video FROM music_playlists WHERE id = ${id}`;
      if (!pl.length) return NextResponse.json({ error: "Playlist tidak ditemukan" }, { status: 404 });
      const v = Math.min(100, Math.max(0, Math.round(Number(p.volume))));
      if (!Number.isFinite(v)) return NextResponse.json({ error: "Volume tidak valid" }, { status: 400 });
      const shuffle = p.shuffle !== false;
      payload.playlist = { id: pl[0].id, name: pl[0].name, list: pl[0].yt_list, video: pl[0].yt_video };
      payload.volume = v;
      payload.shuffle = shuffle;
      for (const u of stores) {
        await sql`
          INSERT INTO store_music (user_name, playlist_id, volume, muted, playing, shuffle, updated_by)
          VALUES (${u}, ${id}, ${v}, false, true, ${shuffle}, ${by})
          ON CONFLICT (user_name) DO UPDATE SET playlist_id = ${id}, volume = ${v}, muted = false, playing = true,
            shuffle = ${shuffle}, updated_by = ${by}, updated_at = now()`;
      }
    } else if (action === "load") {
      const id = Number(p.playlist_id);
      const pl = await sql`SELECT id, name, yt_list, yt_video FROM music_playlists WHERE id = ${id}`;
      if (!pl.length) return NextResponse.json({ error: "Playlist tidak ditemukan" }, { status: 404 });
      payload.playlist = { id: pl[0].id, name: pl[0].name, list: pl[0].yt_list, video: pl[0].yt_video };
      for (const u of stores) {
        await sql`
          INSERT INTO store_music (user_name, playlist_id, playing, updated_by) VALUES (${u}, ${id}, true, ${by})
          ON CONFLICT (user_name) DO UPDATE SET playlist_id = ${id}, playing = true, updated_by = ${by}, updated_at = now()`;
      }
    } else if (action === "play" || action === "pause") {
      const playing = action === "play";
      for (const u of stores) {
        await sql`
          INSERT INTO store_music (user_name, playing, updated_by) VALUES (${u}, ${playing}, ${by})
          ON CONFLICT (user_name) DO UPDATE SET playing = ${playing}, updated_by = ${by}, updated_at = now()`;
      }
    } else if (action === "volume") {
      const v = Math.min(100, Math.max(0, Math.round(Number(p.volume))));
      if (!Number.isFinite(v)) return NextResponse.json({ error: "Volume tidak valid" }, { status: 400 });
      payload.volume = v;
      for (const u of stores) {
        await sql`
          INSERT INTO store_music (user_name, volume, updated_by) VALUES (${u}, ${v}, ${by})
          ON CONFLICT (user_name) DO UPDATE SET volume = ${v}, updated_by = ${by}, updated_at = now()`;
      }
    } else if (action === "shuffle") {
      const shuffle = p.shuffle !== false;
      payload.shuffle = shuffle;
      for (const u of stores) {
        await sql`
          INSERT INTO store_music (user_name, shuffle, updated_by) VALUES (${u}, ${shuffle}, ${by})
          ON CONFLICT (user_name) DO UPDATE SET shuffle = ${shuffle}, updated_by = ${by}, updated_at = now()`;
      }
    } else if (action === "mute") {
      const muted = p.muted === true;
      payload.muted = muted;
      for (const u of stores) {
        await sql`
          INSERT INTO store_music (user_name, muted, updated_by) VALUES (${u}, ${muted}, ${by})
          ON CONFLICT (user_name) DO UPDATE SET muted = ${muted}, updated_by = ${by}, updated_at = now()`;
      }
    }
  }

  try {
    await publishCommand({ type, target, payload, ts: Date.now() });
  } catch (e) {
    console.error("device command", e);
    return NextResponse.json({ error: "Gagal mengirim perintah" }, { status: 502 });
  }
  audit(request, "POST", `Perintah perangkat: ${type} ${JSON.stringify(payload)} → ${JSON.stringify(target)}`.slice(0, 400), "device");
  return NextResponse.json({ ok: true });
}
