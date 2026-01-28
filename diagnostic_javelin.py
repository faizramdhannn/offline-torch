#!/usr/bin/env python3
"""
Diagnostic script to check Javelin setup in Offline Torch
"""

import os
import sys
import json
from pathlib import Path

def check_python_packages():
    """Check if required Python packages are installed"""
    print("\n📦 Checking Python Packages...")
    print("-" * 60)
    
    required = ['requests', 'pandas', 'gspread', 'pytz']
    missing = []
    
    for package in required:
        try:
            __import__(package)
            print(f"   ✅ {package:15} - Installed")
        except ImportError:
            print(f"   ❌ {package:15} - NOT INSTALLED")
            missing.append(package)
    
    if missing:
        print(f"\n⚠️  Missing packages: {', '.join(missing)}")
        print("   Install with:")
        print(f"   pip3 install {' '.join(missing)}")
        return False
    
    return True

def check_service_account():
    """Check if service_account.json exists"""
    print("\n🔑 Checking Service Account...")
    print("-" * 60)
    
    project_root = Path(__file__).resolve().parent
    service_account_path = project_root / 'service_account.json'
    
    if service_account_path.exists():
        print(f"   ✅ Found: {service_account_path}")
        
        # Try to read and validate
        try:
            with open(service_account_path, 'r') as f:
                data = json.load(f)
                
            required_keys = ['client_email', 'private_key', 'project_id']
            missing_keys = [key for key in required_keys if key not in data]
            
            if missing_keys:
                print(f"   ⚠️  Missing keys: {', '.join(missing_keys)}")
                return False
            else:
                print(f"   ✅ Valid service account")
                print(f"   Email: {data['client_email']}")
                return True
                
        except Exception as e:
            print(f"   ❌ Invalid JSON: {str(e)}")
            return False
    else:
        print(f"   ❌ NOT FOUND: {service_account_path}")
        print("   Please add service_account.json to project root")
        return False

def check_env_vars():
    """Check if environment variables are set"""
    print("\n🌍 Checking Environment Variables...")
    print("-" * 60)
    
    required_vars = [
        'GOOGLE_CREDENTIALS',
        'SPREADSHEET_STOCK',
        'SPREADSHEET_USERS',
    ]
    
    missing = []
    
    for var in required_vars:
        value = os.environ.get(var)
        if value:
            # Mask sensitive data
            display_value = value[:20] + "..." if len(value) > 20 else value
            print(f"   ✅ {var:25} - Set ({display_value})")
        else:
            print(f"   ❌ {var:25} - NOT SET")
            missing.append(var)
    
    if missing:
        print(f"\n⚠️  Missing environment variables")
        print("   Add to .env.local or environment")
        return False
    
    return True

def check_python_script():
    """Check if refresh_javelin.py exists"""
    print("\n📄 Checking Python Scripts...")
    print("-" * 60)
    
    project_root = Path(__file__).resolve().parent.parent
    script_path = project_root / 'scripts' / 'refresh_javelin.py'
    
    if script_path.exists():
        print(f"   ✅ Found: {script_path}")
        
        # Check if executable
        if os.access(script_path, os.X_OK):
            print(f"   ✅ Executable permissions OK")
        else:
            print(f"   ⚠️  Not executable (may be OK)")
        
        return True
    else:
        print(f"   ❌ NOT FOUND: {script_path}")
        print("   Please ensure refresh_javelin.py exists in scripts/")
        return False

def check_google_sheets():
    """Check if can connect to Google Sheets"""
    print("\n📊 Checking Google Sheets Connection...")
    print("-" * 60)
    
    try:
        import gspread
        
        # Check for credentials
        creds_env = os.environ.get('GOOGLE_CREDENTIALS')
        if not creds_env:
            print("   ❌ GOOGLE_CREDENTIALS not set")
            return False
        
        credentials = json.loads(creds_env)
        
        gc = gspread.service_account_from_dict(credentials)
        print("   ✅ Successfully authenticated with Google")
        
        # Try to open spreadsheet
        spreadsheet_id = os.environ.get('SPREADSHEET_STOCK')
        if spreadsheet_id:
            try:
                sh = gc.open_by_key(spreadsheet_id)
                print(f"   ✅ Can access spreadsheet: {sh.title}")
                
                # Check for system_config sheet
                try:
                    wks = sh.worksheet('system_config')
                    print(f"   ✅ Found 'system_config' sheet")
                    
                    # Check for javelin_cookie
                    data = wks.get_all_values()
                    if len(data) > 1:
                        headers = data[0]
                        if 'config_key' in headers:
                            print(f"   ✅ Sheet has correct structure")
                            
                            # Look for javelin_cookie
                            found_cookie = False
                            found_creds = False
                            
                            for row in data[1:]:
                                if len(row) > 0:
                                    if row[0] == 'javelin_cookie':
                                        found_cookie = True
                                        cookie_value = row[1] if len(row) > 1 else ''
                                        if cookie_value:
                                            print(f"   ✅ javelin_cookie found (length: {len(cookie_value)})")
                                        else:
                                            print(f"   ⚠️  javelin_cookie exists but EMPTY")
                                    
                                    if row[0] == 'javelin_credentials':
                                        found_creds = True
                                        creds_value = row[1] if len(row) > 1 else ''
                                        if creds_value:
                                            print(f"   ✅ javelin_credentials found")
                                        else:
                                            print(f"   ⚠️  javelin_credentials exists but EMPTY")
                            
                            if not found_cookie and not found_creds:
                                print(f"   ❌ No javelin_cookie or javelin_credentials found!")
                                print(f"   → Add cookie in Settings first")
                                return False
                        else:
                            print(f"   ❌ Missing 'config_key' column")
                            return False
                    else:
                        print(f"   ⚠️  Sheet is empty (no data)")
                        return False
                        
                except gspread.WorksheetNotFound:
                    print(f"   ❌ 'system_config' sheet NOT FOUND")
                    print(f"   → Create 'system_config' sheet with columns:")
                    print(f"      config_key | config_value | updated_by | updated_at")
                    return False
                    
            except Exception as e:
                print(f"   ❌ Cannot access spreadsheet: {str(e)}")
                return False
        else:
            print("   ⚠️  SPREADSHEET_STOCK not set, skipping spreadsheet check")
        
        return True
        
    except ImportError:
        print("   ❌ gspread not installed")
        return False
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False

def main():
    print("="*60)
    print("OFFLINE TORCH - JAVELIN SETUP DIAGNOSTIC")
    print("="*60)
    
    checks = [
        ("Python Packages", check_python_packages),
        ("Service Account", check_service_account),
        ("Environment Variables", check_env_vars),
        ("Python Scripts", check_python_script),
        ("Google Sheets", check_google_sheets),
    ]
    
    results = {}
    
    for name, check_func in checks:
        try:
            results[name] = check_func()
        except Exception as e:
            print(f"\n❌ Error checking {name}: {str(e)}")
            results[name] = False
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {status:12} - {name}")
    
    print(f"\n   Score: {passed}/{total} checks passed")
    
    if passed == total:
        print("\n✅ ALL CHECKS PASSED!")
        print("   System is ready for Javelin refresh.")
    else:
        print(f"\n❌ {total - passed} CHECK(S) FAILED!")
        print("   Please fix the issues above before using Javelin refresh.")
    
    print("="*60)
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)