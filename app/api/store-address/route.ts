import { NextRequest, NextResponse } from 'next/server';
import { getStoreAddressList } from '@/lib/storeAddress';

export async function GET(request: NextRequest) {
  try {
    const data = await getStoreAddressList();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching store addresses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch store addresses' },
      { status: 500 }
    );
  }
}
