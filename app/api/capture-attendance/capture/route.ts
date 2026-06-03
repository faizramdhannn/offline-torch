import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';
import { uploadAttendanceSelfie } from '@/lib/attendanceDrive';

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
        const ts = r.open_timestamp || r.created_at || '';
        const created = r.created_at || '';
        return ts.includes(date) || created.startsWith(date);
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

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('GET attendance error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, store_name, device_info, browser, ip_address, is_valid_location } = body;

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

    const allRows: any[] = await getSheetData('attendance_store');

    const todayRowIndex = allRows.findIndex((r) => {
      const ts = r.open_timestamp || r.created_at || '';
      return (
        r.store_name?.toLowerCase() === store_name.toLowerCase() &&
        ts.includes(todayISO)
      );
    });

    // Upload selfie
    let selfieUrl = '';
    const selfieDataUrl: string = action === 'open' ? body.open_selfie : body.close_selfie;
    // staff_name: joined with "; " from selected tafts (or empty)
    const staffName: string = action === 'open'
      ? (body.open_staff_name || '')
      : (body.close_staff_name || '');

    if (selfieDataUrl && selfieDataUrl.startsWith('data:')) {
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

      // Column order (sheet headers):
      // id | store_id | store_name | device_info | browser | ip_address | is_valid_location
      // | open_latitude | open_longitude | open_maps_url | open_timestamp | open_staff_name
      // | open_selfie | close_latitude | close_longitude | close_maps_url
      // | close_timestamp | close_staff_name | close_selfie | created_at | updated_at
      const newRow = [
        id,
        '',
        store_name,
        device_info || '',
        browser || '',
        ip_address || '',
        is_valid_location ? 'TRUE' : 'FALSE',
        body.open_latitude || '',
        body.open_longitude || '',
        body.open_maps_url || '',
        body.open_timestamp || nowStr,
        staffName,
        selfieUrl,
        '',   // close_latitude
        '',   // close_longitude
        '',   // close_maps_url
        '',   // close_timestamp
        '',   // close_staff_name
        '',   // close_selfie
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

      const updatedRow = [
        existing.id,
        existing.store_id || '',
        existing.store_name,
        existing.device_info || '',
        existing.browser || '',
        existing.ip_address || '',
        existing.is_valid_location || 'FALSE',
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
      return NextResponse.json({ success: true, id: existing.id });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('POST attendance error:', error);
    return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 });
  }
}