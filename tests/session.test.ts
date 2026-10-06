import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/session";
import { sessionUserName } from "@/lib/authz";

describe("sesi bertanda tangan", () => {
  it("token sah terbaca dengan identitas dan waktu terbit", () => {
    const t = createSessionToken("cirebon");
    const v = verifySessionToken(t);
    expect(v?.user).toBe("cirebon");
    expect(Math.abs((v?.iat ?? 0) - Date.now())).toBeLessThan(5000);
  });

  it("token dimodifikasi / palsu ditolak", () => {
    const [payload, sig] = createSessionToken("cirebon").split(".");
    const forged = Buffer.from(JSON.stringify({ u: "faizramdhann", iat: Date.now(), exp: 9999999999 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`)).toBeNull();
    expect(verifySessionToken(`${payload}.abc`)).toBeNull();
    expect(verifySessionToken("abc.def")).toBeNull();
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
  });

  it("token kedaluwarsa ditolak", () => {
    const crypto = require("crypto");
    const payload = Buffer.from(JSON.stringify({ u: "x", iat: 1, exp: 1 })).toString("base64url");
    const sig = crypto.createHmac("sha256", process.env.AUTH_SECRET).update(payload).digest().toString("base64url");
    expect(verifySessionToken(`${payload}.${sig}`)).toBeNull();
  });

  it("identitas diambil dari cookie, bukan dari parameter", () => {
    const t = createSessionToken("cirebon");
    const req = new Request("http://x/api/petty-cash?username=jogja", { headers: { cookie: `a=1; torch_session=${t}; b=2` } });
    expect(sessionUserName(req)).toBe("cirebon");
    expect(sessionUserName(new Request("http://x/api/x"))).toBeNull();
  });
});
