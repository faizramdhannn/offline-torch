// Normalisasi nomor HP Indonesia yang formatnya berantakan di CSV (mis. "62
// 851-7711-4215", "8990656293", "089xxxx") jadi bentuk kanonik berawalan
// "62" tanpa spasi/simbol — dipakai untuk lookup ke shopify_orders.phone dan
// untuk 2 digit terakhir di jastiper_code.
export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
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

export const JASTIPER_RESPOND_OPTIONS = [
  "Interested",
  "Done approach",
  "Joined Group",
  "Canceled",
] as const;

export const JASTIPER_STATUS_OPTIONS = ["Active", "Inactive"] as const;
