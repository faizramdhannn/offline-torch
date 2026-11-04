import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { sessionUser } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { ensureDevicesSchema } from "@/lib/devices";
import { checkDeviceAlerts } from "@/lib/deviceAlerts";
import { publishCommand, realtimeConfigured } from "@/lib/ablyServer";
import { DEVICE_ID_RE } from "@/lib/devices";

export const dynamic = "force-dynamic";

// Ringkasan untuk dashboard: perangkat, playlist, musik per toko, jadwal.
// Status online/offline LIVE datang dari presence Ably; kolom online di sini hasil webhook (untuk riwayat/peringatan).
export async function GET(_request: NextRequest) {
  await ensureDevicesSchema();
  const [devices, playlists, music, schedule, prefs, hours] = await Promise.all([
    sql`
      SELECT d.device_id, d.user_name, d.store_name, d.kind, d.label, d.last_seen, d.online, d.battery, d.charging, d.music_player, u.role
      FROM store_devices d
      JOIN app_users u ON u.user_name = d.user_name AND u.active = true
      WHERE d.revoked = false
        AND d.last_seen > now() - interval '24 hours'  -- perangkat yang >24 jam tidak muncul/login disembunyikan (perangkat aktif memperbarui last_seen tiap jam)
      ORDER BY d.store_name ASC, d.kind ASC
    `,
    sql`SELECT id, name, url FROM music_playlists ORDER BY name ASC`,
    sql`SELECT user_name, playlist_id, volume, muted, playing, shuffle, enabled FROM store_music`,
    sql`SELECT id, user_name, days, start_min, end_min, playlist_id, volume, shuffle FROM music_schedule ORDER BY user_name, start_min`,
    sql`SELECT key, value FROM monitor_prefs`,
    sql`SELECT user_name, weekly, closed_dates, follow FROM store_hours`,
  ]);
  checkDeviceAlerts().catch(() => {});
  const prefMap: Record<string, unknown> = {};
  for (const r of prefs as any[]) prefMap[r.key] = r.value;
  return NextResponse.json({ devices, playlists, music, schedule, prefs: prefMap, hours }, { headers: { "Cache-Control": "no-store" } });
}

// Ubah nama perangkat dan/atau jadikan perangkat ini pemutar musik toko.
// Pemutar selalu satu per toko: menyalakan satu perangkat otomatis mematikan yang lain (tidak pernah bunyi dobel).
export async function PATCH(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const id = String(b.device_id || "");
  if (!DEVICE_ID_RE.test(id)) return NextResponse.json({ error: "device_id tidak valid" }, { status: 400 });
  await ensureDevicesSchema();
  if (typeof b.label === "string") {
    const label = b.label.trim().slice(0, 60);
    await sql`UPDATE store_devices SET label = ${label} WHERE device_id = ${id}`;
    audit(request, "PUT", `Nama perangkat diubah: ${label || "(kosong)"}`, "device", id);
  }
  if (b.music_player === true) {
    // Perangkat milik akun Admin: hanya Super Admin atau Admin yang boleh menjadikannya pemutar musik.
    const own = await sql`SELECT u.role FROM store_devices d JOIN app_users u ON u.user_name = d.user_name WHERE d.device_id = ${id}`;
    const meRole = (await sessionUser(request))?.role;
    if (own[0]?.role === "admin" && meRole !== "super_admin" && meRole !== "admin") {
      return NextResponse.json({ error: "Musik akun Admin hanya bisa diatur Super Admin atau Admin" }, { status: 403 });
    }
    const r = await sql`UPDATE store_devices SET music_player = true WHERE device_id = ${id} RETURNING user_name`;
    if (!r.length) return NextResponse.json({ error: "Perangkat tidak ditemukan" }, { status: 404 });
    const store = r[0].user_name as string;
    await sql`UPDATE store_devices SET music_player = false WHERE user_name = ${store} AND device_id <> ${id}`;
    if (realtimeConfigured()) {
      await publishCommand({ type: "music", target: { user_names: [store] }, payload: { action: "role" }, ts: Date.now() }).catch(() => {});
    }
    audit(request, "PUT", "Perangkat dijadikan pemutar musik toko", "device", id);
  }
  return NextResponse.json({ ok: true });
}

// Putuskan perangkat (hanya Super Admin): logout paksa perangkat itu saja, akun & perangkat lain tidak terpengaruh.
export async function DELETE(request: NextRequest) {
  const me = await sessionUser(request);
  if (me?.role !== "super_admin") return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  await ensureDevicesSchema();

  // Reset massal: semua perangkat toko (Store/Merchant), atau hanya toko terpilih → harus login ulang.
  // Perangkat online di-logout lewat Ably; yang offline keluar saat mendaftar lagi (register menjawab revoked).
  if (b.all === true || (Array.isArray(b.user_names) && b.user_names.length)) {
    const names: string[] | null = b.all === true ? null : b.user_names.slice(0, 200).map((x: unknown) => String(x).slice(0, 80));
    const rows = (await sql`
      UPDATE store_devices d SET revoked = true
      FROM app_users u
      WHERE u.user_name = d.user_name AND u.role IN ('store', 'merchant') AND d.revoked = false
        AND (${names === null}::boolean OR d.user_name = ANY(${names || []}::text[]))
      RETURNING d.device_id, d.user_name
    `) as { device_id: string; user_name: string }[];
    const stores = [...new Set(rows.map((r) => r.user_name))];
    if (realtimeConfigured()) {
      for (let i = 0; i < stores.length; i += 50) {
        await publishCommand({ type: "logout", target: { user_names: stores.slice(i, i + 50) }, ts: Date.now() }).catch(() => {});
      }
    }
    audit(request, "DELETE", `Reset login perangkat: ${rows.length} perangkat di ${stores.length} toko${names ? " (dipilih)" : " (semua)"}`, "device", "bulk");
    return NextResponse.json({ ok: true, devices: rows.length, stores: stores.length });
  }

  const id = String(b.device_id || "");
  if (!DEVICE_ID_RE.test(id)) return NextResponse.json({ error: "device_id tidak valid" }, { status: 400 });
  await sql`UPDATE store_devices SET revoked = true WHERE device_id = ${id}`;
  if (realtimeConfigured()) {
    await publishCommand({ type: "logout", target: { deviceId: id }, ts: Date.now() }).catch(() => {});
  }
  audit(request, "DELETE", "Perangkat diputuskan (logout paksa)", "device", id);
  return NextResponse.json({ ok: true });
}
