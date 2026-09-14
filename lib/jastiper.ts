// Normalisasi nomor HP Indonesia yang formatnya berantakan di CSV (mis. "62
// 851-7711-4215", "8990656293", "089xxxx") jadi bentuk kanonik "+62..." —
// format ini yang konsisten dipakai di data Shopify (shopify_orders.phone),
// jadi jastiper_phone_number ikut disimpan dalam format yang sama, bukan
// cuma dipakai untuk lookup/dedup internal.
export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  let canonical = digits;
  if (canonical.startsWith("0")) canonical = "62" + canonical.slice(1);
  else if (!canonical.startsWith("62") && canonical.startsWith("8")) canonical = "62" + canonical;
  return "+" + canonical;
}

// Singkatan toko untuk jastiper_code = 3 huruf awal nama toko, huruf besar
// (mis. "Cirebon" -> "CIR", "Karawang" -> "KRW") — dipakai staff toko juga
// saat menulis kode ini manual di kolom Notes Shopify.
export function storeAbbrev(storeName: string): string {
  return (storeName || "").trim().slice(0, 3).toUpperCase();
}

// Format: JS + singkatan toko + 2 digit terakhir no HP (ternormalisasi).
// Contoh: Purwokerto, 62 851-7711-4215 -> "JSPUR15".
export function generateJastiperCode(storeName: string, phoneNumber: string): string {
  const abbrev = storeAbbrev(storeName);
  const normalized = normalizePhone(phoneNumber);
  const last2 = normalized.slice(-2);
  if (!abbrev || !last2) return "";
  return `JS${abbrev}${last2}`;
}

// Rapikan kapitalisasi tiap kata (mis. "AL JASTIP" / "done approach" ->
// "Al Jastip" / "Done Approach") — dipakai untuk jastiper_name dan
// jastiper_respond, baik saat input baru maupun migrasi data lama.
export function toTitleCase(str: string): string {
  return (str || "")
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

// Kode dasar (JS+toko+2 digit HP) bisa bentrok kalau 2 jastiper di toko yang
// sama nomor HP-nya berakhiran sama — supaya tetap bisa dibuat tanpa gagal,
// tambahkan akhiran huruf (B, C, D, ...) sampai ketemu yang belum dipakai di
// toko itu. `existingCodes` harus berisi kode-kode yang SUDAH dipakai di toko
// yang sama (dari baris lain, tidak termasuk baris yang sedang diedit).
export function resolveCodeCollision(baseCode: string, existingCodes: Set<string>): string {
  if (!baseCode) return baseCode;
  if (!existingCodes.has(baseCode)) return baseCode;
  for (let i = 0; i < 26; i++) {
    const suffix = String.fromCharCode(66 + i); // B, C, D, ...
    const candidate = `${baseCode}${suffix}`;
    if (!existingCodes.has(candidate)) return candidate;
  }
  // Kasus ekstrem (>26 tabrakan di kode dasar yang sama) — tambahkan angka
  // urut sebagai fallback terakhir supaya tidak pernah gagal generate.
  let n = 2;
  while (existingCodes.has(`${baseCode}-${n}`)) n++;
  return `${baseCode}-${n}`;
}

export const JASTIPER_RESPOND_OPTIONS = [
  "Interested",
  "Done approach",
  "Joined Group",
  "Canceled",
] as const;

export const JASTIPER_STATUS_OPTIONS = ["Active", "Inactive"] as const;
