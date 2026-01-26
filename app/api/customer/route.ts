import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRow } from '@/lib/sheets';
import { uploadToGoogleDrive } from '@/lib/drive';

const STORE_SHEETS = [
  'Torch Cirebon',
  'Torch Jogja',
  'Torch Karawaci',
  'Torch Karawang',
  'Torch Lampung',
  'Torch Lembong',
  'Torch Makassar',
  'Torch Malang',
  'Torch Margonda',
  'Torch Medan',
  'Torch Pekalongan',
  'Torch Purwokerto',
  'Torch Surabaya',
  'Torch Tambun',
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const view = searchParams.get('view') || 'list'; // 'list' or 'report'
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Check if username matches a store sheet
    const matchingSheet = STORE_SHEETS.find(sheet => {
      const storeName = sheet.replace('Torch ', '').toLowerCase().replace(/\s+/g, '');
      const usernameNormalized = username.toLowerCase().replace(/\s+/g, '').replace('torch', '');
      return storeName === usernameNormalized;
    });

    if (view === 'report') {
      // Generate report view for non-store users
      const reportData: any[] = [];
      
      for (const sheet of STORE_SHEETS) {
        try {
          const sheetData = await getSheetData(sheet);
          
          // Filter by date range if provided
          let filteredData = sheetData;
          if (dateFrom || dateTo) {
            filteredData = sheetData.filter((item: any) => {
              if (!item.update_at) return false;
              
              // Parse update_at (format: "DD MMM YYYY, HH:MM")
              const dateStr = item.update_at.split(',')[0]; // Get date part
              const [day, month, year] = dateStr.split(' ');
              const months: { [key: string]: number } = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
              };
              const itemDate = new Date(parseInt(year), months[month], parseInt(day));
              
              if (dateFrom) {
                const fromDate = new Date(dateFrom);
                if (itemDate < fromDate) return false;
              }
              if (dateTo) {
                const toDate = new Date(dateTo);
                if (itemDate > toDate) return false;
              }
              return true;
            });
          }
          
          // Count followup true per username
          const followupCount = filteredData.filter((item: any) => 
            item.followup === 'TRUE' || item.followup === 'True' || item.followup === 'true'
          ).length;
          
          const totalCustomers = filteredData.length;
          
          reportData.push({
            store: sheet,
            totalCustomers,
            followupCount,
            followupPercentage: totalCustomers > 0 ? Math.round((followupCount / totalCustomers) * 100) : 0,
          });
        } catch (error) {
          console.error(`Error fetching ${sheet}:`, error);
        }
      }
      
      return NextResponse.json({
        view: 'report',
        data: reportData,
      });
    }

    // List view
    if (matchingSheet) {
      // User owns this sheet, return only their data
      const data = await getSheetData(matchingSheet);
      return NextResponse.json({
        isOwner: true,
        storeName: matchingSheet,
        view: 'list',
        data: data,
      });
    } else {
      // User doesn't own a sheet, return all data
      const allData: any[] = [];
      
      for (const sheet of STORE_SHEETS) {
        try {
          const sheetData = await getSheetData(sheet);
          const dataWithStore = sheetData.map((item: any) => ({
            ...item,
            location_store: sheet,
          }));
          allData.push(...dataWithStore);
        } catch (error) {
          console.error(`Error fetching ${sheet}:`, error);
        }
      }
      
      return NextResponse.json({
        isOwner: false,
        view: 'list',
        data: allData,
      });
    }
  } catch (error) {
    console.error('Error fetching customer data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer data' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const storeName = formData.get('storeName') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    const username = formData.get('username') as string;
    const followup = formData.get('followup') === 'true';
    const result = formData.get('result') as string;
    const ket = formData.get('ket') as string;
    const file = formData.get('file') as File | null;
    const rowIndex = parseInt(formData.get('rowIndex') as string);

    if (!storeName || !phoneNumber) {
      return NextResponse.json(
        { error: 'Store name and phone number are required' },
        { status: 400 }
      );
    }

    // Get current data
    const data = await getSheetData(storeName);
    const rowData = data[rowIndex - 2]; // -2 because rowIndex is 1-based and includes header
    
    if (!rowData) {
      return NextResponse.json(
        { error: 'Row not found' },
        { status: 404 }
      );
    }

    let linkUrl = rowData.link_url || '';

    // Upload file if present
    if (file) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const fileName = `${dateStr}_${storeName}_${phoneNumber}_followup`;
      const fileBuffer = await file.arrayBuffer();
      linkUrl = await uploadToGoogleDrive(
        Buffer.from(fileBuffer),
        fileName,
        file.type,
        'customer_followup'
      );
    }

    // Update the row
    const updateAt = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const updatedRow = [
      rowData.phone_number,
      rowData.customer_name,
      rowData.location_store,
      rowData.total_order,
      rowData.total_value,
      rowData.average_value,
      followup ? 'TRUE' : 'FALSE', // followup
      result || rowData.result || '', // result
      ket || rowData.ket || '', // ket
      linkUrl, // link_url
      username, // update_by
      updateAt, // update_at
    ];

    await updateSheetRow(storeName, rowIndex, updatedRow);

    return NextResponse.json({ success: true, link_url: linkUrl });
  } catch (error) {
    console.error('Error updating customer data:', error);
    return NextResponse.json(
      { error: 'Failed to update customer data' },
      { status: 500 }
    );
  }
}