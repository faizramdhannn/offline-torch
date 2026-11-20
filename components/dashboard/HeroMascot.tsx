"use client";

import { useEffect, useRef } from "react";

/**
 * Maskot Torch yang hidup di dalam banner Dashboard (induknya harus position: relative + overflow: hidden).
 * Mengejar kursor di dalam batas banner, lalu duduk, menggaruk, atau tidur bila kursor diam.
 * Logika gerak diadaptasi dari oneko.js (MIT, © 2022 adryd, https://github.com/adryd325/oneko.js).
 * Sprite: public/maskot/torch.png (512×256, grid 8×4, frame 64 px; urutan frame = oneko).
 */
const FS = 64;
const SPEED = 12;
// [kolom, baris] tiap frame pada sprite sheet
const SETS: Record<string, [number, number][]> = {
  idle: [[3, 3]], alert: [[7, 3]], tired: [[3, 2]],
  sleeping: [[2, 0], [2, 1]],
  scratchSelf: [[5, 0], [6, 0], [7, 0]],
  N: [[1, 2], [1, 3]], NE: [[0, 2], [0, 3]], E: [[3, 0], [3, 1]], SE: [[5, 1], [5, 2]],
  S: [[6, 3], [7, 2]], SW: [[5, 3], [6, 1]], W: [[4, 2], [4, 3]], NW: [[1, 0], [1, 1]],
};

export function HeroMascot() {
  const boxRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current, el = spriteRef.current;
    if (!box || !el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const rect = () => box.getBoundingClientRect();
    let w = rect().width, h = rect().height;
    let x = Math.min(w - FS / 2, 200), y = h - FS / 2 - 6;
    let tx = x, ty = y;
    let frame = 0, idleTime = 0, idleAnim: string | null = null, idleFrame = 0;

    const draw = (name: string, f: number) => {
      const set = SETS[name], s = set[f % set.length];
      el.style.backgroundPosition = `${-s[0] * FS}px ${-s[1] * FS}px`;
    };
    const place = () => { el.style.transform = `translate(${x - FS / 2}px, ${y - FS / 2}px)`; };
    draw("idle", 0); place();
    if (reduced) return;

    const onMove = (e: PointerEvent) => {
      const r = rect(); w = r.width; h = r.height;
      tx = Math.min(Math.max(FS / 2, e.clientX - r.left), w - FS / 2);
      ty = Math.min(Math.max(FS / 2, e.clientY - r.top), h - FS / 2);
      idleTime = 0;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const tick = () => {
      if (document.hidden) return;
      frame++;
      const dx = x - tx, dy = y - ty, dist = Math.hypot(dx, dy);
      if (dist < SPEED || dist < 48) {
        // diam: duduk → kadang tidur / menggaruk
        idleTime++;
        if (idleTime > 10 && !idleAnim && Math.floor(Math.random() * 120) === 0) {
          idleAnim = Math.random() < 0.5 ? "sleeping" : "scratchSelf";
          idleFrame = 0;
        }
        if (idleAnim === "sleeping") {
          idleFrame++;
          if (idleFrame < 8) draw("tired", 0); else draw("sleeping", Math.floor(idleFrame / 4));
          if (idleFrame > 192) { idleAnim = null; draw("idle", 0); }
        } else if (idleAnim === "scratchSelf") {
          idleFrame++;
          draw("scratchSelf", idleFrame);
          if (idleFrame > 9) { idleAnim = null; draw("idle", 0); }
        } else draw("idle", 0);
        return;
      }
      idleAnim = null; idleFrame = 0;
      let dir = "";
      dir += dy / dist > 0.5 ? "N" : "";
      dir += dy / dist < -0.5 ? "S" : "";
      dir += dx / dist > 0.5 ? "W" : "";
      dir += dx / dist < -0.5 ? "E" : "";
      draw(dir || "idle", frame);
      x -= (dx / dist) * SPEED; y -= (dy / dist) * SPEED;
      x = Math.min(Math.max(FS / 2, x), w - FS / 2); y = Math.min(Math.max(FS / 2, y), h - FS / 2);
      place();
    };
    const id = setInterval(tick, 100);
    return () => { clearInterval(id); window.removeEventListener("pointermove", onMove); };
  }, []);

  return (
    <div ref={boxRef} aria-hidden className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
      <div
        ref={spriteRef}
        style={{ position: "absolute", left: 0, top: 0, width: FS, height: FS, backgroundImage: "url(/maskot/torch.png)", backgroundSize: `${FS * 8}px ${FS * 4}px`, willChange: "transform" }}
      />
    </div>
  );
}
