import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('activity_log');

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');

    const filteredData = entityType
      ? data.filter((log: any) =>
          log.entity_type === entityType && log.entity_id === entityId
        )
      : data;

    const sortedData = filteredData.sort((a: any, b: any) => {
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idB - idA;
    });

    return NextResponse.json(sortedData);
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

    const id = Date.now().toString();
    const timestamp = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    });

    const newLog = [
      id,
      timestamp,
      user,
      method,
      activityLog,
      entityType || '',
      entityId != null ? String(entityId) : ''
    ];

    await appendSheetData('activity_log', [newLog]);

    // Auto-cleanup (dulu menghapus log > 30 hari) SENGAJA dimatikan — user
    // minta semua riwayat aktivitas disimpan permanen, baik yang lama
    // (sudah ada di spreadsheet) maupun yang baru.

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating activity log:', error);
    return NextResponse.json(
      { error: 'Failed to create activity log' },
      { status: 500 }
    );
  }
}
