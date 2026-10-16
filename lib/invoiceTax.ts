// PPN pada dokumen: harga barang SUDAH TERMASUK PPN (harga jual). Bila "tampilkan PPN" dicentang, dokumen menampilkan
// harga TANPA PPN (DPP) per baris + PPN, dan total tetap sama dengan total harga (tidak bertambah).
//   DPP baris  = total baris × 100 / (100 + tarif)      (dibulatkan ke rupiah)
//   PPN        = total − Σ DPP baris                    (jadi DPP + PPN = total, tanpa selisih pembulatan)
export interface TaxLineIn { qty: number; unit_price: number }
export interface TaxLine { total_incl: number; total_excl: number; unit_excl: number }
export interface TaxBreakdown { lines: TaxLine[]; dpp: number; ppn: number; total: number; withTax: boolean }

export function taxBreakdown(items: TaxLineIn[], taxPercent: number): TaxBreakdown {
  const rate = Math.max(0, Number(taxPercent) || 0);
  const lines = items.map((it) => {
    const qty = Number(it.qty) || 0;
    const total_incl = Math.round(qty * (Number(it.unit_price) || 0));
    if (rate <= 0) return { total_incl, total_excl: total_incl, unit_excl: Number(it.unit_price) || 0 };
    // Harga satuan tanpa PPN dihitung dari harga satuan (bukan total ÷ qty) supaya harga sama → angka sama, berapa pun qty-nya
    const unit_excl = Math.round(((Number(it.unit_price) || 0) * 100 / (100 + rate)) * 100) / 100;
    const total_excl = Math.round(qty * unit_excl);
    return { total_incl, total_excl, unit_excl };
  });
  const total = lines.reduce((s, l) => s + l.total_incl, 0);
  if (rate <= 0) return { lines, dpp: total, ppn: 0, total, withTax: false };
  const dpp = lines.reduce((s, l) => s + l.total_excl, 0);
  return { lines, dpp, ppn: total - dpp, total, withTax: true };
}

// Item untuk TAMPILAN dokumen (detail, PDF, Word). Dokumen baru ("inclusive") dengan PPN dicentang menampilkan harga & total
// baris tanpa PPN; dokumen lama ("legacy") atau tanpa PPN ditampilkan apa adanya.
export function displayItems<T extends { qty: number; unit_price: number; total_price: number }>(
  doc: { tax_mode?: string; tax_percent: number },
  items: T[]
): T[] {
  if (doc.tax_mode !== "inclusive" || !(Number(doc.tax_percent) > 0)) return items;
  const bd = taxBreakdown(items, doc.tax_percent);
  return items.map((it, i) => ({ ...it, unit_price: Math.round(bd.lines[i].unit_excl * 100) / 100, total_price: bd.lines[i].total_excl }));
}
