import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const users = await getSheetData('users');
    
    const user = users.find(
      (u: any) => u.user_name === username
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Compare password dengan bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      user_name: user.user_name,
      dashboard: user.dashboard === 'TRUE',
      order_report: user.order_report === 'TRUE',
      stock: user.stock === 'TRUE',
      registration_request: user.registration_request === 'TRUE',
      user_setting: user.user_setting === 'TRUE',
      petty_cash: user.petty_cash === 'TRUE',
      petty_cash_add: user.petty_cash_add === 'TRUE',
      petty_cash_export: user.petty_cash_export === 'TRUE',
      order_report_import: user.order_report_import === 'TRUE',
      order_report_export: user.order_report_export === 'TRUE',
      customer: user.customer === 'TRUE',
      voucher: user.voucher === 'TRUE',
      bundling: user.bundling === 'TRUE',
      // Stock permissions
      stock_import: user.stock_import === 'TRUE',
      stock_export: user.stock_export === 'TRUE',
      stock_view_store: user.stock_view_store === 'TRUE',
      stock_view_pca: user.stock_view_pca === 'TRUE',
      stock_view_master: user.stock_view_master === 'TRUE',
      stock_view_hpp: user.stock_view_hpp === 'TRUE',
      stock_view_hpt: user.stock_view_hpt === 'TRUE',
      stock_view_hpj: user.stock_view_hpj === 'TRUE',
      stock_refresh_javelin: user.stock_refresh_javelin === 'TRUE',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}