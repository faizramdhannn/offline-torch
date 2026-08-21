import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData } from '@/lib/sheets';

// Redirect + tracking untuk QR Code (mirip s.id) — PUBLIK, tidak login-gated.
// QR yang dibuat lewat menu QR Code sekarang meng-encode link ini
// (`/r/<uuid>`), bukan langsung URL aslinya, supaya tiap scan bisa dicatat
// ke sheet qr_code_analytic sebelum diteruskan (302) ke URL sebenarnya.

function parseUserAgent(ua: string) {
  const u = ua || '';
  let device_type = 'Desktop';
  if (/Tablet|iPad/i.test(u)) device_type = 'Tablet';
  else if (/Mobi|Android.*Mobile|iPhone/i.test(u)) device_type = 'Mobile';

  let os = 'Unknown';
  if (/Windows NT/i.test(u)) os = 'Windows';
  else if (/Mac OS X/i.test(u) && !/iPhone|iPad/i.test(u)) os = 'macOS';
  else if (/iPhone|iPad|iOS/i.test(u)) os = 'iOS';
  else if (/Android/i.test(u)) os = 'Android';
  else if (/Linux/i.test(u)) os = 'Linux';

  let browser = 'Unknown';
  if (/Edg\//i.test(u)) browser = 'Edge';
  else if (/OPR\//i.test(u)) browser = 'Opera';
  else if (/Chrome\//i.test(u) && !/Chromium/i.test(u)) browser = 'Chrome';
  else if (/CriOS\//i.test(u)) browser = 'Chrome (iOS)';
  else if (/Firefox\//i.test(u)) browser = 'Firefox';
  else if (/Safari\//i.test(u) && !/Chrome/i.test(u)) browser = 'Safari';

  return { device_type, os, browser };
}

async function lookupGeo(ip: string): Promise<{ country: string; city: string; region: string }> {
  const fallback = { country: '', city: '', region: '' };
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Local', city: 'Local', region: 'Local' };
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return fallback;
    const data = await res.json();
    if (data.status !== 'success') return fallback;
    return { country: data.country || '', city: data.city || '', region: data.regionName || '' };
  } catch {
    return fallback;
  }
}

function toJakartaTimestamp(): string {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const origin = new URL(request.url).origin;

  try {
    const rows = await getSheetData('qr_code');
    const item = rows.find((r: any) => r.uuid === uuid);
    if (!item || !item.url) {
      return NextResponse.redirect(origin);
    }

    const ua = request.headers.get('user-agent') || '';
    const referrer = request.headers.get('referer') || '';
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '';

    const { device_type, os, browser } = parseUserAgent(ua);
    const geo = await lookupGeo(ip);

    const row = [
      crypto.randomUUID(),
      uuid,
      toJakartaTimestamp(),
      ip,
      geo.country,
      geo.city,
      geo.region,
      device_type,
      os,
      browser,
      ua,
      referrer,
    ];
    // Ditunggu (bukan fire-and-forget) — di runtime serverless (Vercel), function
    // bisa langsung dibekukan begitu response redirect dikirim, jadi promise yang
    // belum selesai berisiko tidak pernah tercatat kalau tidak di-await di sini.
    try {
      await appendSheetData('qr_code_analytic', [row]);
    } catch (err) {
      console.error('Failed to log qr_code_analytic:', err);
    }

    return NextResponse.redirect(item.url);
  } catch (error) {
    console.error('Error in QR redirect:', error);
    return NextResponse.redirect(origin);
  }
}
