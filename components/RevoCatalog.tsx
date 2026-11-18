"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, ChevronRight, ImageOff, Printer, Search } from "lucide-react";
import type { JastiperData, JColor, JProduct } from "@/lib/jastiperCatalog";
import { Badge, Detail, Dots, Price, firstReady, pct, sized, stamp } from "./JastiperCatalog";

// Katalog Revo Mall Bekasi (publik). Satu halaman = kanvas TETAP 1080 × 1080 px (sama dengan gambar acara):
// banner 242 px di atas + kartu 3 × 3 di area putih di bawahnya. Kanvas yang sama dipakai untuk preview (diperkecil
// mengikuti lebar layar) dan untuk PDF (@page 1080px × 1080px, satu kanvas per halaman).
// Di layar sempit (< 640 px) kanvas terlalu kecil untuk dibaca → grid 3 kolom biasa.
// Jangan impor lib/revoCatalog di sini: ia menarik lib/sheets (paket Google) ke bundle browser.
const ACCENT = "#1f8fb0";
const PER_PAGE = 9; // 3 × 3 kartu per halaman
const SIZE = 1080;
// Urutan produk: Backpack dulu, Accessories paling akhir (di dalam grup A–Z). Tidak ada pembatas kategori di tampilan.
const GROUP_RANK: Record<string, number> = { Backpack: 0, "Sling Bag": 1, "Waist Bag": 2, "Travel Pouch": 3, Lainnya: 4, Accessories: 5 };
const rankOf = (g: string) => GROUP_RANK[g] ?? GROUP_RANK.Lainnya;

const PRINT_CSS = `
@page { size: ${SIZE}px ${SIZE}px; margin: 0; }
@media print {
  html, body { margin: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .rv-screen { display: none !important; }
}
.rv-pp { position: relative; width: ${SIZE}px; height: ${SIZE}px; overflow: hidden; background: #fff; break-after: page; page-break-after: always; }
.rv-pp:last-child { break-after: auto; page-break-after: auto; }
`;

// ---- Satu kartu di dalam kanvas 1080 (ukuran piksel tetap) ----
function CanvasCard({ p, onOpen }: { p: JProduct; onOpen?: () => void }) {
  const c: JColor = firstReady(p);
  const img = c.images?.[0];
  // Tanpa kotak/kartu: foto memenuhi lebar kolom supaya terlihat besar.
  return (
    <button onClick={onOpen} className="relative flex h-[246px] w-full flex-col overflow-hidden bg-transparent text-left">
      <span className="relative block h-[158px] w-full">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img data-card src={sized(img, 520)} alt={p.name} loading="eager" decoding="async" className="h-full w-full object-contain mix-blend-multiply" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-neutral-300"><ImageOff className="h-8 w-8" /></span>
        )}
        <Badge n={pct(c)} className="!shadow-none border-[3px] border-white absolute right-1 top-1 h-[46px] w-[46px] text-[13px]" />
      </span>
      <span className="flex flex-1 flex-col gap-1 px-1 pt-1">
        <span className="line-clamp-2 h-[36px] text-[14px] font-bold leading-[18px] text-neutral-900">{p.name}</span>
        <Dots colors={p.colors} max={7} />
        <span className="mt-auto"><Price c={c} red /></span>
      </span>
    </button>
  );
}

function CanvasPage({ items, no, pages, onOpen }: { items: JProduct[]; no: number; pages: number; onOpen?: (p: JProduct) => void }) {
  return (
    <div className="rv-pp">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/revo-banner.jpg" alt="IHLS Revo Mall Bekasi" className="absolute left-0 top-0 block" style={{ width: SIZE, height: 242 }} />
      <div className="absolute grid grid-cols-3 gap-x-4 gap-y-3.5" style={{ left: 24, top: 262, width: SIZE - 48 }}>
        {items.map((p) => <CanvasCard key={p.id} p={p} onOpen={onOpen ? () => onOpen(p) : undefined} />)}
      </div>
      <p className="absolute w-full text-center text-[12px] text-neutral-400" style={{ top: 1046 }}>
        Harga hanya berlaku di area bazaar IHLS Revo Mall Bekasi · {no} / {pages}
      </p>
    </div>
  );
}

// Memperkecil kanvas 1080 agar muat lebar kontainer (tidak pernah diperbesar).
function ScaledStage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / SIZE));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="mx-auto w-full" style={{ maxWidth: SIZE }}>
      <div style={{ width: SIZE * scale, height: SIZE * scale }} className="overflow-hidden shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/10">
        <div style={{ width: SIZE, height: SIZE, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}

// ---- Kartu responsif untuk layar sempit ----
function MobileCard({ p, eager, onOpen }: { p: JProduct; eager: boolean; onOpen: () => void }) {
  const c = firstReady(p);
  const img = c.images?.[0];
  return (
    <button onClick={onOpen} className="relative flex flex-col overflow-hidden bg-transparent text-left">
      <span className="relative block aspect-square w-full">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sized(img, 320)} alt={p.name} loading={eager ? "eager" : "lazy"} decoding="async" className="h-full w-full object-contain mix-blend-multiply" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-neutral-300"><ImageOff className="h-6 w-6" /></span>
        )}
        <Badge n={pct(c)} className="!shadow-none border-[3px] border-white absolute right-1 top-1 h-8 w-8 text-[10px]" />
      </span>
      <span className="flex flex-1 flex-col gap-1 p-1.5">
        <span className="line-clamp-2 min-h-[2rem] text-[10px] font-bold leading-tight text-neutral-900">{p.name}</span>
        <Dots colors={p.colors} max={5} />
        <span className="mt-auto"><Price c={c} red /></span>
      </span>
    </button>
  );
}

function Pager({ page, pages, onGo }: { page: number; pages: number; onGo: (n: number) => void }) {
  if (pages <= 1) return null;
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  const btn = "flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold ring-1 ring-black/10 disabled:opacity-40";
  return (
    <nav aria-label="Halaman" className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
      <button className={`${btn} bg-[#ffffff]`} disabled={page <= 1} onClick={() => onGo(page - 1)} aria-label="Halaman sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1] > 1 && <span className="text-neutral-400">…</span>}
          <button className={`${btn} ${n === page ? "text-white" : "bg-[#ffffff] text-neutral-700"}`} style={n === page ? { background: ACCENT } : undefined} aria-current={n === page ? "page" : undefined} onClick={() => onGo(n)}>{n}</button>
        </span>
      ))}
      <button className={`${btn} bg-[#ffffff]`} disabled={page >= pages} onClick={() => onGo(page + 1)} aria-label="Halaman berikutnya"><ChevronRight className="h-4 w-4" /></button>
    </nav>
  );
}

export default function RevoCatalog({ dataUrl }: { dataUrl: string }) {
  const [data, setData] = useState<JastiperData | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<JProduct | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!dataUrl) { setError("Katalog belum tersedia."); return; }
    fetch(dataUrl) // alamat berversi → cache CDN/browser aman
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setData)
      .catch(() => setError("Katalog gagal dimuat. Coba muat ulang halaman."));
  }, [dataUrl]);

  useEffect(() => {
    const fit = () => setNarrow(window.innerWidth < 640);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const on = () => flushSync(() => setPrinting(true)), off = () => setPrinting(false); // Ctrl+P ikut memakai halaman 1080
    window.addEventListener("beforeprint", on);
    window.addEventListener("afterprint", off);
    return () => { window.removeEventListener("beforeprint", on); window.removeEventListener("afterprint", off); };
  }, []);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    // Urut grup (Backpack … Accessories) lalu A–Z, tanpa pembatas kategori.
    return (data?.products ?? [])
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.colors.some((c) => c.name.toLowerCase().includes(s)))
      .sort((a, b) => rankOf(a.group) - rankOf(b.group) || a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
  }, [data, q]);

  const chunks = useMemo(() => {
    const out: JProduct[][] = [];
    for (let i = 0; i < visible.length; i += PER_PAGE) out.push(visible.slice(i, i + PER_PAGE));
    return out;
  }, [visible]);
  const pages = Math.max(1, chunks.length);
  const cur = Math.min(page, pages);
  const go = (n: number) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // PDF: render semua halaman 1080, tunggu semua foto, lalu buka dialog cetak ("Simpan sebagai PDF").
  const savePdf = async () => {
    if (progress || !chunks.length) return;
    flushSync(() => setPrinting(true));
    await new Promise((r) => setTimeout(r, 100));
    const imgs = [...document.querySelectorAll<HTMLImageElement>(".rv-print img[data-card]")];
    let done = imgs.filter((i) => i.complete).length;
    const total = imgs.length;
    setProgress({ done, total });
    const work = Promise.all(imgs.filter((i) => !i.complete).map((i) => new Promise<void>((res) => {
      const f = () => { done += 1; setProgress({ done: Math.min(done, total), total }); res(); };
      i.addEventListener("load", f, { once: true });
      i.addEventListener("error", f, { once: true });
    })));
    await Promise.race([work, new Promise((r) => setTimeout(r, 90000))]); // koneksi sangat lambat: lanjut walau belum lengkap
    setProgress({ done: total, total });
    await new Promise((r) => setTimeout(r, 400));
    setProgress(null);
    window.print();
  };

  return (
    <div className="min-h-dvh bg-[#ececec] text-neutral-900 print:bg-white" style={{ ["--ac" as string]: ACCENT }}>
      <style>{PRINT_CSS}</style>

      <div className="rv-screen mx-auto px-3 pb-12 pt-4" style={{ maxWidth: SIZE + 24 }}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative w-full flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Cari produk atau warna" className="h-10 w-full rounded-full border-0 bg-[#ffffff] pl-9 pr-3 text-sm ring-1 ring-black/15 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[var(--ac)]" />
          </label>
          {data && <p className="hidden text-[11px] text-neutral-500 sm:block">{visible.length} produk · diperbarui {stamp(data.updated)}</p>}
          <button onClick={savePdf} disabled={!data || !!progress} className="ml-auto flex h-10 items-center gap-1.5 rounded-full bg-[#ffffff] px-4 text-xs font-semibold ring-1 ring-black/15 hover:ring-black/30 disabled:opacity-50">
            <Printer className="h-4 w-4" /> Simpan PDF
          </button>
        </div>

        {!data && !error && <p className="py-20 text-center text-sm text-neutral-500">Memuat katalog…</p>}
        {error && <p className="py-20 text-center text-sm text-neutral-500">{error}</p>}
        {data && visible.length === 0 && <p className="py-20 text-center text-sm text-neutral-500">Tidak ada produk yang cocok.</p>}

        {data && visible.length > 0 && (narrow ? (
          <div className="overflow-hidden rounded-2xl bg-[#ffffff] pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/revo-banner.jpg" alt="IHLS Revo Mall Bekasi" className="block w-full" />
            <div className="grid grid-cols-3 gap-2 px-2 pt-3">
              {(chunks[cur - 1] ?? []).map((p, i) => <MobileCard key={p.id} p={p} eager={i < 3} onOpen={() => setOpen(p)} />)}
            </div>
          </div>
        ) : (
          <ScaledStage><CanvasPage items={chunks[cur - 1] ?? []} no={cur} pages={pages} onOpen={setOpen} /></ScaledStage>
        ))}
        <Pager page={cur} pages={pages} onGo={go} />
      </div>

      {printing && data && (
        <div className="rv-print hidden print:block">
          {chunks.map((items, i) => <CanvasPage key={i} items={items} no={i + 1} pages={chunks.length} />)}
        </div>
      )}

      {progress && (
        <div className="rv-screen fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="status" aria-live="polite">
          <div className="w-full max-w-sm rounded-2xl bg-[#ffffff] p-5 shadow-xl">
            <p className="text-sm font-bold text-neutral-900">{progress.done >= progress.total ? "Foto lengkap — membuka dialog PDF…" : "Menyiapkan PDF…"}</p>
            <p className="mt-0.5 text-xs text-neutral-500">Memuat foto produk ({progress.done}/{progress.total})</p>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 100}%`, background: ACCENT }} />
            </div>
          </div>
        </div>
      )}

      {open && <Detail key={open.id} p={open} simple onClose={() => setOpen(null)} />}
    </div>
  );
}
