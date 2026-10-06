import { NextRequest, NextResponse } from "next/server";
import { takeSnapshot } from "@/lib/usersBackup";

export const dynamic = "force-dynamic";

// Vercel Cron harian: snapshot user & role (disimpan 60 terakhir).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = await takeSnapshot("harian (cron)", "cron");
  return NextResponse.json({ success: true, id });
}
