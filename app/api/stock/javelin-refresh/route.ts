import { NextRequest, NextResponse } from 'next/server';
import { getSheetData, updateSheetRow, appendSheetData } from '@/lib/sheets';
import { refreshJavelinInventory } from '@/lib/javelin';

// Function to get Javelin cookie from Google Sheets
async function getJavelinCookie(): Promise<string | null> {
  try {
    console.log('🔍 Getting Javelin cookie from Google Sheets...');
    const data = await getSheetData('system_config');
    
    console.log(`📊 Found ${data.length} rows in system_config`);
    
    const cookieEntry = data.find((row: any) => {
      const key = row.config_key || row.Config_key || row['config_key'] || '';
      return key === 'javelin_cookie';
    });
    
    if (!cookieEntry) {
      console.log('❌ javelin_cookie entry not found!');
      return null;
    }
    
    const cookieValue = cookieEntry.config_value || cookieEntry.Config_value || cookieEntry['config_value'] || '';
    console.log(`✅ Found cookie (length: ${cookieValue.length})`);
    
    if (!cookieValue || cookieValue.trim() === '') {
      console.log('⚠️  Cookie value is empty!');
      return null;
    }
    
    return cookieValue;
  } catch (error) {
    console.error('❌ Error getting cookie:', error);
    return null;
  }
}

// Function to get Javelin credentials from Google Sheets (OPTIONAL)
async function getJavelinCredentials(): Promise<{ username: string; password: string } | null> {
  try {
    console.log('🔍 Getting Javelin credentials from Google Sheets...');
    const data = await getSheetData('system_config');
    
    const credEntry = data.find((row: any) => {
      const key = row.config_key || row.Config_key || row['config_key'] || '';
      return key === 'javelin_credentials';
    });
    
    if (credEntry) {
      const credValue = credEntry.config_value || credEntry.Config_value || credEntry['config_value'] || '';
      
      if (credValue) {
        try {
          const parsed = JSON.parse(credValue);
          console.log(`✅ Found credentials for user: ${parsed.username}`);
          return parsed;
        } catch (e) {
          console.error('❌ Failed to parse credentials JSON:', e);
        }
      }
    }
    
    console.log('⚠️  No credentials found');
    return null;
  } catch (error) {
    console.error('❌ Error getting credentials:', error);
    return null;
  }
}

// Function to get fresh cookie by logging in (OPTIONAL - if credentials available)
async function getNewCookie(username: string, password: string): Promise<string> {
  try {
    // First get code and verifier
    const codeUrl = `https://torch.javelin-apps.com/sess/code?c=${Date.now()}`;
    const codeResponse = await fetch(codeUrl, {
      headers: {
        "accept": "application/json",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    if (!codeResponse.ok) {
      throw new Error('Failed to get code');
    }
    
    const codeData = await codeResponse.json();
    
    // Now login
    const loginResponse = await fetch("https://torch.javelin-apps.com/v2/login", {
      method: 'POST',
      headers: {
        "accept": "application/json",
        "authorization": "982394jlksjdfjkh340884lsdfjsldkfisuerwjfds823498234xpudfs",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      body: JSON.stringify({
        "p_session_key": "",
        "p_user_id": "",
        "code": codeData.code,
        "verifier": codeData.verifier,
        "user_id": username,
        "password": password,
        "app_version": "JAVELIN Web",
        "os_version": "Windows 10",
        "device_model": "Chrome 126.0.0.0",
        "device_id": "1210110504",
        "wsade": "0",
        "wsade_code": "",
        "utc_offset": "420"
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error('Login failed');
    }
    
    // Extract cookie from response headers
    const setCookie = loginResponse.headers.get('set-cookie');
    if (!setCookie) {
      throw new Error('No cookie in response');
    }
    
    return setCookie;
  } catch (error) {
    console.error('Error getting new cookie:', error);
    throw error;
  }
}

// Function to save cookie to Google Sheets
async function saveCookie(cookie: string, username: string): Promise<void> {
  try {
    const data = await getSheetData('system_config');
    const cookieIndex = data.findIndex((row: any) => {
      const key = row.config_key || row.Config_key || row['config_key'] || '';
      return key === 'javelin_cookie';
    });
    
    const now = new Date();
    const timestamp = now.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta'
    });

    if (cookieIndex !== -1) {
      const rowIndex = cookieIndex + 2;
      const updatedRow = ['javelin_cookie', cookie, username, timestamp];
      await updateSheetRow('system_config', rowIndex, updatedRow);
    } else {
      const newRow = ['javelin_cookie', cookie, username, timestamp];
      await appendSheetData('system_config', [newRow]);
    }
  } catch (error) {
    console.error('Error saving cookie:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Javelin Refresh Started ===');
    console.log('Timestamp:', new Date().toISOString());
    
    // Step 1: Try to get existing cookie
    let cookie = await getJavelinCookie();
    let cookieSource = 'existing';
    
    console.log(`Cookie status: ${cookie ? 'Found' : 'Not found'}`);
    
    // Step 2: If no cookie, try to get credentials and login
    if (!cookie) {
      console.log('No cookie found, checking for credentials...');
      const credentials = await getJavelinCredentials();
      
      if (credentials && credentials.username && credentials.password) {
        console.log('Credentials found, attempting auto-login...');
        try {
          cookie = await getNewCookie(credentials.username, credentials.password);
          await saveCookie(cookie, 'system');
          cookieSource = 'auto-login';
          console.log('✅ New cookie obtained via auto-login');
        } catch (error) {
          console.error('❌ Auto-login failed:', error);
          return NextResponse.json(
            {
              error: 'Failed to auto-login to Javelin',
              message: 'Please check credentials or configure cookie manually in Settings.',
              needsConfiguration: true,
              debug: {
                hasCredentials: true,
                autoLoginError: error instanceof Error ? error.message : String(error)
              }
            },
            { status: 400 }
          );
        }
      } else {
        // No cookie and no credentials
        return NextResponse.json(
          {
            error: 'Javelin not configured',
            message: 'Please configure either:\n1. Manual cookie in Settings, OR\n2. Username & Password for auto-login',
            needsConfiguration: true,
            debug: {
              hasCredentials: false,
              hasCookie: false
            }
          },
          { status: 400 }
        );
      }
    }
    
    // Step 3: Try to execute with current cookie
    try {
      console.log(`Attempting to refresh data with ${cookieSource} cookie...`);
      const result = await refreshJavelinInventory(cookie!);
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      console.log('=== Javelin Refresh Completed ===');
      
      return NextResponse.json({
        success: true,
        message: cookieSource === 'auto-login'
          ? 'Javelin inventory refreshed successfully (auto-login)' 
          : 'Javelin inventory refreshed successfully',
        rowsImported: result.rows || 0,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error: any) {
      console.log('First attempt failed, checking if we can retry with fresh cookie...');
      
      // Step 4: If failed and we have credentials, try to get new cookie and retry
      const credentials = await getJavelinCredentials();
      
      if (credentials && credentials.username && credentials.password) {
        try {
          console.log('Obtaining fresh cookie for retry...');
          cookie = await getNewCookie(credentials.username, credentials.password);
          await saveCookie(cookie, 'system');
          console.log('New cookie obtained, retrying...');
          
          const result = await refreshJavelinInventory(cookie);
          
          if (!result.success) {
            throw new Error(result.message);
          }
          
          console.log('=== Javelin Refresh Completed (after retry) ===');
          
          return NextResponse.json({
            success: true,
            message: 'Javelin inventory refreshed successfully (after re-login)',
            rowsImported: result.rows || 0,
            timestamp: new Date().toISOString(),
          });
          
        } catch (retryError: any) {
          console.error('Retry also failed:', retryError);
          
          return NextResponse.json(
            {
              error: 'Failed to refresh Javelin data',
              details: retryError instanceof Error ? retryError.message : String(retryError),
              hint: 'Cookie may have expired. Please update cookie manually in Settings.',
            },
            { status: 500 }
          );
        }
      } else {
        // Failed and no credentials for retry
        return NextResponse.json(
          {
            error: 'Failed to refresh Javelin data',
            details: error instanceof Error ? error.message : String(error),
            hint: 'Cookie may have expired. Please update cookie manually in Settings or configure auto-login credentials.',
          },
          { status: 500 }
        );
      }
    }

  } catch (error: any) {
    console.error('Javelin refresh error:', error);

    return NextResponse.json(
      {
        error: 'Failed to refresh Javelin data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}