import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, appendSheetData, updateSheetRow } from '@/lib/sheets';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('registration_request');
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch registration requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, username, password } = await request.json();
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = Date.now().toString();
    const requestAt = new Date().toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const newRequest = [id, name, username, hashedPassword, 'pending', requestAt];
    await appendSheetData('registration_request', [newRequest]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create registration request' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, status, permissions } = await request.json();

    const requests = await getSheetData('registration_request');
    const requestIndex = requests.findIndex((r: any) => r.id === id);

    if (requestIndex === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const requestData = requests[requestIndex];
    const rowIndex = requestIndex + 2;

    if (status === 'approved') {
      // Create user in users sheet
      const newUser = [
        requestData.id,
        requestData.name,
        requestData.user_name,
        requestData.password,
        permissions.dashboard ? 'TRUE' : 'FALSE',
        permissions.order_report ? 'TRUE' : 'FALSE',
        permissions.stock ? 'TRUE' : 'FALSE',
        permissions.registration_request ? 'TRUE' : 'FALSE',
        permissions.user_setting ? 'TRUE' : 'FALSE',
        permissions.petty_cash ? 'TRUE' : 'FALSE',
        permissions.petty_cash_add ? 'TRUE' : 'FALSE',
        permissions.petty_cash_export ? 'TRUE' : 'FALSE',
        permissions.petty_cash_balance ? 'TRUE' : 'FALSE',
        permissions.order_report_import ? 'TRUE' : 'FALSE',
        permissions.order_report_export ? 'TRUE' : 'FALSE',
        permissions.customer ? 'TRUE' : 'FALSE',
        permissions.voucher ? 'TRUE' : 'FALSE',
        permissions.bundling ? 'TRUE' : 'FALSE',
        permissions.canvasing ? 'TRUE' : 'FALSE',
        permissions.canvasing_export ? 'TRUE' : 'FALSE',
        permissions.request ? 'TRUE' : 'FALSE',
        permissions.edit_request ? 'TRUE' : 'FALSE',
        permissions.analytics_order ? 'TRUE' : 'FALSE',
        permissions.stock_opname ? 'TRUE' : 'FALSE',
        permissions.attendance ? 'TRUE' : 'FALSE',
        // Stock permissions
        permissions.stock_import ? 'TRUE' : 'FALSE',
        permissions.stock_export ? 'TRUE' : 'FALSE',
        permissions.stock_view_store ? 'TRUE' : 'FALSE',
        permissions.stock_view_pca ? 'TRUE' : 'FALSE',
        permissions.stock_view_master ? 'TRUE' : 'FALSE',
        permissions.stock_view_hpp ? 'TRUE' : 'FALSE',
        permissions.stock_view_hpt ? 'TRUE' : 'FALSE',
        permissions.stock_view_hpj ? 'TRUE' : 'FALSE',
        permissions.stock_refresh_javelin ? 'TRUE' : 'FALSE',
        '', // last_activity (empty on creation)
        permissions.traffic_store ? 'TRUE' : 'FALSE',
        permissions.report_store ? 'TRUE' : 'FALSE',
        // Shipment permissions
        permissions.request_tracking ? 'TRUE' : 'FALSE',
        permissions.tracking_edit ? 'TRUE' : 'FALSE',
        new Date().toISOString(),
      ];

      await appendSheetData('users', [newUser]);

      const updatedRow = [
        requestData.id,
        requestData.name,
        requestData.user_name,
        requestData.password,
        'approved',
        requestData.request_at,
      ];
      await updateSheetRow('registration_request', rowIndex, updatedRow);

    } else if (status === 'rejected') {
      const updatedRow = [
        requestData.id,
        requestData.name,
        requestData.user_name,
        requestData.password,
        'rejected',
        requestData.request_at,
      ];
      await updateSheetRow('registration_request', rowIndex, updatedRow);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update registration request' }, { status: 500 });
  }
}