import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { audit } from "@/lib/audit";
import { actorName, sessionUser } from "@/lib/authz";
import { ensureDevicesSchema } from "@/lib/devices";
import { publishCommand, realtimeConfigured } from "@/lib/ablyServer";

export const dynamic = "force-dynamic";

// Pengumuman terjadwal — hanya Super Admin (membaca & mengubah). Perangkat toko membaca lewat /mine.
const RECURRENCE = ["once", "daily", "weekly", "monthly"];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

async function superOnly(request: NextRequest) {
  const me = await sessionUser(request);
  return me?.role === "super_admin" ? me : null;
}

function parse(b: any): { ok: true; v: any } | { ok: false; error: string } {
  const text = String(b.text || "").trim().slice(0, 300);
  if (!text) return { ok: false, error: "Teks pengumuman wajib diisi" };
  const recurrence = String(b.recurrence || "");
  if (!RECURRENCE.includes(recurrence)) return { ok: false, error: "Pengulangan tidak valid" };
  const time_min = Number(b.time_min);
  if (!Number.isInteger(time_min) || time_min < 0 || time_min > 1439) return { ok: false, error: "Jam tidak valid" };
  const seconds = Math.min(600, Math.max(5, Math.round(Number(b.seconds) || 30)));
  const all_stores = b.all_stores === true;
  const user_names: string[] = Array.isArray(b.user_names) ? b.user_names.slice(0, 100).map((x: unknown) => String(x).slice(0, 80)) : [];
  if (!all_stores && !user_names.length) return { ok: false, error: "Pilih toko tujuan" };
  let days = "";
  let day_of_month: number | null = null;
  let run_date = "";
  if (recurrence === "once") {
    run_date = String(b.run_date || "");
    if (!YMD.test(run_date)) return { ok: false, error: "Tanggal tidak valid" };
  }
  if (recurrence === "weekly") {
    const d = [...new Set(String(b.days || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
    if (!d.length) return { ok: false, error: "Pilih minimal satu hari" };
    days = d.join(",");
  }
  if (recurrence === "monthly") {
    day_of_month = Number(b.day_of_month);
    if (!Number.isInteger(day_of_month) || day_of_month < 1 || day_of_month > 31) return { ok: false, error: "Tanggal bulanan tidak valid" };
  }
  const start_date = recurrence === "once" ? "" : String(b.start_date || "");
  const end_date = recurrence === "once" ? "" : String(b.end_date || "");
  if ((start_date && !YMD.test(start_date)) || (end_date && !YMD.test(end_date))) return { ok: false, error: "Rentang tanggal tidak valid" };
  if (start_date && end_date && end_date < start_date) return { ok: false, error: "Tanggal akhir sebelum tanggal mulai" };
  return {
    ok: true,
    v: { name: String(b.name || "").trim().slice(0, 60), text, seconds, all_stores, user_names, recurrence, days, day_of_month, run_date, time_min, start_date, end_date, active: b.active !== false },
  };
}

// Beri tahu perangkat yang terdampak agar memuat ulang aturannya (tanpa menunggu reload).
async function refresh(all: boolean, users: string[]) {
  if (!realtimeConfigured()) return;
  await publishCommand({ type: "announce_refresh", target: all ? { all: true } : { user_names: users }, payload: {}, ts: Date.now() }).catch(() => {});
}

export async function GET(request: NextRequest) {
  if (!(await superOnly(request))) return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  await ensureDevicesSchema();
  const rows = await sql`SELECT * FROM announce_schedule ORDER BY active DESC, time_min ASC, id ASC`;
  return NextResponse.json({ rules: rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!(await superOnly(request))) return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  const p = parse(await request.json().catch(() => ({})));
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const v = p.v;
  await ensureDevicesSchema();
  const r = await sql`
    INSERT INTO announce_schedule (name, text, seconds, all_stores, user_names, recurrence, days, day_of_month, run_date, time_min, start_date, end_date, active, created_by)
    VALUES (${v.name}, ${v.text}, ${v.seconds}, ${v.all_stores}, ${JSON.stringify(v.user_names)}::jsonb, ${v.recurrence}, ${v.days}, ${v.day_of_month}, ${v.run_date}, ${v.time_min}, ${v.start_date}, ${v.end_date}, ${v.active}, ${actorName(request)})
    RETURNING id`;
  audit(request, "POST", `Pengumuman terjadwal dibuat: ${v.name || v.text.slice(0, 40)}`, "announce", String(r[0].id));
  await refresh(v.all_stores, v.user_names);
  return NextResponse.json({ ok: true, id: r[0].id });
}

export async function PUT(request: NextRequest) {
  if (!(await superOnly(request))) return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const id = Number(b.id);
  if (!id) return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  const p = parse(b);
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const v = p.v;
  await ensureDevicesSchema();
  await sql`
    UPDATE announce_schedule SET name = ${v.name}, text = ${v.text}, seconds = ${v.seconds}, all_stores = ${v.all_stores},
      user_names = ${JSON.stringify(v.user_names)}::jsonb, recurrence = ${v.recurrence}, days = ${v.days}, day_of_month = ${v.day_of_month},
      run_date = ${v.run_date}, time_min = ${v.time_min}, start_date = ${v.start_date}, end_date = ${v.end_date}, active = ${v.active}, updated_at = now()
    WHERE id = ${id}`;
  audit(request, "PUT", `Pengumuman terjadwal diubah: ${v.name || v.text.slice(0, 40)}`, "announce", String(id));
  await refresh(true, []); // toko tujuan bisa berubah → semua perangkat memuat ulang aturannya
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (!(await superOnly(request))) return NextResponse.json({ error: "Hanya Super Admin" }, { status: 403 });
  const id = Number((await request.json().catch(() => ({}))).id);
  if (!id) return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  await ensureDevicesSchema();
  await sql`DELETE FROM announce_schedule WHERE id = ${id}`;
  audit(request, "DELETE", "Pengumuman terjadwal dihapus", "announce", String(id));
  await refresh(true, []);
  return NextResponse.json({ ok: true });
}
