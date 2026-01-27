import { NextRequest, NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';

export async function GET(request: NextRequest) {
  try {
    const data = await getSheetData('order_report');
    
    // Sort data: null/empty delivery_note and sales_invoice first
    const sortedData = data.sort((a: any, b: any) => {
      // Check if delivery_note is null/empty
      const aDeliveryEmpty = !a.delivery_note || a.delivery_note === '' || a.delivery_note === 'null';
      const bDeliveryEmpty = !b.delivery_note || b.delivery_note === '' || b.delivery_note === 'null';
      
      // Check if sales_invoice is null/empty
      const aInvoiceEmpty = !a.sales_invoice || a.sales_invoice === '' || a.sales_invoice === 'null';
      const bInvoiceEmpty = !b.sales_invoice || b.sales_invoice === '' || b.sales_invoice === 'null';
      
      // Priority 1: Both delivery_note AND sales_invoice are empty (highest priority)
      const aBothEmpty = aDeliveryEmpty && aInvoiceEmpty;
      const bBothEmpty = bDeliveryEmpty && bInvoiceEmpty;
      
      if (aBothEmpty && !bBothEmpty) return -1; // a comes first
      if (!aBothEmpty && bBothEmpty) return 1;  // b comes first
      
      // Priority 2: Either delivery_note OR sales_invoice is empty
      const aEitherEmpty = aDeliveryEmpty || aInvoiceEmpty;
      const bEitherEmpty = bDeliveryEmpty || bInvoiceEmpty;
      
      if (aEitherEmpty && !bEitherEmpty) return -1; // a comes first
      if (!aEitherEmpty && bEitherEmpty) return 1;  // b comes first
      
      // If both have same empty status, maintain original order
      return 0;
    });
    
    return NextResponse.json(sortedData);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch order reports' },
      { status: 500 }
    );
  }
}