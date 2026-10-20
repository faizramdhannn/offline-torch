"use client";
import { useEffect, useRef, useState } from "react";

// Viewer katalog publik. Desktop: PDF bawaan browser (iframe). HP: halaman digambar pas lebar layar dengan pdf.js
// (iframe PDF di HP hanya menampilkan halaman 1 yang kecil). pdf.js dimuat dinamis — hanya di HP, dan jalan di browser
// pengunjung (bukan di Vercel). Gagal memuat → jatuh ke iframe/tombol Buka PDF.
export default function CatalogViewer({ title, pdf, accent = "#0b7a8f" }: { title: string; pdf: string; accent?: string }) {
  const sep = pdf.includes("?") ? "&" : "?";
  const [mobile, setMobile] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [pages, setPages] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!mobile || failed) return;
    let cancelled = false;
    let doc: any = null;
    (async () => {
      try {
        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        doc = await pdfjs.getDocument({ url: pdf }).promise;
        if (cancelled) return;
        setPages(doc.numPages);
        const host = box.current;
        if (!host) return;
        const width = host.clientWidth;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= doc.numPages; n++) {
          if (cancelled) return;
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = host.querySelector<HTMLCanvasElement>(`canvas[data-p="${n}"]`);
          if (!canvas) continue;
          canvas.width = vp.width; canvas.height = vp.height;
          canvas.style.aspectRatio = `${base.width} / ${base.height}`;
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise;
          setLoaded(n);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; try { doc?.destroy(); } catch {} };
  }, [mobile, failed, pdf]);

  const btn = { padding: "6px 12px", borderRadius: 8, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" as const };
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f3f0e8" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", background: accent, color: "#fff" }}>
        <strong style={{ fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</strong>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <a href={pdf} target="_blank" rel="noopener noreferrer" style={{ ...btn, background: "rgba(255,255,255,0.18)", color: "#fff" }}>Buka</a>
          <a href={`${pdf}${sep}download=1`} style={{ ...btn, background: "#fff", color: accent, fontWeight: 700 }}>Unduh</a>
        </div>
      </header>

      {mobile === null ? null : mobile && !failed ? (
        <div ref={box} style={{ padding: 6, display: "flex", flexDirection: "column", gap: 6 }}>
          {pages === 0 && <p style={{ textAlign: "center", color: "#6b7280", fontSize: 13, padding: 24 }}>Memuat katalog…</p>}
          {Array.from({ length: pages }, (_, i) => (
            <canvas key={i} data-p={i + 1} style={{ width: "100%", height: "auto", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.15)", display: "block" }} />
          ))}
          {pages > 0 && loaded < pages && <p style={{ textAlign: "center", color: "#6b7280", fontSize: 12, padding: 8 }}>Memuat halaman {loaded + 1}/{pages}…</p>}
        </div>
      ) : (
        <iframe src={pdf} title={title} style={{ flex: 1, width: "100%", border: "none", minHeight: "calc(100vh - 48px)" }} />
      )}
    </div>
  );
}
