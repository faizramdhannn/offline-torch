export function toDriveProxyUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("data:")) return url;
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return `/api/drive-image?id=${m[1]}`;
  return url;
}

export function isValidSelfie(url: string): boolean {
  if (!url) return false;
  if (url === "data:," || url === "data:") return false;
  if (url.startsWith("data:") && url.length < 100) return false;
  return true;
}

export function extractTime(ts: string): string {
  if (!ts) return "-";
  const m = ts.match(/,\s*(\d{2}[.:]\d{2})/);
  if (m) return m[1].replace(".", ":");
  const parts = ts.split(",");
  if (parts.length > 1) return parts[1].trim().substring(0, 5);
  return ts;
}

export function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("OPR") || ua.includes("Opera")) return "Opera";
  return "Unknown";
}

export function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android Mobile";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS Device";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown Device";
}

export async function getPublicIP(): Promise<string> {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const d = await r.json();
    return d.ip || "unknown";
  } catch {
    return "unknown";
  }
}

export function buildMapsUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=17`;
}

export function nowTimestamp(): string {
  return new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
}

export function parseHHMM(timeStr: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function nowMinutesWIB(): number {
  const now = new Date();
  const wib = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  return wib.getHours() * 60 + wib.getMinutes();
}

export function isCloseWindowActive(closeHours: string): boolean {
  const target = parseHHMM(closeHours);
  if (target === null) return true;
  const now = nowMinutesWIB();
  return now >= target - 5 && now <= target + 120;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}