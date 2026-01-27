import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { getSheetData } from '@/lib/sheets';

// Get Javelin cookie from Google Sheets
async function getJavelinCookie(): Promise<string> {
  try {
    const data = await getSheetData('system_config');
    const cookieEntry = data.find((row: any) => row.config_key === 'javelin_cookie');
    
    if (cookieEntry && cookieEntry.config_value) {
      return cookieEntry.config_value;
    }
    
    throw new Error('Javelin cookie not found. Please configure in Settings.');
  } catch (error) {
    throw error;
  }
}

// Execute Python script to refresh Javelin data
async function executePythonScript(cookie: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'refresh_javelin.py');
    
    console.log('Executing Python script:', scriptPath);
    console.log('Cookie length:', cookie.length);

    const pythonProcess = spawn('python3', [scriptPath, cookie]);

    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      outputData += output;
      console.log('Python output:', output);
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      errorData += error;
      console.error('Python error:', error);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);

      if (code === 0) {
        // Try to extract JSON result from output
        try {
          // Look for RESULT: section
          const resultMatch = outputData.match(/RESULT:\s*(\{[^]*\})/);
          if (resultMatch) {
            const result = JSON.parse(resultMatch[1]);
            resolve(result);
            return;
          }
        } catch (e) {
          console.error('Failed to parse Python result:', e);
        }

        // If no JSON found, assume success based on exit code
        resolve({
          success: true,
          message: 'Javelin data refreshed successfully',
          output: outputData,
        });
      } else {
        reject(new Error(`Python script failed with code ${code}: ${errorData || outputData}`));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(error);
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Javelin Refresh Started ===');
    
    // Get cookie from Google Sheets
    const cookie = await getJavelinCookie();
    
    if (!cookie) {
      return NextResponse.json(
        {
          error: 'Javelin cookie not configured',
          message: 'Please configure Javelin cookie in Settings first',
          needsConfiguration: true,
        },
        { status: 400 }
      );
    }

    // Execute Python script
    const result = await executePythonScript(cookie);

    console.log('=== Javelin Refresh Completed ===');

    return NextResponse.json({
      success: true,
      message: 'Javelin inventory refreshed successfully',
      rowsImported: result.rowsImported || 0,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Javelin refresh error:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isCookieError = 
      errorMessage.toLowerCase().includes('cookie not found') ||
      errorMessage.toLowerCase().includes('not configured');

    if (isCookieError) {
      return NextResponse.json(
        {
          error: 'Javelin cookie not configured',
          details: errorMessage,
          needsConfiguration: true,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to refresh Javelin data',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}