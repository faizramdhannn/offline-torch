import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { sessionUser } from "@/lib/authz";
import { ensureDevicesSchema } from "@/lib/devices";

export const dynamic = "force-dynamic";

// Aturan pengumuman terjadwal yang berlaku untuk toko SENDIRI (dari sesi). Dibaca perangkat toko sekali
// saat dimuat; jam pemicunya dihitung di perangkat (tanpa cron/polling di server).
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  await ensureDevicesSchema();
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // tanggal WIB
  const rows = await sql`
    SELECT id, text, seconds, recurrence, days, day_of_month, run_date, time_min, start_date, end_date, active
    FROM announce_schedule
    WHERE active = true
      AND (all_stores = true OR user_names ? ${user.user_name})
      AND (recurrence <> 'once' OR run_date >= ${today})
      AND (end_date = '' OR end_date >= ${today})`;
  const sb = await sql`SELECT value FROM monitor_prefs WHERE key = 'standby'`;
  const standby_text = String((sb[0]?.value as any)?.[0]?.text || "");
  return NextResponse.json({ rules: rows, standby_text }, { headers: { "Cache-Control": "no-store" } });
}
