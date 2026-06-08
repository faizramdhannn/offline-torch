import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';
import { uploadAttendanceSelfie } from '@/lib/attendanceDrive';

// ─── Helper: parse Indonesian locale timestamp to YYYY-MM-DD ─────────────────
function tsToISO(ts: string): string {
  const monthMap: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04',
    Mei: '05', Jun: '06', Jul: '07', Agu: '08',
    Sep: '09', Okt: '10', Nov: '11', Des: '12',
  };
  const m = ts.match(/^(\d{2})\s+(\w{3})\s+(\d{4})/);
  if (!m) return ts;
  return `${m[3]}-${monthMap[m[2]] || '00'}-${m[1]}`;
}

function matchesDate(ts: string, date: string): boolean {
  if (!ts) return false;
  if (ts.includes(date)) return true;
  return tsToISO(ts) === date;
}

// ─── Coordinate Validation ────────────────────────────────────────────────────
function parseCoord(val: string): number {
  return parseFloat(String(val).replace(',', '.'));
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function validateCoordinates(
  openLat: string, openLng: string,
  closeLat: string, closeLng: string
): { isValid: boolean; distanceMeters: number | null } {
  const oLat = parseCoord(openLat);
  const oLng = parseCoord(openLng);
  const cLat = parseCoord(closeLat);
  const cLng = parseCoord(closeLng);

  if (isNaN(oLat) || isNaN(oLng) || isNaN(cLat) || isNaN(cLng)) {
    return { isValid: false, distanceMeters: null };
  }

  const distanceMeters = haversineDistance(oLat, oLng, cLat, cLng);
  return { isValid: distanceMeters <= 200, distanceMeters };
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeName = searchParams.get('store_name');
    const date = searchParams.get('date');
    const isAll = searchParams.get('all') === 'true';

    const rows: any[] = await getSheetData('attendance_store');

    let filtered = rows;

    if (storeName) {
      filtered = filtered.filter(
        (r) => r.store_name?.toLowerCase() === storeName.toLowerCase()
      );
    }

    if (date) {
      filtered = filtered.filter((r) => {
        return (
          matchesDate(r.open_timestamp || '', date) ||
          matchesDate(r.created_at || '', date)
        );
      });
    }

    if (!isAll) {
      filtered = filtered.map((r) => ({
        id: r.id,
        store_id: r.store_id,
        store_name: r.store_name,
        open_timestamp: r.open_timestamp,
        open_staff_name: r.open_staff_name,
        open_selfie: r.open_selfie,
        open_maps_url: r.open_maps_url,
        close_timestamp: r.close_timestamp,
        close_staff_name: r.close_staff_name,
        close_selfie: r.close_selfie,
        close_maps_url: r.close_maps_url,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    }

    return NextResponse.json(filtered, {
  headers: {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
  },
});
  } catch (error) {
    console.error('GET attendance error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, store_name, device_info, browser, ip_address } = body;

    if (!action || !store_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const now = new Date();
    const nowStr = now.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: 'Asia/Jakarta',
    });

    const jakartaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const todayISO = `${jakartaNow.getFullYear()}-${String(jakartaNow.getMonth() + 1).padStart(2, '0')}-${String(jakartaNow.getDate()).padStart(2, '0')}`;

    // ── Fetch store_id ────────────────────────────────────────────────────────
    let storeId = '';
    try {
      const storeList: any[] = await getSheetData('store_list');
      const storeMatch = storeList.find(
        (s) => s.store_name?.toLowerCase() === store_name.toLowerCase()
      );
      storeId = storeMatch?.id || '';
    } catch {
      // Non-fatal
    }

    const allRows: any[] = await getSheetData('attendance_store');

    const todayRowIndex = allRows.findIndex((r) => {
      if (r.store_name?.toLowerCase() !== store_name.toLowerCase()) return false;
      return (
        matchesDate(r.open_timestamp || '', todayISO) ||
        matchesDate(r.created_at || '', todayISO)
      );
    });

    // ── Upload selfie ─────────────────────────────────────────────────────────
    let selfieUrl = '';
    const selfieDataUrl: string = action === 'open' ? body.open_selfie : body.close_selfie;
    const staffName: string = action === 'open'
      ? (body.open_staff_name || '')
      : (body.close_staff_name || '');

    if (selfieDataUrl && selfieDataUrl.startsWith('data:image')) {
      try {
        const dateStr = todayISO.replace(/-/g, '');
        const actionLabel = action === 'open' ? 'Open' : 'Close';
        const fileName = `${actionLabel}_${store_name}_${dateStr}`;
        selfieUrl = await uploadAttendanceSelfie(selfieDataUrl, fileName, store_name);
      } catch (uploadErr) {
        console.error('Selfie upload failed, storing base64 fallback:', uploadErr);
        selfieUrl = selfieDataUrl;
      }
    }

    // ── OPEN ──────────────────────────────────────────────────────────────────
    if (action === 'open') {
      if (todayRowIndex !== -1) {
        return NextResponse.json({ error: 'Already checked in today' }, { status: 400 });
      }

      const id = `ATT-${Date.now()}`;

      const newRow = [
        id,
        storeId,
        store_name,
        device_info || '',
        browser || '',
        ip_address || '',
        'TRUE',                       // is_valid_location — belum bisa divalidasi saat open
        body.open_latitude || '',
        body.open_longitude || '',
        body.open_maps_url || '',
        body.open_timestamp || nowStr,
        staffName,
        selfieUrl,
        '',                           // close_latitude
        '',                           // close_longitude
        '',                           // close_maps_url
        '',                           // close_timestamp
        '',                           // close_staff_name
        '',                           // close_selfie
        nowStr,
        nowStr,
      ];

      await appendSheetData('attendance_store', [newRow]);
      return NextResponse.json({ success: true, id });
    }

    // ── CLOSE ─────────────────────────────────────────────────────────────────
    if (action === 'close') {
      if (todayRowIndex === -1) {
        return NextResponse.json({ error: 'No open attendance found for today' }, { status: 404 });
      }

      const existing = allRows[todayRowIndex];
      const rowNumber = todayRowIndex + 2;

      // Validasi koordinat open vs close
      const { isValid, distanceMeters } = validateCoordinates(
        existing.open_latitude,
        existing.open_longitude,
        body.close_latitude,
        body.close_longitude,
      );

      const updatedRow = [
        existing.id,
        existing.store_id || storeId,
        existing.store_name,
        existing.device_info || '',
        existing.browser || '',
        existing.ip_address || '',
        isValid ? 'TRUE' : 'FALSE',   // is_valid_location hasil validasi koordinat
        existing.open_latitude || '',
        existing.open_longitude || '',
        existing.open_maps_url || '',
        existing.open_timestamp || '',
        existing.open_staff_name || '',
        existing.open_selfie || '',
        body.close_latitude || '',
        body.close_longitude || '',
        body.close_maps_url || '',
        body.close_timestamp || nowStr,
        staffName,
        selfieUrl,
        existing.created_at || nowStr,
        nowStr,
      ];

      await updateSheetRow('attendance_store', rowNumber, updatedRow);
      return NextResponse.json({
        success: true,
        id: existing.id,
        valid: isValid,
        distance_meters: distanceMeters !== null ? Math.round(distanceMeters) : null,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('POST attendance error:', error);
    return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 });
  }
}