import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { audit } from "@/lib/audit";
import { actorName } from "@/lib/authz";
import { ensureDevicesSchema } from "@/lib/devices";
import { normalizeHours } from "@/lib/storeHours";
import { publishCommand, realtimeConfigured } from "@/lib/ablyServer";

export const dynamic = "force-dynamic";

// Jam buka toko (per hari + hari libur) untuk satu atau beberapa toko. Dipakai peringatan "tablet offline"
// dan (opsional) musik otomatis mengikuti jam buka. Izin: store_monitor / user_setting (proxy).
export async function PUT(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const users: string[] = (Array.isArray(b.user_names) ? b.user_names : []).slice(0, 100).map((x: unknown) => String(x).slice(0, 80));
  if (!users.length) return NextResponse.json({ error: "Toko kosong" }, { status: 400 });
  const h = normalizeHours(b);
  if (!h) return NextResponse.json({ error: "Jam buka tidak valid (jam tutup harus setelah jam buka)" }, { status: 400 });
  await ensureDevicesSchema();
  // Akun Admin tidak punya jadwal/jam buka: musiknya hanya manual (tidak auto-play).
  const adm = await sql`SELECT user_name FROM app_users WHERE role = 'admin' AND user_name = ANY(${users})`;
  if (adm.length) return NextResponse.json({ error: "Akun Admin hanya manual: tidak bisa diberi jadwal/jam buka" }, { status: 400 });
  const by = actorName(request);
  for (const u of users) {
    await sql`
      INSERT INTO store_hours (user_name, weekly, closed_dates, follow, updated_by)
      VALUES (${u}, ${JSON.stringify(h.weekly)}::jsonb, ${JSON.stringify(h.closed_dates)}::jsonb, ${h.follow}, ${by})
      ON CONFLICT (user_name) DO UPDATE SET weekly = ${JSON.stringify(h.weekly)}::jsonb, closed_dates = ${JSON.stringify(h.closed_dates)}::jsonb,
        follow = ${h.follow}, updated_by = ${by}, updated_at = now()`;
  }
  // tablet memuat ulang jam bukanya tanpa menunggu reload
  if (realtimeConfigured()) {
    await publishCommand({ type: "music", target: { user_names: users }, payload: { action: "refresh" }, ts: Date.now() }).catch(() => {});
  }
  audit(request, "PUT", `Jam buka diubah untuk ${users.length} toko`, "music");
  return NextResponse.json({ ok: true });
}
