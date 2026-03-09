import { NextRequest } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

// ─── Server-side shared cache ────────────────────────────────────────────────
// Semua koneksi SSE berbagi satu cache ini.
// Sheets API hanya di-hit maksimal 1x per CACHE_TTL_MS, berapapun user aktif.
const CACHE_TTL_MS = 20_000;
const POLL_INTERVAL_MS = 20_000;

let cachedData: any[] | null = null;
let cacheTimestamp = 0;
let isFetching = false;

async function getCachedData(): Promise<any[]> {
  const now = Date.now();

  if (cachedData !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedData;
  }

  if (isFetching) {
    return cachedData ?? [];
  }

  isFetching = true;
  try {
    const data = await getSheetData('request_store');
    const filtered = data.filter((row: any) => row.id);
    const sorted = filtered.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    cachedData = sorted;
    cacheTimestamp = Date.now();
    return sorted;
  } finally {
    isFetching = false;
  }
}

export async function GET(request: NextRequest) {
  // ─── FIX: username param tidak dipakai di sini lagi ──────────────────────
  // Dulu username dipakai untuk filter notif, tapi sekarang notifikasi sudah
  // sepenuhnya dihandle oleh NotificationListener di client.
  // SSE ini hanya mengirim data tabel ke semua koneksi aktif.
  // Tidak ada logika notifikasi di server-side SSE ini.
  // ─────────────────────────────────────────────────────────────────────────

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller sudah closed
        }
      };

      // Kirim data awal
      try {
        const data = await getCachedData();
        send({ type: 'init', data });
      } catch {
        send({ type: 'error', message: 'Failed to fetch' });
      }

      // Poll cache setiap POLL_INTERVAL_MS
      const interval = setInterval(async () => {
        try {
          const data = await getCachedData();
          send({ type: 'update', data });
        } catch {
          send({ type: 'error', message: 'Failed to fetch' });
        }
      }, POLL_INTERVAL_MS);

      // Cleanup saat klien disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}