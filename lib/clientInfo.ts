// Info pemanggil dari header request (tanpa layanan geolokasi luar): IP, lokasi perkiraan, perangkat.
// Lokasi dari header Vercel (x-vercel-ip-*) — perkiraan berbasis IP (kota/provinsi), BUKAN lokasi GPS; hanya ada di deployment Vercel.
export interface ClientInfo {
  ip: string;
  country: string;
  region: string;
  city: string;
  latitude: string;
  longitude: string;
  timezone: string;
  user_agent: string;
  device_type: string; // Mobile | Tablet | Desktop
  os: string;
  browser: string;
  model: string;       // mis. "Pixel 8" (Android) — iPhone/iPad tidak membuka modelnya
}

const dec = (v: string | null) => {
  if (!v) return "";
  try { return decodeURIComponent(v); } catch { return v; }
};

export function clientIp(request: Request): string {
  const h = request.headers;
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "";
}

export function parseUA(ua: string): Pick<ClientInfo, "device_type" | "os" | "browser" | "model"> {
  const u = ua || "";
  let device_type = "Desktop";
  if (/iPad|Tablet/i.test(u) || (/Android/i.test(u) && !/Mobile/i.test(u))) device_type = "Tablet";
  else if (/Mobi|iPhone/i.test(u)) device_type = "Mobile";

  let os = "Tidak diketahui";
  if (/Windows NT/i.test(u)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(u)) os = "iOS";
  else if (/Android/i.test(u)) os = "Android";
  else if (/Mac OS X/i.test(u)) os = "macOS";
  else if (/CrOS/i.test(u)) os = "ChromeOS";
  else if (/Linux/i.test(u)) os = "Linux";

  let browser = "Tidak diketahui";
  if (/Edg\//i.test(u)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(u)) browser = "Opera";
  else if (/SamsungBrowser/i.test(u)) browser = "Samsung Internet";
  else if (/FBAN|FBAV/i.test(u)) browser = "Facebook (in-app)";
  else if (/Instagram/i.test(u)) browser = "Instagram (in-app)";
  else if (/CriOS\//i.test(u)) browser = "Chrome (iOS)";
  else if (/FxiOS|Firefox\//i.test(u)) browser = "Firefox";
  else if (/Chrome\//i.test(u)) browser = "Chrome";
  else if (/Safari\//i.test(u)) browser = "Safari";

  const m = u.match(/Android [\d.]+; ([^;)]+?)(?: Build|\)|;)/);
  return { device_type, os, browser, model: m ? m[1].trim() : "" };
}

export function clientInfo(request: Request): ClientInfo {
  const h = request.headers;
  const ua = h.get("user-agent") || "";
  return {
    ip: clientIp(request),
    country: dec(h.get("x-vercel-ip-country")),
    region: dec(h.get("x-vercel-ip-country-region")),
    city: dec(h.get("x-vercel-ip-city")),
    latitude: dec(h.get("x-vercel-ip-latitude")),
    longitude: dec(h.get("x-vercel-ip-longitude")),
    timezone: dec(h.get("x-vercel-ip-timezone")),
    user_agent: ua.slice(0, 300),
    ...parseUA(ua),
  };
}
