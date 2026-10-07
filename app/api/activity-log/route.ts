import { NextRequest, NextResponse } from 'next/server';
import { countToday, listPage, listByEntity, listRecent, insertActivity } from '@/lib/activityLog';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');

    // Ringkasan untuk dashboard: jumlah log hari ini (WIB).
    if (searchParams.get('summary') === 'today') {
      return NextResponse.json({ today: await countToday() });
    }

    // Daftar berhalaman untuk Settings: ?page=&per=&q= → { rows, total }
    if (searchParams.has('page')) {
      const per = Math.min(100, Math.max(1, parseInt(searchParams.get('per') || '10') || 10));
      const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
      return NextResponse.json(await listPage(page, per, (searchParams.get('q') || '').trim()));
    }

    // Riwayat satu entitas (komponen ActivityHistory).
    if (entityType) {
      return NextResponse.json(await listByEntity(entityType, entityId || ''));
    }

    // Tanpa parameter: 500 log terbaru (dulu seluruh sheet).
    return NextResponse.json(await listRecent(500));
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity log' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      user,
      method,
      activity_log: activityLog,
      entity_type: entityType,
      entity_id: entityId,
    } = await request.json();

    if (!user || !method || !activityLog) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Riwayat disimpan permanen (tidak ada pembersihan otomatis).
    const id = await insertActivity({
      user,
      method,
      activity_log: activityLog,
      entity_type: entityType || '',
      entity_id: entityId != null ? String(entityId) : '',
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating activity log:', error);
    return NextResponse.json(
      { error: 'Failed to create activity log' },
      { status: 500 }
    );
  }
}
