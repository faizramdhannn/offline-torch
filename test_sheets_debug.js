// Test script to debug getSheetData
// Save as: test_sheets_debug.js
// Run: node test_sheets_debug.js

const { google } = require('googleapis');

const SPREADSHEET_STOCK = process.env.SPREADSHEET_STOCK || '1KwhXDHCS0PTA5ilOBrx_ZxG0rGHiCfr84_sCKfH7TRw';

async function testGetSheetData() {
  try {
    console.log('=== Testing getSheetData for system_config ===');
    console.log('SPREADSHEET_STOCK:', SPREADSHEET_STOCK);
    console.log('GOOGLE_CREDENTIALS length:', process.env.GOOGLE_CREDENTIALS?.length || 0);
    
    // Initialize auth
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Get data
    console.log('\nFetching system_config sheet...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_STOCK,
      range: 'system_config!A1:ZZ',
    });

    const rows = response.data.values || [];
    console.log('\nTotal rows:', rows.length);
    
    if (rows.length === 0) {
      console.log('❌ NO DATA FOUND!');
      return;
    }

    // Show headers
    console.log('\nHeaders:', rows[0]);
    
    // Show all rows
    console.log('\nAll rows:');
    rows.forEach((row, index) => {
      console.log(`Row ${index}:`, row);
    });
    
    // Process data like in sheets.ts
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || null;
      });
      return obj;
    });
    
    console.log('\nProcessed data:');
    console.log(JSON.stringify(data, null, 2));
    
    // Look for javelin_cookie
    const cookieEntry = data.find(row => row.config_key === 'javelin_cookie');
    
    if (cookieEntry) {
      console.log('\n✅ Cookie entry found!');
      console.log('config_key:', cookieEntry.config_key);
      console.log('config_value length:', cookieEntry.config_value?.length || 0);
      console.log('config_value preview:', cookieEntry.config_value?.substring(0, 50) + '...');
    } else {
      console.log('\n❌ Cookie entry NOT FOUND!');
      console.log('Available config_keys:', data.map(r => r.config_key));
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.errors) console.error('Details:', error.errors);
  }
}

testGetSheetData();