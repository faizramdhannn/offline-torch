import { NextRequest, NextResponse } from "next/server";
import { sessionUser } from "@/lib/authz";
import { computeCapture } from "@/lib/dashboardSummary";
import { todayWIB } from "@/lib/attendanceTime";
import { jsonWithEtag } from "@/lib/etag";

export const dynamic = "force-dynamic";

// Absensi toko (Capture Attendance) untuk satu tanggal — dipakai panah kiri/kanan di kartu "Absensi Toko" dashboard.
// Data dari sheet attendance_store yang sudah ter-cache server (5 menit). Aturan akses: prefix /api/dashboard (izin dashboard).
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });
  const date = request.nextUrl.searchParams.get("date") || todayWIB();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
  try {
    return jsonWithEtag(request, await computeCapture(date));
  } catch (e) {
    console.error("dashboard capture:", e);
    return NextResponse.json({ error: "Gagal memuat absensi" }, { status: 500 });
  }
}
