import { describe, it, expect } from "vitest";
import { activeRule, wibNow, type ScheduleRule } from "@/lib/musicSchedule";
import { parseYouTube } from "@/lib/devices";

const r = (o: Partial<ScheduleRule>): ScheduleRule => ({ id: 1, days: "0,1,2,3,4,5,6", start_min: 600, end_min: 1260, playlist_id: 1, volume: 40, ...o });

describe("jadwal musik (WIB)", () => {
  it("wibNow membaca hari & menit zona Jakarta", () => {
    // 2026-10-09 03:30 UTC = 10:30 WIB, Jumat
    const n = wibNow(new Date("2026-10-09T03:30:00Z"));
    expect(n.day).toBe(5);
    expect(n.min).toBe(630);
  });
  it("aktif di dalam jendela, tidak di luar", () => {
    expect(activeRule([r({})], new Date("2026-10-09T03:30:00Z"))?.rule.id).toBe(1);
    expect(activeRule([r({})], new Date("2026-10-08T23:00:00Z"))).toBeNull(); // 06:00 WIB
    expect(activeRule([r({ end_min: 630 })], new Date("2026-10-09T03:30:00Z"))).toBeNull(); // batas akhir eksklusif
  });
  it("memperhatikan hari", () => {
    expect(activeRule([r({ days: "1,2" })], new Date("2026-10-09T03:30:00Z"))).toBeNull(); // Jumat
    expect(activeRule([r({ days: "5" })], new Date("2026-10-09T03:30:00Z"))).not.toBeNull();
  });
  it("startMs = awal jendela hari itu", () => {
    const a = activeRule([r({})], new Date("2026-10-09T03:30:00Z"))!;
    expect(new Date(a.startMs).toISOString()).toBe("2026-10-09T03:00:00.000Z"); // 10:00 WIB
  });
});

describe("parseYouTube", () => {
  it("playlist, video, youtu.be", () => {
    expect(parseYouTube("https://www.youtube.com/playlist?list=PLabc_123")).toEqual({ list: "PLabc_123", video: "" });
    expect(parseYouTube("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ list: "", video: "dQw4w9WgXcQ" });
    expect(parseYouTube("https://youtu.be/dQw4w9WgXcQ")?.video).toBe("dQw4w9WgXcQ");
    expect(parseYouTube("https://music.youtube.com/watch?v=abc12345678&list=PLxyz")).toEqual({ list: "PLxyz", video: "abc12345678" });
  });
  it("menolak domain lain / tanpa id / karakter aneh", () => {
    expect(parseYouTube("https://evil.com/watch?v=abc")).toBeNull();
    expect(parseYouTube("https://www.youtube.com/")).toBeNull();
    expect(parseYouTube("https://www.youtube.com/watch?v=a<b")).toBeNull();
    expect(parseYouTube("bukan url")).toBeNull();
  });
});
