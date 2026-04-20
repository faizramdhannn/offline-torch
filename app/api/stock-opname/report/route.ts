import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || '';
    const hasReportAccess = searchParams.get('hasReportAccess') === 'true';

    const reports = await getSheetData('sto_store_report');
    const filtered = reports.filter((row: any) => row.id);

    // If has report access, return all reports
    if (hasReportAccess) {
      return NextResponse.json(filtered);
    }

    // For non-report-access users:
    // Get their allowed store entries from sto_store (where store col = username)
    const stores = await getSheetData('sto_store');
    const userStores = stores.filter(
      (row: any) =>
        row.store &&
        row.store.trim().toLowerCase() === username.trim().toLowerCase()
    );

    // Collect all store_location values and IDs from user's stores
    // The sto_store_report.store column contains the store name (e.g. "Torch Store Lembong- T")
    // We need to match by checking if the report store name contains any of the user's store keywords
    // OR match by the sto_store id
    const userStoreIds = userStores.map((s: any) => String(s.id));
    const userStoreNames = userStores.map((s: any) =>
      (s.store || '').trim().toLowerCase()
    );

    const userReports = filtered.filter((row: any) => {
      // Match by id reference
      if (row.store && userStoreIds.includes(String(row.store))) return true;
      // Match by store name containing username keyword
      const reportStoreLower = (row.store || '').toLowerCase();
      return userStoreNames.some(
        (name) => name && reportStoreLower.includes(name)
      );
    });

    return NextResponse.json(userReports);
  } catch (error) {
    console.error('Error fetching sto_store_report:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}