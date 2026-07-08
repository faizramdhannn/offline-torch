import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, deleteSheetRows } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('activity_log');
    
    const sortedData = data.sort((a: any, b: any) => {
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
    const { user, method, activity_log: activityLog } = await request.json();

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
      activityLog
    ];

    await appendSheetData('activity_log', [newLog]);

    cleanOldLogs().catch(err => console.error('Background cleanup error:', err));

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating activity log:', error);
    return NextResponse.json(
      { error: 'Failed to create activity log' },
      { status: 500 }
    );
  }
}

async function cleanOldLogs() {
  try {
    // Fresh read (skip cache) — we're about to compute row indexes to delete,
    // so this must reflect the sheet's true current state, not a stale cache.
    const data = await getSheetData('activity_log', { skipCache: true });
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    const months: { [key: string]: number } = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'Mei': 4, 'Jun': 5,
      'Jul': 6, 'Agu': 7, 'Sep': 8, 'Okt': 9, 'Nov': 10, 'Des': 11
    };

    // Row 1 is the header; row 2 is data[0], row 3 is data[1], etc.
    const oldRowIndexes: number[] = [];
    data.forEach((log: any, i: number) => {
      try {
        const dateStr = log.timestamp.split(',')[0];
        const [day, month, year] = dateStr.trim().split(' ');
        const logDate = new Date(parseInt(year), months[month], parseInt(day));
        if (logDate < thirtyDaysAgo) {
          oldRowIndexes.push(i + 2);
        }
      } catch {
        // Unparseable timestamp — keep the row rather than risk deleting it.
      }
    });

    if (oldRowIndexes.length > 0) {
      console.log(`🧹 Cleaning activity log: removing ${oldRowIndexes.length} old entries (keeping ${data.length - oldRowIndexes.length})`);

      // Real row delete (single atomic batchUpdate) — the header row (row 1)
      // is never touched, so there's no clear-then-rewrite window where a
      // failed write could wipe the header or the whole sheet.
      await deleteSheetRows('activity_log', oldRowIndexes);

      console.log(`✅ Activity log cleaned: ${oldRowIndexes.length} rows deleted`);
    } else {
      console.log(`✓ Activity log clean: all ${data.length} entries are recent (< 30 days)`);
    }
  } catch (error) {
    console.error('❌ Error cleaning old logs:', error);
  }
}