import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRowSkipColumns } from '@/lib/sheets';

const TORCH_SKIP_COUNT = 14;

function buildBeforeData(fields: {
  id: string;
  bundling_name: string;
  option_1: string; option_2: string; option_3: string;
  option_4: string; option_5: string; option_6: string;
  discount_1: string; discount_2: string; discount_3: string;
  discount_4: string; discount_5: string; discount_6: string;
  total_value: string;
  discount_percentage: string;
  discount_value: string;
  value: string;
}) {
  return [
    fields.id,
    fields.bundling_name,
    fields.option_1 || '',
    fields.option_2 || '',
    fields.option_3 || '',
    fields.option_4 || '',
    fields.option_5 || '',
    fields.option_6 || '',
    fields.discount_1 || '0',
    fields.discount_2 || '0',
    fields.discount_3 || '0',
    fields.discount_4 || '0',
    fields.discount_5 || '0',
    fields.discount_6 || '0',
    fields.total_value,
    fields.discount_percentage,
    fields.discount_value,
    fields.value,
  ]; // 18 elemen → A–R
}

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('master_bundling');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching bundling data:', error);
    return NextResponse.json({ error: 'Failed to fetch bundling data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bundling_name,
      option_1, option_2, option_3, option_4, option_5, option_6,
      discount_1, discount_2, discount_3, discount_4, discount_5, discount_6,
      total_value, discount_percentage, discount_value, value,
      status,
    } = body;

    const id = Date.now().toString();
    const now = new Date().toISOString();

    // Ambil data existing untuk tahu baris mana yang akan ditempati
    // getSheetData hanya return baris yang punya data (tidak termasuk baris kosong di tengah/akhir)
    // Baris baru = jumlah data + 2 (baris 1 = header)
    const existingData = await getSheetData('master_bundling');
    const newRowIndex = existingData.length + 2;

    const beforeData = buildBeforeData({
      id, bundling_name,
      option_1, option_2, option_3, option_4, option_5, option_6,
      discount_1, discount_2, discount_3, discount_4, discount_5, discount_6,
      total_value, discount_percentage, discount_value, value,
    });

    const afterData = [status, now, now];

    // Tulis langsung ke baris baru tanpa menyentuh kolom torch sama sekali
    await updateSheetRowSkipColumns(
      'master_bundling',
      newRowIndex,
      beforeData,
      afterData,
      TORCH_SKIP_COUNT
    );

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating bundling:', error);
    return NextResponse.json({ error: 'Failed to create bundling' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      bundling_name,
      option_1, option_2, option_3, option_4, option_5, option_6,
      discount_1, discount_2, discount_3, discount_4, discount_5, discount_6,
      total_value, discount_percentage, discount_value, value,
      status,
    } = body;

    const bundlings = await getSheetData('master_bundling');
    const bundlingIndex = bundlings.findIndex((b: any) => b.id === id);

    if (bundlingIndex === -1) {
      return NextResponse.json({ error: 'Bundling not found' }, { status: 404 });
    }

    const bundling = bundlings[bundlingIndex];
    const rowIndex = bundlingIndex + 2;
    const now = new Date().toISOString();

    const beforeData = buildBeforeData({
      id, bundling_name,
      option_1, option_2, option_3, option_4, option_5, option_6,
      discount_1, discount_2, discount_3, discount_4, discount_5, discount_6,
      total_value, discount_percentage, discount_value, value,
    });

    const afterData = [status, bundling.created_at, now];

    await updateSheetRowSkipColumns('master_bundling', rowIndex, beforeData, afterData, TORCH_SKIP_COUNT);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating bundling:', error);
    return NextResponse.json({ error: 'Failed to update bundling' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const bundlings = await getSheetData('master_bundling');
    const bundlingIndex = bundlings.findIndex((b: any) => b.id === id);

    if (bundlingIndex === -1) {
      return NextResponse.json({ error: 'Bundling not found' }, { status: 404 });
    }

    const bundling = bundlings[bundlingIndex];
    const rowIndex = bundlingIndex + 2;

    const beforeData = buildBeforeData({
      id: bundling.id,
      bundling_name: bundling.bundling_name,
      option_1: bundling.option_1, option_2: bundling.option_2,
      option_3: bundling.option_3, option_4: bundling.option_4,
      option_5: bundling.option_5, option_6: bundling.option_6,
      discount_1: bundling.discount_1, discount_2: bundling.discount_2,
      discount_3: bundling.discount_3, discount_4: bundling.discount_4,
      discount_5: bundling.discount_5, discount_6: bundling.discount_6,
      total_value: bundling.total_value,
      discount_percentage: bundling.discount_percentage,
      discount_value: bundling.discount_value,
      value: bundling.value,
    });

    const afterData = ['deleted', bundling.created_at, new Date().toISOString()];

    await updateSheetRowSkipColumns('master_bundling', rowIndex, beforeData, afterData, TORCH_SKIP_COUNT);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bundling:', error);
    return NextResponse.json({ error: 'Failed to delete bundling' }, { status: 500 });
  }
}