import { createHmac, randomBytes } from "crypto";

// Akses REST Ably dari server (tanpa SDK: ringan untuk fungsi serverless).
// ABLY_API_KEY = "appId.keyId:secret" — rahasia, hanya di env server, tidak pernah dikirim ke browser.
export const REALTIME_CHANNEL = "stores";

async function ablyError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return String(j?.error?.message || "").slice(0, 200);
  } catch {
    return "";
  }
}

function key(): { name: string; auth: string } | null {
  const k = process.env.ABLY_API_KEY;
  if (!k || !k.includes(":")) return null;
  return { name: k.split(":")[0], auth: "Basic " + Buffer.from(k).toString("base64") };
}

export const realtimeConfigured = () => !!key();

// Permintaan token (TokenRequest) bertanda tangan HMAC berumur 1 jam dengan hak terbatas:
// subscribe + presence saja. Browser menukarkannya sendiri ke Ably — server tidak perlu memanggil Ably,
// dan secret key tidak pernah keluar dari server. Perintah TIDAK dipublikasi dari browser — selalu lewat
// /api/devices/command (dicek izin & dicatat).
export async function createToken(clientId: string): Promise<unknown> {
  const raw = process.env.ABLY_API_KEY;
  if (!raw || !raw.includes(":")) throw new Error("ABLY_API_KEY belum diset");
  const [keyName, secret] = [raw.slice(0, raw.indexOf(":")), raw.slice(raw.indexOf(":") + 1)];
  const ttl = 60 * 60 * 1000;
  const capability = JSON.stringify({ [REALTIME_CHANNEL]: ["subscribe", "presence"] });
  const timestamp = Date.now();
  const nonce = randomBytes(12).toString("hex");
  const text = [keyName, ttl, capability, clientId, timestamp, nonce].map((x) => `${x}\n`).join("");
  const mac = createHmac("sha256", secret).update(text).digest("base64");
  return { keyName, ttl, capability, clientId, timestamp, nonce, mac };
}

export async function publishCommand(data: unknown): Promise<void> {
  const k = key();
  if (!k) throw new Error("ABLY_API_KEY belum diset");
  const res = await fetch(`https://rest.ably.io/channels/${REALTIME_CHANNEL}/messages`, {
    method: "POST",
    headers: { Authorization: k.auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "command", data }),
  });
  if (!res.ok) throw new Error(`Ably publish ${res.status}: ${await ablyError(res)}`);
}
