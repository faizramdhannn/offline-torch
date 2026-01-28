import { NextRequest, NextResponse } from 'next/server';
import { updateSheetDataWithHeader, getSheetData } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const { sheetName, data } = await request.json();

    if (!['erp_stock_balance', 'javelin'].includes(sheetName)) {
      return NextResponse.json(
        { error: 'Invalid sheet name' },
        { status: 400 }
      );
    }

    const cleanedData = data.filter((row: any[]) => {
      return row.some(cell => cell !== null && cell !== undefined && cell !== '');
    });

    if (cleanedData.length === 0) {
      return NextResponse.json(
        { error: 'No valid data to import' },
        { status: 400 }
      );
    }
    
    await updateSheetDataWithHeader(sheetName, cleanedData);

    // Update last_update sheet with correct timezone
    const now = new Date();
    
    // Format with Jakarta timezone
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
                    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    
    const day = jakartaTime.getDate().toString().padStart(2, '0');
    const month = months[jakartaTime.getMonth()];
    const year = jakartaTime.getFullYear();
    const hours = jakartaTime.getHours().toString().padStart(2, '0');
    const minutes = jakartaTime.getMinutes().toString().padStart(2, '0');
    
    const dateStr = `${day} ${month} ${year}, ${hours}:${minutes}`;
    
    const sheetType = sheetName === 'erp_stock_balance' ? 'ERP' : 'Javelin';
    
    // Get existing last_update data
    const existingData = await getSheetData('last_update');
    
    // Create updated data array
    const updatedData: any[][] = [['type', 'last_update']];
    
    // Keep other types and update the current one
    const types = ['ERP', 'Javelin'];
    types.forEach(type => {
      if (type === sheetType) {
        updatedData.push([type, dateStr]);
      } else {
        const existing = existingData.find((row: any) => row.type === type);
        if (existing) {
          updatedData.push([type, existing.last_update]);
        } else {
          updatedData.push([type, '-']);
        }
      }
    });
    
    await updateSheetDataWithHeader('last_update', updatedData);

    return NextResponse.json({ 
      success: true, 
      rowsImported: cleanedData.length,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}