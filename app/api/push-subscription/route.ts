import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRow, appendSheetData } from '@/lib/sheets';

const SUBSCRIPTION_KEY_PREFIX = 'push_sub_';

// ✅ Cache lokal untuk system_config — supaya GET subscription tidak selalu
// hit Google Sheets API. Cache ini hidup selama instance serverless warm.
// TTL 5 menit cukup karena push subscription jarang berubah.
const _configCache = new Map<string, { value: string; row: number }>();
let _configCachePopulatedAt = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 menit

// ✅ Next available row untuk append — di-track in-memory supaya tidak perlu
// baca ulang sheet hanya untuk cari baris kosong.
let _nextAppendRow: number | null = null;

function isConfigCacheValid() {
  return _configCachePopulatedAt > 0 && Date.now() - _configCachePopulatedAt < CONFIG_CACHE_TTL;
}

async function getConfigData(): Promise<Map<string, { value: string; row: number }>> {
  if (isConfigCacheValid()) return _configCache;

  const data = await getSheetData('system_config');

  _configCache.clear();
  let maxRow = 1; // header = row 1
  data.forEach((row: any, idx: number) => {
    const sheetRow = idx + 2; // 1-based, +1 untuk header
    if (row.config_key) {
      _configCache.set(row.config_key, {
        value: row.config_value ?? '',
        row: sheetRow,
      });
    }
    maxRow = Math.max(maxRow, sheetRow);
  });
  _nextAppendRow = maxRow + 1;
  _configCachePopulatedAt = Date.now();

  return _configCache;
}

function invalidateConfigCache() {
  _configCachePopulatedAt = 0;
  _configCache.clear();
  _nextAppendRow = null;
}

export async function POST(request: NextRequest) {
  try {
    const { username, subscription } = await request.json();
    if (!username || !subscription) {
      return NextResponse.json({ error: 'Username and subscription required' }, { status: 400 });
    }

    const key = `${SUBSCRIPTION_KEY_PREFIX}${username}`;
    const subscriptionStr = JSON.stringify(subscription);
    const now = new Date().toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta',
    });

    const configMap = await getConfigData();
    const existing = configMap.get(key);

    if (existing) {
      // ✅ Update row yang sudah ada — row index sudah diketahui dari cache,
      // tidak perlu scan ulang sheet.
      await updateSheetRow('system_config', existing.row, [key, subscriptionStr, username, now]);

      // Update cache lokal tanpa invalidate — hindari fetch ulang
      _configCache.set(key, { value: subscriptionStr, row: existing.row });
    } else {
      // ✅ Append baris baru
      await appendSheetData('system_config', [[key, subscriptionStr, username, now]]);

      // Update cache lokal
      const newRow = _nextAppendRow ?? 999;
      _configCache.set(key, { value: subscriptionStr, row: newRow });
      if (_nextAppendRow) _nextAppendRow++;
      _configCachePopulatedAt = Date.now(); // tetap valid
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving subscription:', error);
    // Invalidate cache jika write gagal supaya read berikutnya fresh
    invalidateConfigCache();
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    if (!username) return NextResponse.json({ error: 'Username required' }, { status: 400 });

    const key = `${SUBSCRIPTION_KEY_PREFIX}${username}`;

    // ✅ Baca dari cache lokal dulu — tidak perlu hit Sheets API
    const configMap = await getConfigData();
    const entry = configMap.get(key);

    if (!entry?.value) return NextResponse.json({ subscription: null });
    return NextResponse.json({ subscription: JSON.parse(entry.value) });
  } catch (error) {
    console.error('Error getting subscription:', error);
    return NextResponse.json({ error: 'Failed to get subscription' }, { status: 500 });
  }
}