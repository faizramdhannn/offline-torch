import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRow } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('users');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, permissions } = await request.json();

    // Get all users to find the row index
    const users = await getSheetData('users');
    const userIndex = users.findIndex((u: any) => u.id === id);
    
    if (userIndex === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = users[userIndex];
    
    // Update row (rowIndex is userIndex + 2 because of 1-based index and header row)
    const rowIndex = userIndex + 2;
    
    const updatedRow = [
      user.id,
      user.name,
      user.user_name,
      user.password,
      permissions.dashboard ? 'TRUE' : 'FALSE',
      permissions.order_report ? 'TRUE' : 'FALSE',
      permissions.stock ? 'TRUE' : 'FALSE',
      permissions.registration_request ? 'TRUE' : 'FALSE',
      permissions.user_setting ? 'TRUE' : 'FALSE',
      permissions.petty_cash ? 'TRUE' : 'FALSE',
      permissions.petty_cash_add ? 'TRUE' : 'FALSE',
      permissions.petty_cash_export ? 'TRUE' : 'FALSE',
      permissions.order_report_import ? 'TRUE' : 'FALSE',
      permissions.order_report_export ? 'TRUE' : 'FALSE',
      permissions.customer ? 'TRUE' : 'FALSE',
      permissions.voucher ? 'TRUE' : 'FALSE',
      permissions.bundling ? 'TRUE' : 'FALSE',
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
      new Date().toISOString()
    ];

    await updateSheetRow('users', rowIndex, updatedRow);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}