import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { sql } from "@/lib/neon";
import { DEVICE_ID_RE, ensureDevicesSchema, logDeviceEvent, normalizeKind } from "@/lib/devices";

export const dynamic = "force-dynamic";

// Perangkat mendaftar / memperbarui "terakhir terlihat". Hanya akun Store & Merchant.
// Satu akun boleh dipakai di banyak perangkat (kunci = deviceId). Identitas toko dari sesi, bukan body.
// Jika super admin "memutuskan" perangkat ini, jawabannya {revoked:true} sekali → klien logout, baris dihapus.
export async function POST(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  // Store & Merchant (perangkat toko) + Admin (hanya untuk pemutar musik manual — lihat docs/STORE-MONITOR.md)
  if (user.role !== "store" && user.role !== "merchant" && user.role !== "admin") return NextResponse.json({ ok: true, skipped: true });
  const b = await request.json().catch(() => ({}));
  const deviceId = String(b.deviceId || "");
  if (!DEVICE_ID_RE.test(deviceId)) return NextResponse.json({ error: "deviceId tidak valid" }, { status: 400 });
  const kind = normalizeKind(b.kind);
  const ua = String(request.headers.get("user-agent") || "").slice(0, 300);
  await ensureDevicesSchema();
  const cur = await sql`SELECT revoked FROM store_devices WHERE device_id = ${deviceId}`;
  if (cur[0]?.revoked) {
    await sql`DELETE FROM store_devices WHERE device_id = ${deviceId}`;
    return NextResponse.json({ ok: true, revoked: true });
  }
  await sql`
    INSERT INTO store_devices (device_id, user_name, store_name, kind, user_agent)
    VALUES (${deviceId}, ${user.user_name}, ${user.name}, ${kind}, ${ua})
    ON CONFLICT (device_id) DO UPDATE
      SET user_name = ${user.user_name}, kind = ${kind}, store_name = ${user.name}, user_agent = ${ua}, last_seen = now()
  `;
  if (!cur.length) await logDeviceEvent(deviceId, "terdaftar", `${user.name} · ${kind}`);
  return NextResponse.json({ ok: true });
}
