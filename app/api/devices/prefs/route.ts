import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { ensureDevicesSchema } from "@/lib/devices";

export const dynamic = "force-dynamic";

// Preset suasana, grup toko, dan template pengumuman — dibagi ke semua admin (dibaca bersama /api/devices).
const KEYS = ["presets", "groups", "templates", "standby"];

export async function PUT(request: NextRequest) {
  const b = await request.json().catch(() => ({}));
  const key = String(b.key || "");
  if (!KEYS.includes(key) || !Array.isArray(b.value) || b.value.length > 100) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  const json = JSON.stringify(b.value);
  if (json.length > 50_000) return NextResponse.json({ error: "Data terlalu besar" }, { status: 400 });
  await ensureDevicesSchema();
  await sql`
    INSERT INTO monitor_prefs (key, value) VALUES (${key}, ${json}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = ${json}::jsonb, updated_at = now()`;
  return NextResponse.json({ ok: true });
}
