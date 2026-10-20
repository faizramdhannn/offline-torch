// Akun Store/Merchant boleh melihat stok semua toko & merchant (gudang yang punya akun Store/Merchant),
// tetapi tidak gudang partner (Neka, Gramedia, Vega, Metro, ...) yang tidak punya akun.
// Nama akun ("Torch Cirebon") dicocokkan dengan nilai kolom `warehouse` di sheet ("Torch Store Cirebon - T").
// Murni (tanpa DB) — dipakai server (`/api/stock`) dan tes.

function norm(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/\s*-\s*t\s*$/, "")   // akhiran " - T"
    .replace(/\bstore\b/g, " ")    // "Torch Store Lembong" == "Torch Lembong"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isStoreScoped(role?: string | null): boolean {
  return role === "store" || role === "merchant";
}

// Apakah `warehouse` milik akun ini? Cocok bila nama akun sama, atau "torch <user_name>" (mis. user_name "lembong").
export function warehouseBelongsTo(account: { name?: string; user_name?: string }, warehouse: string): boolean {
  const w = norm(warehouse);
  if (!w) return false;
  if (account.name && norm(account.name) === w) return true;
  if (account.user_name && w === norm(`torch ${account.user_name}`)) return true;
  return false;
}

// Baris stok yang boleh dilihat Store/Merchant: gudang yang cocok dengan salah satu akun Store/Merchant (aktif atau tidak).
export function scopeStockRows<T extends { warehouse?: string; Warehouse?: string }>(
  rows: T[],
  accounts: { name?: string; user_name?: string }[]
): T[] {
  return rows.filter((r) => {
    const w = String(r.warehouse ?? r.Warehouse ?? "");
    return accounts.some((a) => warehouseBelongsTo(a, w));
  });
}
