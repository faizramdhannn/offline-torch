"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, ChevronRight, ImageOff, Printer, Search, X } from "lucide-react";
import type { JastiperData, JColor, JProduct } from "@/lib/jastiperCatalog";
import { ONLINE_GROUPS } from "@/lib/onlineCatalogMap";

// Katalog Jastiper (publik): grid produk + jendela detail dengan galeri foto & pilihan warna.
// Tampilan sengaja berbeda dari katalog Gundam/Women (itu halaman editorial); ini katalog umum yang bisa dicari & difilter.
const LOGO = "https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png";
const ACCENT = "#0b7a8f";

// Foto Shopify bisa diminta dalam ukuran lebih kecil lewat ?width= — hemat data pengunjung.
// ---- Cetak / Simpan PDF: A4 tegak penuh (tanpa margin browser, jadi tanpa kop tanggal/URL/nomor halaman bawaan browser).
// Halaman disusun sendiri (cover + halaman produk 4 × 4 kartu) seperti PDF Online catalog; hanya dirender saat mencetak.
const PRINT_CSS = `
@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { margin: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
.pp { position: relative; width: 210mm; height: 297mm; overflow: hidden; background: #fff; break-after: page; page-break-after: always; font-family: inherit; }
.pp:last-child { break-after: auto; page-break-after: auto; }
`;

const TORCH_ICON = "https://cdn.shopify.com/s/files/1/1615/1301/files/Untitled_design_162c0ca1-c46e-4635-8f4c-bc44d547ee5e.png?v=1770919047";
const GROUP_COLOR: Record<string, string> = { ...Object.fromEntries(ONLINE_GROUPS.map((g) => [g.name, g.color])), Lainnya: "#475569" };
const gcolor = (g: string) => GROUP_COLOR[g] ?? ACCENT;

// Ukuran halaman (mm): isi mulai y=27, tersisa 260; banner grup 11 + jarak 3; satu baris kartu 58 + jarak 3.
const PAGE_CAP = 260, BANNER_SLOT = 14, ROW_SLOT = 61, PER_ROW = 4;
type PRow = { t: "b"; g: string } | { t: "c"; items: JProduct[] };

function paginate(sections: { g: string; items: JProduct[] }[]): PRow[][] {
  const pages: PRow[][] = [];
  let cur: PRow[] = [];
  let used = 0;
  const flush = () => { if (cur.length) pages.push(cur); cur = []; used = 0; };
  for (const { g, items } of sections) {
    if (used + BANNER_SLOT + ROW_SLOT > PAGE_CAP) flush(); // judul grup tidak ditinggal sendirian di dasar halaman
    cur.push({ t: "b", g }); used += BANNER_SLOT;
    for (let i = 0; i < items.length; i += PER_ROW) {
      if (used + ROW_SLOT > PAGE_CAP) flush();
      cur.push({ t: "c", items: items.slice(i, i + PER_ROW) }); used += ROW_SLOT;
    }
  }
  flush();
  return pages;
}

function PrintCard({ p }: { p: JProduct }) {
  const c = p.colors.find((x) => !x.soldOut) ?? p.colors[0];
  const img = c.images?.[0];
  const ready = p.colors.filter((x) => !x.soldOut).length;
  const n = pct(c);
  return (
    <div className="relative h-[58mm] overflow-hidden rounded-[2.5mm] border-[0.25mm] border-[#e2e8f0] bg-[#ffffff] text-center">
      <div className="h-[1.4mm] w-full" style={{ background: gcolor(p.group) }} />
      <div className="relative mt-[0.5mm] h-[29mm] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img && <img src={sized(img, 520)} alt="" loading="eager" decoding="sync" data-card="1" className="h-full w-full object-contain p-[1.5mm]" />}
        {p.collection && <span className="absolute left-[1.5mm] top-[1.5mm] rounded-full bg-neutral-900 px-[1.6mm] py-[0.4mm] text-[5.5pt] font-bold text-white">{p.collection}</span>}
        {n > 0 && <Badge n={n} className="absolute right-[1.5mm] top-[1.5mm] h-[9mm] w-[9mm] text-[7pt]" />}
      </div>
      <div className="px-[2mm] pt-[1mm]">
        <p className="line-clamp-2 text-[7.5pt] font-bold leading-[1.15] text-neutral-900" style={{ height: "6.6mm" }}>{p.name}</p>
        <div className="mt-[0.6mm] flex justify-center"><Dots colors={p.colors} max={7} /></div>
        <p className="mt-[1mm] leading-none">
          <span className="text-[9.5pt] font-extrabold" style={{ color: ACCENT }}>{c.price ? rupiah(c.price) : ""}</span>
          {c.normal ? <span className="ml-[1mm] text-[6pt] text-neutral-400 line-through">{rupiah(c.normal)}</span> : null}
        </p>
        <p className="mt-[0.8mm] flex justify-center gap-[1mm] text-[5.5pt] font-bold leading-none">
          <span className="rounded-full bg-emerald-50 px-[1.2mm] py-[0.5mm] text-emerald-700">Stok {totalStock(p).toLocaleString("id-ID")}</span>
          {ready < p.colors.length && <span className="rounded-full bg-red-50 px-[1.2mm] py-[0.5mm] text-red-700">{p.colors.length - ready} warna habis</span>}
        </p>
      </div>
    </div>
  );
}

function PrintPages({ sections, updated, total }: { sections: { g: string; items: JProduct[] }[]; updated: string; total: number }) {
  const pages = paginate(sections);
  const month = new Date(updated).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const groups = sections.map((s) => s.g);
  return (
    <div className="hidden print:block">
      {/* cover */}
      <div className="pp" style={{ background: ACCENT }}>
        {groups.map((g, i) => (
          <span key={g} className="absolute rounded-full" style={{ left: `${-4 + i * 42}mm`, top: "281mm", width: "48mm", height: "48mm", background: gcolor(g) }} />
        ))}
        <span className="absolute rounded-full bg-[#ffffff]" style={{ left: "164mm", top: "-12mm", width: "68mm", height: "68mm" }} />
        <span className="absolute rounded-full" style={{ left: "169mm", top: "-7mm", width: "58mm", height: "58mm", background: ACCENT }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={TORCH_ICON} alt="Torch" loading="eager" className="absolute left-1/2 -translate-x-1/2 object-contain" style={{ top: "92mm", width: "56mm", height: "22mm" }} />
        <p className="absolute w-full text-center font-bold text-white" style={{ top: "124mm", fontSize: "38pt", lineHeight: 1.2 }}>Torch Catalog</p>
        <p className="absolute w-full text-center text-white" style={{ top: "150mm", fontSize: "13pt" }}>{month}</p>
        <div className="absolute flex w-full justify-center gap-[3mm]" style={{ top: "170mm" }}>
          {groups.map((g) => (
            <span key={g} className="rounded-full border-[0.5mm] border-white text-center font-bold text-white" style={{ background: gcolor(g), width: "27mm", fontSize: "7.5pt", lineHeight: "7mm", height: "8mm" }}>{g}</span>
          ))}
        </div>
        <p className="absolute w-full text-center text-white/90" style={{ top: "188mm", fontSize: "9pt" }}>{total} produk ready · diperbarui {stamp(updated)}</p>
      </div>

      {pages.map((rows, pi) => (
        <div key={pi} className="pp">
          <div className="absolute left-0 top-0 flex h-[3mm] w-full">
            {ONLINE_GROUPS.map((g) => <span key={g.name} className="flex-1" style={{ background: g.color }} />)}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Torch" loading="eager" className="absolute object-contain object-left" style={{ left: "10mm", top: "8mm", height: "12mm", width: "36mm" }} />
          <p className="absolute text-right font-bold uppercase" style={{ right: "10mm", top: "10.5mm", fontSize: "13pt", color: ACCENT }}>Torch Catalog</p>
          <div className="absolute" style={{ left: "10mm", right: "10mm", top: "24mm", borderTop: `0.4mm solid ${ACCENT}` }} />
          <div className="absolute" style={{ left: "10mm", right: "10mm", top: "27mm" }}>
            {rows.map((r, ri) =>
              r.t === "b" ? (
                <div key={ri} className="mb-[3mm] flex h-[11mm] items-center justify-center gap-[4mm] rounded-[3mm] px-[8mm]" style={{ background: gcolor(r.g) }}>
                  <span className="h-[0.5mm] flex-1 bg-white" />
                  <span className="font-bold text-white" style={{ fontSize: "14pt" }}>{r.g}</span>
                  <span className="h-[0.5mm] flex-1 bg-white" />
                </div>
              ) : (
                <div key={ri} className="mb-[3mm] grid grid-cols-4 gap-[3mm]">
                  {r.items.map((p) => <PrintCard key={p.id} p={p} />)}
                </div>
              )
            )}
          </div>
          <p className="absolute w-full text-center text-neutral-400" style={{ bottom: "4mm", fontSize: "7pt" }}>{pi + 2}</p>
        </div>
      ))}
    </div>
  );
}

const sized = (url: string, w: number) => `${url}${url.includes("?") ? "&" : "?"}width=${w}`;
const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const stamp = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(".", ":") + " WIB";

const totalStock = (p: JProduct) => p.colors.reduce((n, c) => n + (c.soldOut ? 0 : c.stock ?? 0), 0);

const pct = (c: JColor) => (c.normal && c.price && c.normal > c.price ? Math.round((1 - c.price / c.normal) * 100) : 0);

// Coretan tegas untuk warna habis: garis merah diagonal melewati seluruh bulatan.
function Strike({ w = 22, t = 2 }: { w?: number; t?: number }) {
  return <span className="pointer-events-none absolute left-1/2 top-1/2 rounded-full bg-red-600 shadow-[0_0_0_1px_rgba(255,255,255,0.9)]" style={{ width: w, height: t, transform: "translate(-50%,-50%) rotate(-45deg)" }} />;
}

function Badge({ n, className = "" }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={`flex flex-col items-center justify-center rounded-full bg-red-600 font-extrabold leading-none text-white shadow-md ring-2 ring-white ${className}`}>
      <span>{n}%</span>
      <span className="mt-0.5 text-[8px] font-bold tracking-widest opacity-90">OFF</span>
    </span>
  );
}

function firstReady(p: JProduct): JColor {
  return p.colors.find((c) => !c.soldOut) ?? p.colors[0];
}

function Price({ c, size = "sm" }: { c: JColor; size?: "sm" | "lg" }) {
  if (!c.price) return <span className="text-xs text-neutral-400">Hubungi kami</span>;
  return (
    <span className="jc-price flex flex-wrap items-baseline gap-x-1.5">
      <span className={`${size === "lg" ? "text-3xl" : "text-base"} font-extrabold`} style={{ color: ACCENT }}>{rupiah(c.price)}</span>
      {c.normal ? <span className={`${size === "lg" ? "text-sm" : "text-[11px]"} text-neutral-400 line-through`}>{rupiah(c.normal)}</span> : null}
    </span>
  );
}

function Dots({ colors, max = 6 }: { colors: JColor[]; max?: number }) {
  const shown = colors.slice(0, max);
  return (
    <span className="flex items-center gap-1.5">
      {shown.map((c) => (
        <span
          key={c.name}
          title={c.soldOut ? `${c.name} (habis)` : c.name}
          className="relative h-4 w-4 flex-none"
        >
          <span className="absolute inset-0 rounded-full border border-black/20" style={{ background: c.hex, opacity: c.soldOut ? 0.5 : 1 }} />
          {c.soldOut && <Strike w={24} t={3} />}
        </span>
      ))}
      {colors.length > max && <span className="text-[10px] text-neutral-400">+{colors.length - max}</span>}
    </span>
  );
}

function Card({ p, eager, onOpen }: { p: JProduct; eager: boolean; onOpen: () => void }) {
  const c = firstReady(p);
  const img = c.images?.[0];
  const ready = p.colors.filter((x) => !x.soldOut).length;
  const stock = totalStock(p);
  return (
    <button
      onClick={onOpen}
      className="jc-card group relative flex flex-col overflow-hidden rounded-3xl bg-[#ffffff] text-left shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_30px_-12px_rgba(11,122,143,0.45)] hover:ring-[var(--ac)]/40 print:break-inside-avoid print:shadow-none"
    >
      <span className="jc-img relative block aspect-square w-full bg-gradient-to-b from-white to-[#f1efe9]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sized(img, 520)} alt={p.name} loading={eager ? "eager" : "lazy"} decoding="async" className="h-full w-full object-contain p-3 mix-blend-multiply transition duration-300 group-hover:scale-105" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-neutral-300"><ImageOff className="h-8 w-8" /></span>
        )}
        {p.collection && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-neutral-900/90 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white">{p.collection}</span>
        )}
        <Badge n={pct(c)} className="jc-badge absolute right-2.5 top-2.5 h-11 w-11 text-[13px]" />
      </span>
      <span className="jc-body flex flex-1 flex-col gap-2 p-3.5">
        <span className="jc-name line-clamp-2 min-h-[2.5rem] text-[13px] font-bold leading-snug text-neutral-900">{p.name}</span>
        <Dots colors={p.colors} />
        <span className="jc-foot mt-auto flex flex-col gap-1.5 border-t border-dashed border-black/10 pt-2.5">
          <Price c={c} />
          <span className="jc-chips flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-600/15">Stok {stock.toLocaleString("id-ID")}</span>
            {ready < p.colors.length && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-600/15">{p.colors.length - ready} warna habis</span>}
          </span>
        </span>
      </span>
    </button>
  );
}

function Detail({ p, onClose }: { p: JProduct; onClose: () => void }) {
  const [ci, setCi] = useState(() => Math.max(0, p.colors.findIndex((c) => !c.soldOut)));
  const [ii, setIi] = useState(0);
  const color = p.colors[ci];
  const imgs = color.images ?? [];
  const step = (d: number) => imgs.length && setIi((i) => (i + d + imgs.length) % imgs.length);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgs.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-6 print:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-label={p.name}
        className="relative flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-y-auto rounded-t-3xl bg-[#ffffff] sm:rounded-3xl md:flex-row md:overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Tutup" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#ffffff]/90 text-neutral-700 shadow ring-1 ring-black/10">
          <X className="h-4 w-4" />
        </button>

        <div className="flex shrink-0 flex-col gap-2 bg-neutral-50 p-3 md:w-1/2 md:overflow-y-auto md:p-5">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#ffffff]">
            {imgs[ii] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sized(imgs[ii], 900)} alt={`${p.name} ${color.name}`} className="h-full w-full object-contain" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-neutral-300"><ImageOff className="h-10 w-10" /></span>
            )}
            <Badge n={pct(color)} className="absolute left-3 top-3 h-14 w-14 text-base" />
            {imgs.length > 1 && (
              <>
                <button onClick={() => step(-1)} aria-label="Foto sebelumnya" className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#ffffff]/90 shadow ring-1 ring-black/10"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => step(1)} aria-label="Foto berikutnya" className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#ffffff]/90 shadow ring-1 ring-black/10"><ChevronRight className="h-4 w-4" /></button>
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">{ii + 1} / {imgs.length}</span>
              </>
            )}
          </div>
          {imgs.length > 1 && (
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9 md:grid-cols-5 lg:grid-cols-9">
              {imgs.map((u, i) => (
                <button key={u} onClick={() => setIi(i)} aria-label={`Foto ${i + 1}`} className={`aspect-square overflow-hidden rounded-lg bg-[#ffffff] ring-2 ${i === ii ? "ring-[var(--ac)]" : "ring-transparent"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sized(u, 160)} alt="" loading="lazy" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-4 bg-[#ffffff] p-5 md:w-1/2 md:overflow-y-auto md:p-7">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>{p.group}{p.collection ? ` · ${p.collection}` : ""}</p>
            <h2 className="mt-1 pr-10 text-xl font-bold leading-snug text-neutral-900 md:pr-0">{p.name}</h2>
          </div>
          {!color.soldOut && <Price c={color} size="lg" />}
          {!color.soldOut && color.stock != null && (
            <p className="-mt-2 text-sm font-semibold text-emerald-700">Stok {color.name}: {color.stock.toLocaleString("id-ID")}</p>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold text-neutral-500">Warna: <span className="text-neutral-900">{color.name}</span>{color.soldOut && <span className="ml-1.5 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-white">HABIS</span>}</p>
            <div className="flex flex-wrap gap-2">
              {p.colors.map((c, i) => (
                <button
                  key={c.name}
                  onClick={() => { setCi(i); setIi(0); }}
                  aria-pressed={i === ci}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${i === ci ? "border-[var(--ac)] bg-[var(--ac)]/10 text-neutral-900" : "border-neutral-200 text-neutral-700 hover:border-neutral-400"}`}
                >
                  <span className="relative h-5 w-5 flex-none">
                    <span className="absolute inset-0 rounded-full border border-black/20" style={{ background: c.hex, opacity: c.soldOut ? 0.5 : 1 }} />
                    {c.soldOut && <Strike w={30} t={3} />}
                  </span>
                  <span className={c.soldOut ? "text-neutral-400 line-through decoration-red-600 decoration-2" : ""}>{c.name}</span>
                  {!c.soldOut && c.stock != null && <span className="text-[10px] text-neutral-500">{c.stock.toLocaleString("id-ID")}</span>}
                  {c.soldOut && <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">SOLD OUT</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JastiperCatalog({ dataUrl }: { dataUrl: string }) {
  const [data, setData] = useState<JastiperData | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [coll, setColl] = useState("");
  const [open, setOpen] = useState<JProduct | null>(null);
  const [printing, setPrinting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null); // kemajuan memuat foto produk sebelum PDF dibuka

  // Foto di bawah layar dimuat malas (lazy) → belum ada saat dialog cetak terbuka dan tercetak kosong.
  // Jadi: render halaman cetak, paksa semua foto dimuat sambil menampilkan bar kemajuan (n/total produk),
  // dan setelah lengkap baru buka dialog "Simpan sebagai PDF" milik browser.
  const savePdf = async () => {
    if (preparing) return;
    setPreparing(true);
    flushSync(() => setPrinting(true)); // render halaman cetak (cover + halaman produk) sebelum foto ditunggu
    await new Promise((r) => setTimeout(r, 100));
    const total = visible.length;
    const cards = [...document.querySelectorAll<HTMLImageElement>(".pp img[data-card]")];
    let done = total - cards.length; // produk tanpa foto dianggap selesai
    setProgress({ done, total });
    const bump = () => { done += 1; setProgress({ done: Math.min(done, total), total }); };
    // Hitung berurutan: foto yang belum selesai ditunggu, yang sudah selesai dihitung cepat. Jeda kecil tiap beberapa produk
    // supaya bar bergerak terlihat (di koneksi cepat semua foto bisa sudah selesai sebelum angka sempat tampil).
    const step = Math.max(1, Math.ceil(cards.length / 40));
    const work = (async () => {
      for (let k = 0; k < cards.length; k++) {
        const i = cards[k];
        if (!i.complete) {
          await new Promise((res) => {
            i.addEventListener("load", res, { once: true });
            i.addEventListener("error", res, { once: true });
          });
        }
        bump();
        if (k % step === 0) await new Promise((r) => setTimeout(r, 16));
      }
    })();
    await Promise.race([work, new Promise((r) => setTimeout(r, 90000))]); // koneksi sangat lambat: lanjut walau belum lengkap
    setProgress({ done: total, total });
    await new Promise((r) => setTimeout(r, 500)); // tampilkan "selesai" sebentar
    setProgress(null);
    setPreparing(false);
    window.print();
  };

  useEffect(() => {
    if (!dataUrl) { setError("Katalog belum tersedia."); return; }
    fetch(dataUrl) // alamat berversi → cache CDN/browser aman
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError("Katalog gagal dimuat. Coba muat ulang halaman."));
  }, [dataUrl]);

  useEffect(() => {
    const on = () => flushSync(() => setPrinting(true)), off = () => setPrinting(false); // Ctrl+P langsung ikut memakai tata letak cetak
    window.addEventListener("beforeprint", on);
    window.addEventListener("afterprint", off);
    return () => { window.removeEventListener("beforeprint", on); window.removeEventListener("afterprint", off); };
  }, []);

  const collections = useMemo(() => [...new Set((data?.products ?? []).map((p) => p.collection).filter(Boolean) as string[])].sort(), [data]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.products ?? []).filter(
      (p) => (!group || p.group === group) && (!coll || p.collection === coll) && (!s || p.name.toLowerCase().includes(s) || p.colors.some((c) => c.name.toLowerCase().includes(s)))
    );
  }, [data, q, group, coll]);
  const countOf = (g: string) => (data?.products ?? []).filter((p) => p.group === g && (!coll || p.collection === coll)).length;
  const sections = (data?.groups ?? []).map((g) => ({ g, items: visible.filter((p) => p.group === g) })).filter((s) => s.items.length);

  const chip = (on: boolean) =>
    `rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${on ? "bg-[var(--ac)] text-white" : "bg-[#ffffff] text-neutral-700 ring-1 ring-black/10 hover:ring-black/25"}`;

  return (
    <div className="min-h-dvh bg-[#f6f5f2] text-neutral-900 print:bg-white" style={{ ["--ac" as string]: ACCENT }}>
      <style>{PRINT_CSS}</style>
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f6f5f2]/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="Torch" className="h-7 w-auto" />
          <div className="mr-auto">
            <h1 className="text-sm font-bold leading-tight">Katalog Produk</h1>
            {data && <p className="hidden text-[11px] text-neutral-500 sm:block">{data.products.length} produk ready · diperbarui {stamp(data.updated)}</p>}
          </div>
          <label className="relative order-last w-full sm:order-none sm:w-64 print:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk atau warna" className="h-10 w-full rounded-full border-0 bg-[#ffffff] pl-9 pr-3 text-sm ring-1 ring-black/10 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--ac)]" />
          </label>
          <button onClick={savePdf} disabled={preparing} aria-label="Simpan PDF" className="flex h-10 items-center gap-1.5 rounded-full bg-[#ffffff] px-3 text-xs font-semibold sm:px-4 ring-1 ring-black/10 hover:ring-black/25 print:hidden">
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">{preparing ? "Menyiapkan foto…" : "Simpan PDF"}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-4 print:hidden">
        {data && (
          <div className="mb-5 flex flex-col gap-2 print:hidden">
            <div className="flex flex-wrap gap-1.5">
              <button className={chip(!group)} onClick={() => setGroup("")}>Semua</button>
              {data.groups.map((g) => (
                <button key={g} className={chip(group === g)} onClick={() => setGroup(group === g ? "" : g)}>{g} <span className="opacity-60">{countOf(g)}</span></button>
              ))}
            </div>
            {collections.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Koleksi</span>
                {collections.map((c) => (
                  <button key={c} className={chip(coll === c)} onClick={() => setColl(coll === c ? "" : c)}>{c}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {data && <p className="mb-4 text-[11px] text-neutral-500 sm:hidden">{data.products.length} produk ready · diperbarui {stamp(data.updated)}</p>}
        {!data && !error && <p className="py-20 text-center text-sm text-neutral-500">Memuat katalog…</p>}
        {error && <p className="py-20 text-center text-sm text-neutral-500">{error}</p>}
        {data && sections.length === 0 && <p className="py-20 text-center text-sm text-neutral-500">Tidak ada produk yang cocok.</p>}
        {sections.map(({ g, items }, si) => (
          <section key={g} className="jc-sec mb-8">
            <div className="jc-h mb-3 flex items-baseline gap-2 border-b border-black/10 pb-2">
              <h2 className="flex items-center gap-2 text-lg font-extrabold"><span className="h-5 w-1.5 rounded-full" style={{ background: ACCENT }} />{g}</h2>
              <span className="text-xs text-neutral-400">{items.length} produk</span>
            </div>
            <div className="jc-grid grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {items.map((p) => (
                <Card key={p.id} p={p} eager={printing || si === 0} onOpen={() => setOpen(p)} />
              ))}
            </div>
          </section>
        ))}
        {data && <p className="mt-10 text-center text-[11px] text-neutral-400">Stok dapat berubah sewaktu-waktu · diperbarui setiap hari</p>}
      </main>

      {progress && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center print:hidden" role="status" aria-live="polite">
          <div className="w-full max-w-sm rounded-2xl bg-[#ffffff] p-5 shadow-xl">
            <p className="text-sm font-bold text-neutral-900">{progress.done >= progress.total ? "Foto lengkap — membuka dialog PDF…" : "Menyiapkan PDF…"}</p>
            <p className="mt-0.5 text-xs text-neutral-500">Memuat foto produk ({progress.done}/{progress.total})</p>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 100}%`, background: ACCENT }} />
            </div>
            <p className="mt-2 text-right text-[11px] font-semibold" style={{ color: ACCENT }}>{progress.total ? Math.round((progress.done / progress.total) * 100) : 100}%</p>
          </div>
        </div>
      )}

      {printing && data && <PrintPages sections={sections} updated={data.updated} total={visible.length} />}

      {open && <Detail key={open.id} p={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
