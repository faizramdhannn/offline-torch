import { NextRequest, NextResponse } from "next/server";
import { sql, ensureAnnouncementSchema } from "@/lib/neon";
import { uploadToGoogleDrive } from "@/lib/drive";

// Hanya user dengan id ini yang boleh mengubah announcement bar. Dicek di
// server (bukan cuma disembunyikan di UI) supaya tidak bisa dilewati dengan
// memanggil endpoint ini langsung — tapi tetap soft-auth (id dikirim oleh
// client di body, bukan session token asli), konsisten dengan pola auth
// existing di app ini (localStorage-based user object, bukan server session).
const ANNOUNCEMENT_EDITOR_ID = "260917112001";

export async function GET() {
  try {
    await ensureAnnouncementSchema();
    const rows = await sql`SELECT message, active, image_url, link_text, update_by, update_at FROM app_announcement WHERE id = 1`;
    const row = rows[0] || { message: "", active: false, image_url: "", link_text: "" };
    return NextResponse.json({
      message: row.message || "",
      active: !!row.active,
      image_url: row.image_url || "",
      link_text: row.link_text || "",
      update_by: row.update_by || "",
      update_at: row.update_at || "",
    });
  } catch (error) {
    console.error("Error fetching announcement:", error);
    return NextResponse.json({ error: "Gagal mengambil announcement" }, { status: 500 });
  }
}

// FormData (bukan JSON) karena gambarnya opsional dan bisa ikut di-upload
// bersamaan dengan teks announcement dalam satu request.
export async function PUT(request: NextRequest) {
  try {
    await ensureAnnouncementSchema();
    const formData = await request.formData();
    const userId = formData.get("userId") as string;
    const username = (formData.get("username") as string) || "";
    const message = (formData.get("message") as string) || "";
    const active = formData.get("active") === "true";
    const linkText = (formData.get("linkText") as string) || "";
    const removeImage = formData.get("removeImage") === "true";
    const file = formData.get("image") as File | null;

    if (String(userId) !== ANNOUNCEMENT_EDITOR_ID) {
      return NextResponse.json({ error: "Tidak punya akses untuk mengubah announcement" }, { status: 403 });
    }

    const existing = await sql`SELECT image_url FROM app_announcement WHERE id = 1`;
    let imageUrl = existing[0]?.image_url || "";

    if (removeImage) {
      imageUrl = "";
    } else if (file && file.size > 0) {
      const fileBuffer = await file.arrayBuffer();
      imageUrl = await uploadToGoogleDrive(
        Buffer.from(fileBuffer),
        `announcement_${Date.now()}`,
        file.type,
        "announcement",
        true // makePublicImage — announcement image must render as <img> for every user
      );
    }

    await sql`
      UPDATE app_announcement
      SET message = ${message}, active = ${active}, image_url = ${imageUrl}, link_text = ${linkText},
          update_by = ${username}, update_at = now()
      WHERE id = 1
    `;

    return NextResponse.json({ success: true, image_url: imageUrl });
  } catch (error) {
    console.error("Error updating announcement:", error);
    return NextResponse.json({ error: "Gagal menyimpan announcement" }, { status: 500 });
  }
}
