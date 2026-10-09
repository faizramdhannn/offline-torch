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
  const [devices, playlists, music, schedule] = await Promise.all([
    sql`
      SELECT d.device_id, d.user_name, d.store_name, d.kind, d.label, d.last_seen, d.online, d.battery, d.charging
      FROM store_devices d
      JOIN app_users u ON u.user_name = d.user_name AND u.active = true
      WHERE d.revoked = false
      ORDER BY d.store_name ASC, d.kind ASC
    `,
    sql`SELECT id, name, url FROM music_playlists ORDER BY name ASC`,
    sql`SELECT user_name, playlist_id, volume, muted, playing, shuffle FROM store_music`,
    sql`SELECT id, user_name, days, start_min, end_min, playlist_id, volume, shuffle FROM music_schedule ORDER BY user_name, start_min`,
  ]);
  checkDeviceAlerts().catch(() => {});
  return NextResponse.json({ devices, playlists, music, schedule }, { headers: { "Cache-Control": "no-store" } });
}

// Ubah nama perangkat.
export async function PATCH(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const id = String(b.device_id || "");
  if (!DEVICE_ID_RE.test(id)) return NextResponse.json({ error: "device_id tidak valid" }, { status: 400 });
  const label = String(b.label || "").trim().slice(0, 60);
  await ensureDevicesSchema();
  await sql`UPDATE store_devices SET label = ${label} WHERE device_id = ${id}`;
  audit(request, "PUT", `Nama perangkat diubah: ${label || "(kosong)"}`, "device", id);
  return NextResponse.json({ ok: true });
}

// Putuskan perangkat (hanya Super Admin): logout paksa perangkat itu saja, akun & perangkat lain tidak terpengaruh.
export async function DELETE(request: NextRequest) {
  const me = await sessionUser(request);
  if (me?.role !== "super_admin") return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const id = String(b.device_id || "");
  if (!DEVICE_ID_RE.test(id)) return NextResponse.json({ error: "device_id tidak valid" }, { status: 400 });
  await ensureDevicesSchema();
  await sql`UPDATE store_devices SET revoked = true WHERE device_id = ${id}`;
  if (realtimeConfigured()) {
    await publishCommand({ type: "logout", target: { deviceId: id }, ts: Date.now() }).catch(() => {});
  }
  audit(request, "DELETE", "Perangkat diputuskan (logout paksa)", "device", id);
  return NextResponse.json({ ok: true });
}
