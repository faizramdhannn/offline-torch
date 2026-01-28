import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasGoogleCreds: !!process.env.GOOGLE_CREDENTIALS,
    googleCredsLength: process.env.GOOGLE_CREDENTIALS?.length || 0,
    spreadsheetStock: process.env.SPREADSHEET_STOCK || 'NOT SET',
    nodeEnv: process.env.NODE_ENV,
  });
}