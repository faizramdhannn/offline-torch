"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Printer, Search, X } from "lucide-react";
import type { JastiperData, JColor, JProduct } from "@/lib/jastiperCatalog";

// Katalog Jastiper (publik): grid produk + jendela detail dengan galeri foto & pilihan warna.
// Tampilan sengaja berbeda dari katalog Gundam/Women (itu halaman editorial); ini katalog umum yang bisa dicari & difilter.
const LOGO = "https://i.ibb.co.com/dJBmqq1S/TORCH-LOGOS.png";
const ACCENT = "#0b7a8f";

// Foto Shopify bisa diminta dalam ukuran lebih kecil lewat ?width= — hemat data pengunjung.
const PRINT_CSS = `
@page { size: A4 portrait; margin: 10mm; }
@media print {
  html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .jc-grid { display: grid !important; grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 3mm !important; }
  .jc-sec { margin-bottom: 4mm !important; }
  .jc-h { margin-bottom: 2.5mm !important; padding-bottom: 1mm !important; break-after: avoid; }
  .jc-h h2 { font-size: 11pt !important; }
  .jc-card { height: 63mm; break-inside: avoid; box-shadow: none !important; border: 0.2mm solid #d9d9d9; border-radius: 2.5mm !important; transform: none !important; }
  .jc-img { aspect-ratio: auto !important; height: 32mm !important; }
  .jc-img img { padding: 1.5mm !important; transform: none !important; }
  .jc-body { padding: 1.8mm 2.2mm !important; gap: 0.8mm !important; }
  .jc-name { font-size: 7.5pt !important; min-height: 0 !important; line-height: 1.2 !important; }
  .jc-foot { padding-top: 1.2mm !important; gap: 0.8mm !important; }
  .jc-price span:first-child { font-size: 9pt !important; }
  .jc-price span + span { font-size: 6.5pt !important; }
  .jc-chips span { font-size: 5.5pt !important; padding: 0.2mm 1.2mm !important; }
  .jc-badge { width: 9mm !important; height: 9mm !important; font-size: 7pt !important; right: 1.5mm !important; top: 1.5mm !important; }
  .jc-badge span:last-child { font-size: 4.5pt !important; }
}
`;

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

  useEffect(() => {
    if (!dataUrl) { setError("Katalog belum tersedia."); return; }
    fetch(dataUrl) // alamat berversi → cache CDN/browser aman
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError("Katalog gagal dimuat. Coba muat ulang halaman."));
  }, [dataUrl]);

  useEffect(() => {
    const on = () => setPrinting(true), off = () => setPrinting(false);
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
    <div className="min-h-dvh bg-[#f6f5f2] text-neutral-900" style={{ ["--ac" as string]: ACCENT }}>
      <style>{PRINT_CSS}</style>
      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#f6f5f2]/95 backdrop-blur print:static">
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
          <button onClick={() => window.print()} aria-label="Simpan PDF" className="flex h-10 items-center gap-1.5 rounded-full bg-[#ffffff] px-3 text-xs font-semibold sm:px-4 ring-1 ring-black/10 hover:ring-black/25 print:hidden">
            <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Simpan PDF</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-4">
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

      {open && <Detail key={open.id} p={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
