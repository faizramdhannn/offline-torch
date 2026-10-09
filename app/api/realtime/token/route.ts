import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { createToken, realtimeConfigured } from "@/lib/ablyServer";
import { sql } from "@/lib/neon";
import { DEVICE_ID_RE, ensureDevicesSchema } from "@/lib/devices";

export const dynamic = "force-dynamic";

// Token Ably untuk perangkat/pemantau yang sedang login. clientId = deviceId (perangkat) atau monitor:<user>.
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  if (!realtimeConfigured()) return NextResponse.json({ error: "Realtime belum dikonfigurasi" }, { status: 503 });
  const dev = new URL(request.url).searchParams.get("deviceId") || "";
  let clientId = `monitor:${user.user_name}`;
  if (DEVICE_ID_RE.test(dev)) {
    // clientId perangkat hanya boleh dipakai akun yang mendaftarkannya (cegah menyamar sebagai perangkat lain)
    await ensureDevicesSchema();
    const own = await sql`SELECT 1 FROM store_devices WHERE device_id = ${dev} AND user_name = ${user.user_name} AND revoked = false`;
    if (!own.length) return NextResponse.json({ error: "Perangkat belum terdaftar" }, { status: 403 });
    clientId = dev;
  }
  try {
    return NextResponse.json(await createToken(clientId), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("realtime token", e);
    return NextResponse.json({ error: "Gagal membuat token", detail: String((e as Error).message || "").slice(0, 250) }, { status: 502 });
  }
}
