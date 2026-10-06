import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "torch_session";
export const SESSION_MAX_AGE_S = 6 * 60 * 60; // sama dengan batas sesi di browser (6 jam)

// AUTH_SECRET sebaiknya diset sendiri di Vercel; CRON_SECRET dipakai sebagai cadangan.
function secret(): string {
  const s = process.env.AUTH_SECRET || process.env.CRON_SECRET;
  if (!s) throw new Error("AUTH_SECRET (atau CRON_SECRET) belum diset");
  return s;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest();

export function createSessionToken(userName: string): string {
  const payload = b64(JSON.stringify({ u: userName, iat: Date.now(), exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S }));
  return `${payload}.${b64(sign(payload))}`;
}

export function verifySessionToken(token: string | undefined | null): { user: string; iat: number } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const expected = sign(payload);
    const given = Buffer.from(sig, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const { u, exp, iat } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!u || typeof exp !== "number" || exp < Date.now() / 1000) return null;
    return { user: u as string, iat: typeof iat === "number" ? iat : 0 };
  } catch {
    return null;
  }
}
