import { describe, it, expect } from "vitest";
import { clientInfo, clientIp, parseUA } from "@/lib/clientInfo";

describe("parseUA", () => {
  it("Android HP: tipe, OS, browser, model", () => {
    const r = parseUA("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36");
    expect(r).toEqual({ device_type: "Mobile", os: "Android", browser: "Chrome", model: "Pixel 8" });
  });
  it("iPhone Safari", () => {
    const r = parseUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1");
    expect(r).toMatchObject({ device_type: "Mobile", os: "iOS", browser: "Safari" });
  });
  it("tablet Android (tanpa 'Mobile') dan Windows Chrome", () => {
    expect(parseUA("Mozilla/5.0 (Linux; Android 13; SM-X710) Chrome/120.0 Safari/537.36").device_type).toBe("Tablet");
    expect(parseUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36")).toMatchObject({ device_type: "Desktop", os: "Windows", browser: "Chrome" });
  });
  it("browser dalam aplikasi (Instagram)", () => {
    expect(parseUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Mobile/15E148 Instagram 300.0").browser).toBe("Instagram (in-app)");
  });
});

describe("clientInfo", () => {
  it("IP dari x-forwarded-for pertama & lokasi dari header Vercel (di-decode)", () => {
    const req = new Request("http://x/api/registration", {
      headers: {
        "x-forwarded-for": "180.245.1.2, 10.0.0.1",
        "x-vercel-ip-country": "ID",
        "x-vercel-ip-country-region": "JK",
        "x-vercel-ip-city": "Kota%20Bandung",
        "x-vercel-ip-latitude": "-6.9",
        "x-vercel-ip-longitude": "107.6",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36",
      },
    });
    expect(clientIp(req)).toBe("180.245.1.2");
    expect(clientInfo(req)).toMatchObject({ ip: "180.245.1.2", country: "ID", city: "Kota Bandung", latitude: "-6.9", os: "Windows" });
  });
  it("tanpa header geo → kosong, tidak error", () => {
    const i = clientInfo(new Request("http://x"));
    expect(i.country).toBe("");
    expect(i.ip).toBe("");
  });
});
