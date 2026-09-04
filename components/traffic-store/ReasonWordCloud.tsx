"use client";

import { useMemo, useState } from "react";
import { CHART_PALETTE } from "@/components/shared/chartStyles";

const COLORS = CHART_PALETTE;

const STOPWORDS = new Set(
  `
yang di ke dari dengan pada dan atau ini itu nya untuk
cs cust customer sdh dpt yg dr utk dgn dg tp bhw krn hrga hrg pcs pc
mo lg saja aja bs mnt tny cek sm sy jd
`
    .trim()
    .split(/\s+/)
);

function tokenize(text: string | undefined | null): string[] {
  if (!text) return [];
  const clean = String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  return clean.split(/\s+/).filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function ngrams(tokens: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + n <= tokens.length; i++) out.push(tokens.slice(i, i + n).join(" "));
  return out;
}

function extractPhrases(text: string | undefined | null): string[] {
  const toks = tokenize(text);
  return [...ngrams(toks, 2), ...ngrams(toks, 3)];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightPhrase(note: string, phrase: string): { before: string; match: string; after: string } | null {
  const words = phrase.split(" ").map(escapeRegExp);
  const pattern = new RegExp(words.join("[^a-zA-Z0-9]+"), "i");
  const m = note.match(pattern);
  if (!m || m.index === undefined) return null;
  return { before: note.slice(0, m.index), match: m[0], after: note.slice(m.index + m[0].length) };
}

interface ReasonGroup {
  label: string;
  notes: string[];
}

interface ReasonWordCloudProps {
  title: string;
  groups: ReasonGroup[];
  accentColor?: string;
}

export function ReasonWordCloud({ title, groups, accentColor = "#1c1c1e" }: ReasonWordCloudProps) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activePhrase, setActivePhrase] = useState<string | null>(null);

  const total = groups.reduce((a, g) => a + g.notes.length, 0);
  const maxCount = groups.length ? groups[0].notes.length : 1;

  const effectiveActive = groups.find((g) => g.label === activeCat) ? activeCat : groups[0]?.label ?? null;
  const activeGroup = groups.find((g) => g.label === effectiveActive) || null;

  const { topPhrases, phraseToNotes } = useMemo(() => {
    if (!activeGroup) return { topPhrases: [] as [string, number][], phraseToNotes: new Map<string, string[]>() };
    const phraseCount = new Map<string, number>();
    const p2n = new Map<string, string[]>();
    activeGroup.notes.filter(Boolean).forEach((n) => {
      const phrases = new Set(extractPhrases(n));
      phrases.forEach((p) => {
        phraseCount.set(p, (phraseCount.get(p) || 0) + 1);
        if (!p2n.has(p)) p2n.set(p, []);
        p2n.get(p)!.push(n);
      });
    });
    const top = Array.from(phraseCount.entries())
      .filter(([, f]) => f >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16);
    return { topPhrases: top, phraseToNotes: p2n };
  }, [activeGroup]);

  const effectivePhrase = topPhrases.find(([p]) => p === activePhrase) ? activePhrase : null;
  const maxF = topPhrases.length ? topPhrases[0][1] : 1;
  const minF = topPhrases.length ? topPhrases[topPhrases.length - 1][1] : 1;

  function sizeFor(freq: number) {
    if (maxF === minF) return 13;
    const t = (freq - minF) / (maxF - minF);
    return 11 + t * 8;
  }
  function alphaColor(idx: number) {
    const shades = ["#1c1c1e", "#3a3a3d", "#565659", "#727275"];
    return shades[Math.min(idx, shades.length - 1)];
  }

  const activeNotes = effectivePhrase ? phraseToNotes.get(effectivePhrase) || [] : [];

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-gray-700">{title}</h3>
      <p className="mb-3 text-[11px] text-gray-400">
        Klik kategori untuk lihat frasa (2–3 kata) yang paling sering muncul di catatan CS.
      </p>

      <div className="flex flex-col gap-1">
        {groups.map((g, i) => {
          const pct = total ? ((g.notes.length / total) * 100).toFixed(1) : "0.0";
          const isActive = g.label === effectiveActive;
          return (
            <button
              key={g.label}
              type="button"
              onClick={() => {
                setActiveCat(g.label);
                setActivePhrase(null);
              }}
              className={`flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors ${
                isActive ? "bg-gray-100" : "hover:bg-gray-50"
              }`}
            >
              <span className="flex min-w-[140px] items-center gap-1.5 text-[11px] font-semibold text-gray-700">
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="truncate" title={g.label}>{g.label}</span>
              </span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${(g.notes.length / maxCount) * 100}%`,
                    background: COLORS[i % COLORS.length],
                  }}
                />
              </span>
              <span className="w-16 flex-none text-right text-[11px] text-gray-500">
                {g.notes.length} ({pct}%)
              </span>
            </button>
          );
        })}
      </div>

      {activeGroup && (
        <div className="mt-3.5 border-t border-dashed border-gray-200 pt-3.5">
          {topPhrases.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-gray-400">
              Belum ada frasa berulang (2–3 kata) yang cukup untuk kategori &quot;{activeGroup.label}&quot; pada filter saat ini.
            </div>
          ) : (
            <>
              <p className="mb-2.5 text-[11px] text-gray-400">
                Frasa yang sering muncul untuk &quot;<b className="text-gray-600">{activeGroup.label}</b>&quot; — dari{" "}
                {activeGroup.notes.length} catatan CS.{" "}
                <span className="opacity-70">Klik frasa untuk lihat notes mentahnya.</span>
              </p>
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-2">
                {topPhrases.map(([p, f], i) => {
                  const rank = Math.floor(i / 5);
                  const isActive = p === effectivePhrase;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setActivePhrase(effectivePhrase === p ? null : p)}
                      title={`${f}x muncul, klik untuk lihat notes`}
                      className="rounded-full border border-transparent px-2.5 py-1 font-bold transition-colors hover:bg-gray-200"
                      style={{
                        fontSize: `${sizeFor(f).toFixed(0)}px`,
                        background: isActive ? accentColor : "#f4f4f5",
                        color: isActive ? "#fff" : alphaColor(rank),
                      }}
                    >
                      {p}{" "}
                      <span className="text-[10px] font-medium opacity-50">{f}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {effectivePhrase && (
            <div className="mt-3.5 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
              <div className="mb-2.5 flex items-center justify-between text-[11px] text-gray-400">
                <span>
                  📝 Notes mentah mengandung &quot;<b className="text-gray-600">{effectivePhrase}</b>&quot; ({activeNotes.length} catatan)
                </span>
                <button
                  type="button"
                  onClick={() => setActivePhrase(null)}
                  className="font-semibold text-gray-400 hover:text-gray-700"
                >
                  Tutup ✕
                </button>
              </div>
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {activeNotes.slice(0, 60).map((n, i) => {
                  const h = highlightPhrase(n, effectivePhrase);
                  return (
                    <div key={i} className="rounded-lg border border-gray-100 bg-white px-2.5 py-2 text-[11px] leading-relaxed text-gray-700">
                      {h ? (
                        <>
                          {h.before}
                          <mark className="rounded bg-yellow-200/70 px-0.5">{h.match}</mark>
                          {h.after}
                        </>
                      ) : (
                        n
                      )}
                    </div>
                  );
                })}
                {activeNotes.length > 60 && (
                  <div className="px-1 py-1 text-[10px] text-gray-400">
                    ...dan {activeNotes.length - 60} catatan lainnya (ditampilkan maksimal 60)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
