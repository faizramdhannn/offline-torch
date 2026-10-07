import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/neon";
import { ensureUsersSchema } from "@/lib/users";
import { jsonWithEtag } from "@/lib/etag";

export const dynamic = "force-dynamic";

// Direktori lokasi store = akun ber-role Store/Merchant yang aktif (profil: nama, telepon, alamat, foto).
// Bentuk baris sengaja sama dengan /api/store-address (id, store_location, phone_number, address, status)
// supaya Dashboard & Request Tracking tidak perlu diubah besar-besaran; ditambah role, email, photo_url.
export async function GET(request: NextRequest) {
  try {
    await ensureUsersSchema();
    const rows = await sql`
      SELECT id, user_name, name, role, email, phone, address, photo_url
      FROM app_users
      WHERE active = true AND role IN ('store', 'merchant')
      ORDER BY name ASC
    `;

    // Masa transisi: profil yang belum diisi telepon/alamatnya ditutup dari data toko di sheet (tanpa menyimpannya).
    let fallback: Map<string, { phone_number: string; address: string }> | null = null;
    if (rows.some((r: any) => !r.phone || !r.address)) {
      try {
        const { getStoreAddressList } = await import("@/lib/storeAddress");
        const key = (s: string) => String(s || "").trim().toLowerCase();
        fallback = new Map((await getStoreAddressList()).map((s) => [key(s.store_location), s]));
      } catch {
        fallback = null;
      }
    }

    const data = rows.map((r: any) => {
      const fb = fallback?.get(String(r.name || "").trim().toLowerCase()) || fallback?.get(String(r.user_name || "").trim().toLowerCase());
      return {
        id: r.id as string,
        store_location: r.name as string,
        phone_number: (r.phone || fb?.phone_number || "") as string,
        address: (r.address || fb?.address || "") as string,
        status: "Active",
        role: r.role as string,
        email: (r.email || "") as string,
        photo_url: (r.photo_url || "") as string,
      };
    });
    return jsonWithEtag(request, data);
  } catch (e) {
    console.error("store-directory", e);
    return NextResponse.json({ error: "Gagal memuat direktori store" }, { status: 500 });
  }
}
