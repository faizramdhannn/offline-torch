import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

// ✅ Simpan last known data — kalau fetch gagal, return data lama
// daripada error 500 yang menyebabkan frontend menghapus tampilan last update.
let _lastKnownData: any[] | null = null;

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('last_update');
    // Simpan hasil sukses untuk fallback berikutnya
    if (Array.isArray(data) && data.length > 0) {
      _lastKnownData = data;
    }
    return NextResponse.json(data);
  } catch (error) {
    // ✅ Jangan return 500 — frontend akan menghapus last update strip.
    // Return data lama kalau ada, atau array kosong.
    if (_lastKnownData) {
      return NextResponse.json(_lastKnownData);
    }
    return NextResponse.json([]);
  }
}