import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('master_bundling');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching bundling data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bundling data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bundling_name,
      option_1, option_2, option_3, option_4, option_5, option_6,
      discount_1, discount_2, discount_3, discount_4, discount_5, discount_6,
      total_value,
      discount_percentage,
      discount_value,
      value,
      torch_cirebon, torch_jogja, torch_karawaci, torch_karawang,
      torch_lampung, torch_lembong, torch_makassar, torch_malang,
      torch_margonda, torch_medan, torch_pekalongan, torch_purwokerto,
      torch_surabaya, torch_tambun,
      status,
    } = body;

    const id = Date.now().toString();
    const now = new Date().toISOString();

    const newBundling = [
      id,
      bundling_name,
      option_1 || '',
      option_2 || '',
      option_3 || '',
      option_4 || '',
      option_5 || '',
      option_6 || '',
      discount_1 || '0',
      discount_2 || '0',
      discount_3 || '0',
      discount_4 || '0',
      discount_5 || '0',
      discount_6 || '0',
      total_value,
      discount_percentage,
      discount_value,
      value,
      torch_cirebon || '0',
      torch_jogja || '0',
      torch_karawaci || '0',
      torch_karawang || '0',
      torch_lampung || '0',
      torch_lembong || '0',
      torch_makassar || '0',
      torch_malang || '0',
      torch_margonda || '0',
      torch_medan || '0',
      torch_pekalongan || '0',
      torch_purwokerto || '0',
      torch_surabaya || '0',
      torch_tambun || '0',
      status,
      now,
      now,
    ];

    await appendSheetData('master_bundling', [newBundling]);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating bundling:', error);
    return NextResponse.json(
      { error: 'Failed to create bundling' },
      { status: 500 }
    );
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
      total_value,
      discount_percentage,
      discount_value,
      value,
      torch_cirebon, torch_jogja, torch_karawaci, torch_karawang,
      torch_lampung, torch_lembong, torch_makassar, torch_malang,
      torch_margonda, torch_medan, torch_pekalongan, torch_purwokerto,
      torch_surabaya, torch_tambun,
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

    const updatedRow = [
      id,
      bundling_name,
      option_1 || '',
      option_2 || '',
      option_3 || '',
      option_4 || '',
      option_5 || '',
      option_6 || '',
      discount_1 || '0',
      discount_2 || '0',
      discount_3 || '0',
      discount_4 || '0',
      discount_5 || '0',
      discount_6 || '0',
      total_value,
      discount_percentage,
      discount_value,
      value,
      torch_cirebon || '0',
      torch_jogja || '0',
      torch_karawaci || '0',
      torch_karawang || '0',
      torch_lampung || '0',
      torch_lembong || '0',
      torch_makassar || '0',
      torch_malang || '0',
      torch_margonda || '0',
      torch_medan || '0',
      torch_pekalongan || '0',
      torch_purwokerto || '0',
      torch_surabaya || '0',
      torch_tambun || '0',
      status,
      bundling.created_at,
      now,
    ];

    await updateSheetRow('master_bundling', rowIndex, updatedRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating bundling:', error);
    return NextResponse.json(
      { error: 'Failed to update bundling' },
      { status: 500 }
    );
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

    const rowIndex = bundlingIndex + 2;
    const bundling = bundlings[bundlingIndex];

    const updatedRow = [
      bundling.id,
      bundling.bundling_name,
      bundling.option_1 || '',
      bundling.option_2 || '',
      bundling.option_3 || '',
      bundling.option_4 || '',
      bundling.option_5 || '',
      bundling.option_6 || '',
      bundling.discount_1 || '0',
      bundling.discount_2 || '0',
      bundling.discount_3 || '0',
      bundling.discount_4 || '0',
      bundling.discount_5 || '0',
      bundling.discount_6 || '0',
      bundling.total_value,
      bundling.discount_percentage,
      bundling.discount_value,
      bundling.value,
      bundling.torch_cirebon,
      bundling.torch_jogja,
      bundling.torch_karawaci,
      bundling.torch_karawang,
      bundling.torch_lampung,
      bundling.torch_lembong,
      bundling.torch_makassar,
      bundling.torch_malang,
      bundling.torch_margonda,
      bundling.torch_medan,
      bundling.torch_pekalongan,
      bundling.torch_purwokerto,
      bundling.torch_surabaya,
      bundling.torch_tambun,
      'deleted',
      bundling.created_at,
      new Date().toISOString(),
    ];

    await updateSheetRow('master_bundling', rowIndex, updatedRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bundling:', error);
    return NextResponse.json(
      { error: 'Failed to delete bundling' },
      { status: 500 }
    );
  }
}