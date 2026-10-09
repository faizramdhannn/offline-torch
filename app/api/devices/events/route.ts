import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { DEVICE_ID_RE, ensureDevicesSchema } from "@/lib/devices";

export const dynamic = "force-dynamic";

// Riwayat kejadian perangkat (online/offline/terdaftar). ?device_id= untuk satu perangkat, kosong = terbaru semua.
export async function GET(request: NextRequest) {
  await ensureDevicesSchema();
  const id = new URL(request.url).searchParams.get("device_id") || "";
  const rows = DEVICE_ID_RE.test(id)
    ? await sql`SELECT device_id, event, detail, at FROM device_events WHERE device_id = ${id} ORDER BY at DESC LIMIT 50`
    : await sql`
        SELECT e.device_id, e.event, e.detail, e.at, d.store_name, d.kind, d.label
        FROM device_events e LEFT JOIN store_devices d ON d.device_id = e.device_id
        ORDER BY e.at DESC LIMIT 50`;
  return NextResponse.json({ events: rows }, { headers: { "Cache-Control": "no-store" } });
}
