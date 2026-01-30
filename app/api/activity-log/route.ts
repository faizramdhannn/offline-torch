import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('activity_log');
    
    // Sort by timestamp descending (newest first)
    const sortedData = data.sort((a: any, b: any) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA; // Newest first
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

    // Auto-delete logs older than 10 days (cleanup in background)
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

/**
 * Clean logs older than 10 days by physically deleting rows
 * This rewrites the entire sheet with only recent logs
 */
async function cleanOldLogs() {
  try {
    const data = await getSheetData('activity_log');
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));

    // Filter logs that are within 10 days (keep recent logs only)
    const recentLogs = data.filter((log: any) => {
      try {
        // Parse timestamp (format: "DD MMM YYYY, HH:MM:SS")
        const dateStr = log.timestamp.split(',')[0]; // Get date part
        const [day, month, year] = dateStr.split(' ');
        
        const months: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'Mei': 4, 'Jun': 5,
          'Jul': 6, 'Agu': 7, 'Sep': 8, 'Okt': 9, 'Nov': 10, 'Des': 11
        };
        
        const logDate = new Date(parseInt(year), months[month], parseInt(day));
        
        return logDate >= tenDaysAgo;
      } catch {
        // If can't parse, keep the log (safer)
        return true;
      }
    });

    // If some logs are old (need to be deleted), rewrite entire sheet
    if (recentLogs.length < data.length) {
      const deletedCount = data.length - recentLogs.length;
      console.log(`🧹 Cleaning activity log: removing ${deletedCount} old entries (keeping ${recentLogs.length})`);
      
      const { updateSheetDataWithHeader } = await import('@/lib/sheets');
      const headers = ['id', 'timestamp', 'user', 'method', 'activity_log'];
      
      // Map recent logs to rows format
      const rows = recentLogs.map((log: any) => [
        log.id,
        log.timestamp,
        log.user,
        log.method,
        log.activity_log
      ]);
      
      // Rewrite sheet with header + recent logs only
      // This PHYSICALLY REMOVES old rows (not just clearing data)
      await updateSheetDataWithHeader('activity_log', [headers, ...rows]);
      
      console.log(`✅ Activity log cleaned: ${deletedCount} rows deleted, ${recentLogs.length} rows remaining`);
    } else {
      console.log(`✓ Activity log clean: all ${data.length} entries are recent (< 10 days)`);
    }
  } catch (error) {
    console.error('❌ Error cleaning old logs:', error);
    // Don't throw - this is background cleanup, shouldn't fail the main request
  }
}