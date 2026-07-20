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

    const requests = await getSheetData('registration_request', { skipCache: true });
    const requestIndex = requests.findIndex((r: any) => r.id === id);

    if (requestIndex === -1) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const requestData = requests[requestIndex];
    const rowIndex = requestIndex + 2;

    if (status === 'approved') {
      // Create user in users sheet
      // ⚠️ Urutan array ini HARUS persis sama dengan urutan kolom di
      // app/api/users/route.ts (PUT /api/users), yang merupakan sumber
      // kebenaran untuk layout kolom sheet `users` (A..BE, 57 kolom).
      // Sebelumnya array ini sudah lama tidak sinkron (offset sejak kolom
      // stock_opname / X), sehingga user yang baru di-approve mendapat
      // permission yang salah tempat / hilang. Jika menambah permission baru,
      // tambahkan di KEDUA file ini di posisi yang sama.
      const newUser = [
        requestData.id,                                            // A
        requestData.name,                                          // B
        requestData.user_name,                                     // C
        requestData.password,                                      // D
        permissions.dashboard ? 'TRUE' : 'FALSE',                   // E
        permissions.order_report ? 'TRUE' : 'FALSE',                // F
        permissions.stock ? 'TRUE' : 'FALSE',                       // G
        permissions.registration_request ? 'TRUE' : 'FALSE',        // H
        permissions.user_setting ? 'TRUE' : 'FALSE',                // I
        permissions.petty_cash ? 'TRUE' : 'FALSE',                  // J
        permissions.petty_cash_add ? 'TRUE' : 'FALSE',              // K
        permissions.petty_cash_export ? 'TRUE' : 'FALSE',           // L
        permissions.petty_cash_balance ? 'TRUE' : 'FALSE',          // M
        permissions.order_report_import ? 'TRUE' : 'FALSE',         // N
        permissions.order_report_export ? 'TRUE' : 'FALSE',         // O
        permissions.customer ? 'TRUE' : 'FALSE',                    // P
        permissions.voucher ? 'TRUE' : 'FALSE',                     // Q
        permissions.bundling ? 'TRUE' : 'FALSE',                    // R
        permissions.canvasing ? 'TRUE' : 'FALSE',                   // S
        permissions.canvasing_export ? 'TRUE' : 'FALSE',            // T
        permissions.request ? 'TRUE' : 'FALSE',                     // U
        permissions.edit_request ? 'TRUE' : 'FALSE',                // V
        permissions.analytics_order ? 'TRUE' : 'FALSE',             // W
        permissions.stock_opname ? 'TRUE' : 'FALSE',                // X
        permissions.stock_import ? 'TRUE' : 'FALSE',                // Y
        permissions.stock_export ? 'TRUE' : 'FALSE',                // Z
        permissions.stock_view_store ? 'TRUE' : 'FALSE',            // AA
        permissions.stock_view_pca ? 'TRUE' : 'FALSE',              // AB
        permissions.stock_view_master ? 'TRUE' : 'FALSE',           // AC
        permissions.stock_view_hpp ? 'TRUE' : 'FALSE',              // AD
        permissions.stock_view_hpt ? 'TRUE' : 'FALSE',              // AE
        permissions.stock_view_hpj ? 'TRUE' : 'FALSE',              // AF
        permissions.stock_refresh_javelin ? 'TRUE' : 'FALSE',       // AG
        permissions.traffic_store ? 'TRUE' : 'FALSE',               // AH
        permissions.report_store ? 'TRUE' : 'FALSE',                // AI
        permissions.request_tracking ? 'TRUE' : 'FALSE',            // AJ
        permissions.tracking_edit ? 'TRUE' : 'FALSE',               // AK
        permissions.stock_opname_report ? 'TRUE' : 'FALSE',         // AL
        permissions.attendance ? 'TRUE' : 'FALSE',                  // AM
        permissions.attendance_report ? 'TRUE' : 'FALSE',           // AN
        permissions.invoice ? 'TRUE' : 'FALSE',                     // AO
        permissions.invoice_create ? 'TRUE' : 'FALSE',              // AP
        permissions.invoice_edit ? 'TRUE' : 'FALSE',                // AQ
        permissions.invoice_delete ? 'TRUE' : 'FALSE',              // AR
        permissions.invoice_master ? 'TRUE' : 'FALSE',              // AS
        permissions.sales_view ? 'TRUE' : 'FALSE',                  // AT
        permissions.sales_view_all ? 'TRUE' : 'FALSE',              // AU
        permissions.attendance_store ? 'TRUE' : 'FALSE',            // AV
        permissions.attendance_store_all ? 'TRUE' : 'FALSE',        // AW
        permissions.material_issue ? 'TRUE' : 'FALSE',              // AX
        permissions.material_issue_all ? 'TRUE' : 'FALSE',          // AY
        permissions.asset_store ? 'TRUE' : 'FALSE',                 // AZ
        '', // last_activity (empty on creation)                   // BA
        permissions.step_erp ? 'TRUE' : 'FALSE',                    // BB
        permissions.step_erp_all ? 'TRUE' : 'FALSE',                // BC
        permissions.employee_discount ? 'TRUE' : 'FALSE',           // BD
        permissions.employee_discount_approval ? 'TRUE' : 'FALSE', // BE
        permissions.daily_checklist ? 'TRUE' : 'FALSE',             // BF
        permissions.daily_checklist_all ? 'TRUE' : 'FALSE',         // BG
        permissions.stock_pca_view ? 'TRUE' : 'FALSE',              // BH
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