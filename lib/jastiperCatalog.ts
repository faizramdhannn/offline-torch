import { ONLINE_GROUPS, onlineGroupOf, parseColors } from "./onlineCatalogMap";

// Katalog Jastiper — data dari sheet `jastiper_catalog` (spreadsheet yang sama dengan Online/Clearance).
// Hasilnya satu file JSON kecil di Vercel Blob (dibuat harian oleh GitHub Actions, jam yang sama dengan PDF katalog);
// halaman publik membaca file itu langsung dari CDN, jadi pengunjung tidak menyentuh Sheets/Vercel function.
//
// Kolom sheet (baris 1 = header): sku, item_name, display_name, tier_product, collection_product, artikel, warna,
// kategori, harga_normal, diskon, harga_tampil, foto_utama, semua_foto, stok, habis, product_tampil.
//   - stok sudah dikurangi buffer 5 → stok ≤ 0 = tidak tersedia.
//   - stok ikut ditampilkan (per warna & total per produk).
//   - product_tampil = FALSE → baris (SKU) itu dibuang sama sekali, tidak ditulis ke JSON (kosong/TRUE = tampil).
//   - tier_product hanya info internal → TIDAK dimasukkan ke JSON.
// Privasi/kuota: SKU stok 0 tidak ditulis sama sekali. Satu-satunya pengecualian: warna yang habis pada artikel yang
// masih punya warna lain ready, ditulis hanya sebagai nama warna + penanda `soldOut` (tanpa foto/harga).

export const JASTIPER_KEY = "jastiper";
export const JASTIPER_SHEET = "jastiper_catalog";
export const JASTIPER_OTHER_GROUP = "Lainnya";
export const MAX_PHOTOS = 9;

export interface JColor {
  name: string;
  hex: string;
  soldOut?: boolean;
  stock?: number; // stok tampil (sudah dikurangi buffer) — hanya untuk warna ready
  images?: string[]; // foto_utama dulu, lalu semua_foto (maks 9)
  price?: number; // harga tampil (setelah diskon)
  normal?: number; // harga normal — hanya bila lebih tinggi dari harga tampil (dicoret)
}

export interface JProduct {
  id: string;
  name: string;
  group: string;
  collection?: string;
  colors: JColor[]; // yang ready dulu, yang habis di belakang
}

export interface JastiperData {
  updated: string; // ISO
  groups: string[]; // urutan grup yang punya produk
  products: JProduct[]; // sudah urut: grup → A–Z
}

const num = (v: unknown): number => {
  const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
};
const str = (v: unknown): string => String(v ?? "").trim();

// Kategori yang masuk grup Accessories; sisanya yang tidak terpetakan (Apparel, Sandal, Prayer Set, dst.) → "Lainnya".
const ACCESSORY_CATEGORIES = new Set(["accessories", "pelengkap", "watch", "brand kolaborasi"]);

export function jastiperGroupOf(category: string, artikel: string): string {
  const g = onlineGroupOf(category, artikel); // kategori kosong → tebak dari nama artikel
  if (g !== "Accessories") return g;
  // onlineGroupOf menjatuhkan semua yang tak dikenal ke "Accessories": di sini hanya kategori accessories yang tetap,
  // sisanya (Apparel, Sandal, Prayer Set, dst.) masuk "Lainnya" di akhir.
  return ACCESSORY_CATEGORIES.has(category.trim().toLowerCase()) ? "Accessories" : JASTIPER_OTHER_GROUP;
}

export function jastiperGroupIndex(group: string): number {
  const i = ONLINE_GROUPS.findIndex((g) => g.name === group);
  return i === -1 ? ONLINE_GROUPS.length : i;
}

const photoKey = (u: string) => u.split("?")[0];

function photos(main: string, all: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of [main, ...all.split(";")].map((x) => x.trim())) {
    if (!/^https?:\/\//i.test(u) || seen.has(photoKey(u))) continue;
    seen.add(photoKey(u));
    out.push(u);
    if (out.length >= MAX_PHOTOS) break;
  }
  return out;
}

export function buildJastiperCatalog(rows: any[], now: Date = new Date()): JastiperData {
  type Col = { name: string; stock: number; images: string[]; price: number; normal: number };
  type Art = { name: string; category: string; collection: string; cols: Map<string, Col>; order: string[] };
  const arts = new Map<string, Art>();

  for (const r of rows) {
    const artikel = str(r.artikel);
    if (!artikel) continue;
    if (str(r.product_tampil).toUpperCase() === "FALSE") continue; // diatur dari sheet: jangan tampilkan SKU ini
    const id = artikel.toUpperCase();
    let a = arts.get(id);
    if (!a) {
      a = { name: str(r.display_name) || artikel, category: "", collection: "", cols: new Map(), order: [] };
      arts.set(id, a);
    }
    if (!a.category) a.category = str(r.kategori);
    if (!a.collection) a.collection = str(r.collection_product);
    const warna = str(r.warna) || "Default";
    const ck = warna.toUpperCase();
    let c = a.cols.get(ck);
    if (!c) {
      c = { name: warna, stock: 0, images: [], price: 0, normal: 0 };
      a.cols.set(ck, c);
      a.order.push(ck);
    }
    const stok = num(r.stok);
    if (stok <= 0) continue; // SKU habis: tidak ada datanya
    c.stock += stok;
    if (c.images.length === 0) c.images = photos(str(r.foto_utama), str(r.semua_foto));
    c.price = Math.max(c.price, num(r.harga_tampil));
    c.normal = Math.max(c.normal, num(r.harga_normal));
  }

  const products: JProduct[] = [];
  for (const [id, a] of arts) {
    const ready = a.order.map((k) => a.cols.get(k)!).filter((c) => c.stock > 0);
    if (ready.length === 0) continue; // semua warna habis → tidak ditampilkan
    const spare = ready.find((c) => c.images.length)?.images ?? []; // warna tanpa foto meminjam foto warna lain
    const colors: JColor[] = ready.map((c) => ({
      name: c.name,
      hex: parseColors(c.name)[0]?.hex ?? "#cbd5e1",
      stock: c.stock,
      images: c.images.length ? c.images : spare,
      ...(c.price > 0 ? { price: c.price } : {}),
      ...(c.normal > c.price && c.price > 0 ? { normal: c.normal } : {}),
    }));
    for (const k of a.order) {
      const c = a.cols.get(k)!;
      if (c.stock <= 0) colors.push({ name: c.name, hex: parseColors(c.name)[0]?.hex ?? "#cbd5e1", soldOut: true });
    }
    products.push({
      id,
      name: a.name,
      group: jastiperGroupOf(a.category, a.name),
      ...(a.collection ? { collection: a.collection } : {}),
      colors,
    });
  }

  products.sort(
    (x, y) => jastiperGroupIndex(x.group) - jastiperGroupIndex(y.group) || x.name.localeCompare(y.name, "id", { sensitivity: "base" })
  );
  const groups = [...new Set(products.map((p) => p.group))];
  return { updated: now.toISOString(), groups, products };
}

// Baca sheet lalu susun. null = tidak ada produk (sheet kosong/gagal terbaca) → jangan menimpa data yang sudah tayang.
export async function loadJastiperCatalog(): Promise<JastiperData | null> {
  const { getSheetData } = await import("./sheets"); // dinamis: paket Sheets besar tidak ikut bundle klien/route lain
  let data = buildJastiperCatalog((await getSheetData(JASTIPER_SHEET)) as any[]);
  if (data.products.length === 0) data = buildJastiperCatalog((await getSheetData(JASTIPER_SHEET, { skipCache: true })) as any[]);
  return data.products.length ? data : null;
}
