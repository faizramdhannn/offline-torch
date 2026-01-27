import os
import sys
import json
import requests
import pandas as pd
import gspread
from pathlib import Path
from datetime import datetime

# Setup paths
project_root = Path(__file__).resolve().parent
sys.path.append(str(project_root))

def get_google_credentials():
    """Get Google credentials from service account file"""
    creds_path = project_root / 'service_account.json'
    if not creds_path.exists():
        raise Exception(f"service_account.json not found at {creds_path}")
    return str(creds_path)

def get_javelin_authentication(cookie):
    """Authenticate with Javelin API and get session tokens"""
    try:
        # Step 1: Get code and verifier
        url = f"https://torch.javelin-apps.com/sess/code?c={int(datetime.now().timestamp() * 1000)}"
        
        headers = {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9",
            "cookie": cookie,
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "x-requested-with": "XMLHttpRequest"
        }
        
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        code = data['code']
        verifier = data['verifier']
        
        # Step 2: Login to get session tokens
        url = "https://torch.javelin-apps.com/v2/login"
        
        headers = {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9",
            "authorization": "982394jlksjdfjkh340884lsdfjsldkfisuerwjfds823498234xpudfs",
            "content-type": "application/json",
            "cookie": cookie,
            "origin": "https://torch.javelin-apps.com",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "x-requested-with": "XMLHttpRequest"
        }
        
        payload = {
            "p_session_key": "",
            "p_user_id": "",
            "code": code,
            "verifier": verifier,
            "user_id": "STOCK_ADMIN",
            "password": "Welcome1",
            "app_version": "JAVELIN Web",
            "os_version": "Windows 10",
            "device_model": "Chrome 126.0.0.0",
            "device_id": "1210110504",
            "wsade": "0",
            "wsade_code": "",
            "utc_offset": "420"
        }
        
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        data = response.json()
        
        return {
            'p_user_id': data['p_user_id'],
            'p_session_key': data['p_session_key'],
            'p_session_token': data['p_session_token']
        }
        
    except Exception as e:
        print(f"Authentication error: {str(e)}")
        raise

def get_javelin_inventory(cookie):
    """Fetch inventory data from Javelin API"""
    try:
        auth = get_javelin_authentication(cookie)
        
        url = "https://torch.javelin-apps.com/v2/inventory_list"
        
        headers = {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "accept-language": "en-US,en;q=0.9",
            "authorization": auth['p_session_token'],
            "content-type": "application/json",
            "cookie": cookie,
            "origin": "https://torch.javelin-apps.com",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
            "x-requested-with": "XMLHttpRequest"
        }
        
        payload = {
            "p_session_key": auth['p_session_key'],
            "p_user_id": auth['p_user_id'],
            "p_param": {
                "client_id": "TORCH-ONLINE",
                "warehouse_id": "DP01",
                "utc_offset": 420
            }
        }
        
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        
        # Parse the out_record JSON string
        raw_data = data['out_record']
        parsed_data = json.loads(raw_data)
        
        return parsed_data
        
    except Exception as e:
        print(f"Fetch inventory error: {str(e)}")
        raise

def filter_inventory_data(data):
    """Filter inventory data for PCA stock"""
    df = pd.DataFrame(data)
    
    # Filter for location types: BULK, CAB, PICK, RECV
    # Filter for stock type: AV (Available)
    filtered_df = df[
        df['location_type'].fillna('').str.upper().isin(['BULK', 'CAB', 'PICK', 'RECV']) &
        (df['stock_type'].fillna('').str.upper() == 'AV')
    ]
    
    return filtered_df

def convert_timestamp(timestamp):
    """Convert Unix timestamp to datetime string"""
    if pd.isna(timestamp) or timestamp == '' or timestamp == '0':
        return ''
    try:
        return pd.to_datetime(int(timestamp), unit='s').strftime('%Y-%m-%d %H:%M:%S')
    except:
        return ''

def format_for_sheets(df):
    """Format dataframe for Google Sheets"""
    # Define column mapping (Javelin field -> Sheet header)
    column_mapping = {
        'warehouse_id': 'Warehouse ID',
        'location_type': 'Location Type',
        'location_id': 'Location ID',
        'client_id': 'Client ID',
        'product_id': 'Product ID',
        'description_1': 'Description',
        'pack_id': 'Pack ID',
        'batch': 'Batch',
        'expired_date': 'Expired Date',
        'base_qty': 'Base Qty',
        'base_uom': 'Base Uom',
        'stock_type': 'Stock Type',
        'pick_qty': 'Pick Qty',
        'put_qty': 'Put Qty',
        'aval_qty': 'Aval Qty',
        'storage_unit': 'Storage Unit',
        'last_movement_id': 'Last Movement ID',
        'posting_date': 'Posting Date',
        'product_group': 'Product Group',
        'product_type': 'Product Type',
        'product_section': 'Product Section',
        'aging_posting': 'Aging Posting',
        'aging_expiry': 'Aging Expiry',
        'gross_weight': 'Gross Weight (KG)',
        'volume': 'Volume (M3)',
        'update_by': 'Update By',
        'update_time': 'Update Time'
    }
    
    # Create new dataframe with mapped columns
    formatted_df = pd.DataFrame()
    
    for original_col, sheet_col in column_mapping.items():
        if original_col in df.columns:
            formatted_df[sheet_col] = df[original_col]
        else:
            formatted_df[sheet_col] = ''
    
    # Convert timestamp columns
    timestamp_cols = ['Expired Date', 'Last Movement ID', 'Posting Date', 'Update Time']
    for col in timestamp_cols:
        if col in formatted_df.columns:
            formatted_df[col] = formatted_df[col].apply(convert_timestamp)
    
    # Fill NaN with empty string
    formatted_df = formatted_df.fillna('')
    
    return formatted_df

def update_google_sheet(df, sheet_name='javelin'):
    """Update Google Sheet with new data"""
    try:
        gc = gspread.service_account(filename=get_google_credentials())
        
        # Open spreadsheet - adjust this to your spreadsheet name/ID
        spreadsheet_id = os.environ.get('SPREADSHEET_STOCK')
        if not spreadsheet_id:
            raise Exception("SPREADSHEET_STOCK environment variable not set")
        
        sh = gc.open_by_key(spreadsheet_id)
        
        # Get or create worksheet
        try:
            wks = sh.worksheet(sheet_name)
        except:
            wks = sh.add_worksheet(title=sheet_name, rows=1000, cols=30)
        
        # Clear existing data
        wks.clear()
        
        # Prepare data with header
        values = [df.columns.tolist()] + df.values.tolist()
        
        # Update sheet
        wks.update(values, value_input_option='RAW')
        
        print(f"Successfully updated {len(df)} rows to sheet '{sheet_name}'")
        return len(df)
        
    except Exception as e:
        print(f"Error updating Google Sheet: {str(e)}")
        raise

def update_last_update_sheet():
    """Update last_update sheet with current timestamp"""
    try:
        gc = gspread.service_account(filename=get_google_credentials())
        
        spreadsheet_id = os.environ.get('SPREADSHEET_STOCK')
        sh = gc.open_by_key(spreadsheet_id)
        
        # Get or create last_update worksheet
        try:
            wks = sh.worksheet('last_update')
        except:
            wks = sh.add_worksheet(title='last_update', rows=10, cols=2)
        
        # Get current data
        try:
            existing_data = wks.get_all_values()
            if len(existing_data) > 1:
                # Keep header and existing rows
                data_dict = {row[0]: row[1] for row in existing_data[1:] if len(row) >= 2}
            else:
                data_dict = {}
        except:
            data_dict = {}
        
        # Update Javelin timestamp
        now = datetime.now()
        date_str = now.strftime('%d %b %Y, %H:%M')
        data_dict['Javelin'] = date_str
        
        # Ensure ERP exists
        if 'ERP' not in data_dict:
            data_dict['ERP'] = '-'
        
        # Prepare data for update
        values = [['type', 'last_update']]
        for type_name in ['ERP', 'Javelin']:
            values.append([type_name, data_dict.get(type_name, '-')])
        
        # Clear and update
        wks.clear()
        wks.update(values, value_input_option='RAW')
        
        print(f"Updated last_update sheet with timestamp: {date_str}")
        
    except Exception as e:
        print(f"Error updating last_update sheet: {str(e)}")
        # Don't raise - this is not critical

def main(cookie):
    """Main function to refresh Javelin inventory"""
    try:
        print("Starting Javelin inventory refresh...")
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Step 1: Fetch data from Javelin
        print("\n1. Fetching data from Javelin API...")
        raw_data = get_javelin_inventory(cookie)
        print(f"   Retrieved {len(raw_data)} raw inventory records")
        
        # Step 2: Filter data
        print("\n2. Filtering data (BULK, CAB, PICK, RECV + AV only)...")
        filtered_df = filter_inventory_data(raw_data)
        print(f"   Filtered to {len(filtered_df)} records")
        
        if len(filtered_df) == 0:
            print("   WARNING: No data matches filter criteria!")
            return {'success': False, 'message': 'No data matches filter criteria', 'rows': 0}
        
        # Step 3: Format for sheets
        print("\n3. Formatting data for Google Sheets...")
        formatted_df = format_for_sheets(filtered_df)
        print(f"   Formatted {len(formatted_df)} rows with {len(formatted_df.columns)} columns")
        
        # Step 4: Update Google Sheet
        print("\n4. Updating Google Sheet...")
        rows_updated = update_google_sheet(formatted_df, sheet_name='javelin')
        
        # Step 5: Update last_update sheet
        print("\n5. Updating last_update sheet...")
        update_last_update_sheet()
        
        print("\n✅ SUCCESS!")
        print(f"   Total rows imported: {rows_updated}")
        
        return {
            'success': True,
            'message': 'Javelin inventory refreshed successfully',
            'rows': rows_updated
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"\n❌ ERROR: {error_msg}")
        return {
            'success': False,
            'message': error_msg,
            'rows': 0
        }

if __name__ == "__main__":
    # Get cookie from command line argument or environment variable
    cookie = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('JAVELIN_COOKIE', '')
    
    if not cookie:
        print("❌ ERROR: Cookie not provided")
        print("Usage: python refresh_javelin.py <cookie>")
        print("Or set JAVELIN_COOKIE environment variable")
        sys.exit(1)
    
    result = main(cookie)
    
    # Print result as JSON for API to parse
    print("\n" + "="*50)
    print("RESULT:")
    print(json.dumps(result))
    print("="*50)
    
    sys.exit(0 if result['success'] else 1)