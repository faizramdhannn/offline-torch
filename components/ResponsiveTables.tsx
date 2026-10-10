"use client";

import { useEffect } from "react";

// Tabel → kartu di layar sempit (HP), supaya tidak perlu geser kiri-kanan.
// Berlaku otomatis untuk SEMUA tabel dengan satu baris header sederhana (tanpa colspan/rowspan):
//  - tiap <td> diberi label dari <th> kolomnya (data-label), CSS di globals.css menyusun tiap baris jadi kartu;
//  - tabel dengan header bertingkat/matriks tidak diubah (data-stack="off") dan perlu tampilan khusus;
//  - tandai table dengan data-stack="off" untuk mengecualikannya secara manual.
// Hanya aktif < 768px; di layar lebar atribut dilepas sehingga tampilan tabel tidak berubah.
const MQ = "(max-width: 767px)";

function textOf(el: Element): string {
  return (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
}

function process(table: HTMLTableElement) {
  if (table.dataset.stack === "off") return;
  const headRows = table.tHead ? Array.from(table.tHead.rows) : [];
  const ok =
    headRows.length === 1 &&
    Array.from(headRows[0].cells).every((c) => c.colSpan <= 1 && c.rowSpan <= 1) &&
    headRows[0].cells.length >= 2;
  if (!ok) {
    table.removeAttribute("data-stack-on");
    return;
  }
  const labels = Array.from(headRows[0].cells).map(textOf);
  const rows = [
    ...Array.from(table.tBodies).flatMap((b) => Array.from(b.rows)),
    ...(table.tFoot ? Array.from(table.tFoot.rows) : []), // baris total juga jadi kartu berlabel
  ];
  for (const tr of rows) {
    const cells = Array.from(tr.cells);
    const simple = cells.length === labels.length && cells.every((c) => c.colSpan <= 1);
    if (simple) {
      cells.forEach((c, i) => { if (c.dataset.label !== labels[i]) c.dataset.label = labels[i]; });
      tr.removeAttribute("data-stack-skip");
    } else {
      tr.setAttribute("data-stack-skip", "1"); // baris kosong/detail (colspan) → tampil penuh tanpa label
    }
  }
  table.setAttribute("data-stack-on", "1");
  ensureSortBar(table);
}

// Header yang bisa diklik untuk mengurutkan (cursor-pointer) hilang saat tabel jadi kartu → sediakan kontrol "Urutkan".
function ensureSortBar(table: HTMLTableElement) {
  const ths = table.tHead ? Array.from(table.tHead.rows[0].cells) : [];
  const sortable = ths.map((th, i) => ({ th, i })).filter(({ th }) => th.classList.contains("cursor-pointer") && textOf(th));
  const prev = table.previousElementSibling as HTMLElement | null;
  const has = prev && prev.hasAttribute("data-stack-sort");
  if (sortable.length < 2) { if (has) prev!.remove(); return; }
  const sig = sortable.map(({ th }) => textOf(th)).join("|");
  if (has && prev!.dataset.sig === sig) return;
  if (has) prev!.remove();
  const bar = document.createElement("div");
  bar.setAttribute("data-stack-sort", "1");
  bar.dataset.sig = sig;
  bar.className = "mb-2 flex items-center gap-2 text-xs text-gray-500";
  const sel = document.createElement("select");
  sel.className = "min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "Urutkan berdasarkan…";
  sel.appendChild(ph);
  sortable.forEach(({ th, i }) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = textOf(th);
    sel.appendChild(o);
  });
  const click = (i: number) => (table.tHead?.rows[0].cells[i] as HTMLElement | undefined)?.click();
  sel.addEventListener("change", () => { if (sel.value !== "") click(Number(sel.value)); });
  const flip = document.createElement("button");
  flip.type = "button";
  flip.textContent = "Balik";
  flip.className = "shrink-0 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700";
  flip.addEventListener("click", () => { if (sel.value !== "") click(Number(sel.value)); });
  bar.appendChild(sel);
  bar.appendChild(flip);
  table.parentElement?.insertBefore(bar, table);
}

function processAll() {
  document.querySelectorAll<HTMLTableElement>("table").forEach(process);
}

function clearAll() {
  document.querySelectorAll("[data-stack-on]").forEach((t) => t.removeAttribute("data-stack-on"));
  document.querySelectorAll("[data-stack-sort]").forEach((b) => b.remove());
}

export default function ResponsiveTables() {
  useEffect(() => {
    const mq = window.matchMedia(MQ);
    let raf = 0;
    let obs: MutationObserver | null = null;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(processAll);
    };
    const start = () => {
      processAll();
      obs = new MutationObserver(schedule); // hanya childList: mengubah atribut tidak memicu ulang
      obs.observe(document.body, { childList: true, subtree: true });
    };
    const stop = () => {
      obs?.disconnect();
      obs = null;
      cancelAnimationFrame(raf);
      clearAll();
    };
    const apply = () => (mq.matches ? (obs ? undefined : start()) : stop());
    apply();
    mq.addEventListener("change", apply);
    return () => { mq.removeEventListener("change", apply); stop(); };
  }, []);
  return null;
}
