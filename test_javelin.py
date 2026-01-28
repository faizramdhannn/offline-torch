import sys
import json
import requests

def test_javelin_cookie(cookie):
    """Test if cookie works with Javelin API"""
    
    print("="*60)
    print("JAVELIN COOKIE TEST")
    print("="*60)
    
    # Step 1: Get code and verifier
    print("\n1. Getting session code...")
    try:
        code_url = f"https://torch.javelin-apps.com/sess/code?c={int(1000000000000)}"
        
        headers = {
            "accept": "application/json",
            "cookie": cookie,
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"
        }
        
        response = requests.get(code_url, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ Failed to get code: {response.text}")
            return False
            
        data = response.json()
        code = data['code']
        verifier = data['verifier']
        print(f"   ✅ Got code: {code[:20]}...")
        
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False
    
    # Step 2: Login with code
    print("\n2. Logging in...")
    try:
        login_url = "https://torch.javelin-apps.com/v2/login"
        
        headers = {
            "accept": "application/json",
            "authorization": "982394jlksjdfjkh340884lsdfjsldkfisuerwjfds823498234xpudfs",
            "content-type": "application/json",
            "cookie": cookie,
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"
        }
        
        payload = {
            "p_session_key": "",
            "p_user_id": "",
            "code": code,
            "verifier": verifier,
            "user_id": "STOCK_ADMIN",
            "password": "Welcome1",
            "app_version": "JAVELIN Web",
            "os_version": "Mac OS",
            "device_model": "Safari",
            "device_id": "1210110504",
            "wsade": "0",
            "wsade_code": "",
            "utc_offset": "420"
        }
        
        response = requests.post(login_url, headers=headers, json=payload)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ Login failed: {response.text}")
            return False
        
        login_data = response.json()
        p_user_id = login_data['p_user_id']
        p_session_key = login_data['p_session_key']
        p_session_token = login_data['p_session_token']
        
        print(f"   ✅ Login successful!")
        print(f"   User ID: {p_user_id}")
        print(f"   Session Token: {p_session_token[:30]}...")
        
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False
    
    # Step 3: Get inventory
    print("\n3. Fetching inventory...")
    try:
        inventory_url = "https://torch.javelin-apps.com/v2/inventory_list"
        
        headers = {
            "accept": "application/json",
            "authorization": p_session_token,
            "content-type": "application/json",
            "cookie": cookie,
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"
        }
        
        payload = {
            "p_session_key": p_session_key,
            "p_user_id": p_user_id,
            "p_param": {
                "client_id": "TORCH-ONLINE",
                "warehouse_id": "DP01",
                "utc_offset": 420
            }
        }
        
        response = requests.post(inventory_url, headers=headers, json=payload)
        print(f"   Status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"   ❌ Failed: {response.text}")
            return False
        
        result = response.json()
        
        # Parse data
        raw_data = result['out_record']
        parsed_data = json.loads(raw_data)
        
        print(f"   ✅ Success! Got {len(parsed_data)} inventory records")
        
        # Show sample
        if len(parsed_data) > 0:
            print(f"\n   Sample data:")
            sample = parsed_data[0]
            print(f"   - Product: {sample.get('product_id', 'N/A')}")
            print(f"   - Description: {sample.get('description_1', 'N/A')}")
            print(f"   - Qty: {sample.get('base_qty', 'N/A')}")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "="*60)

if __name__ == "__main__":
    print("\nJAVELIN COOKIE TESTER")
    print("="*60)
    
    if len(sys.argv) < 2:
        print("\n❌ Usage: python3 test_javelin.py \"your_cookie_here\"")
        print("\nExample:")
        print("python3 test_javelin.py \"sess=MTc2OTYwOTgxOXxOd3dBTkZW...\"")
        sys.exit(1)
    
    cookie = sys.argv[1]
    
    print(f"\nCookie: {cookie[:50]}...")
    print(f"Length: {len(cookie)} characters")
    
    # Check if cookie has sess=
    if not cookie.startswith("sess=") and not "sess=" in cookie:
        print("\n⚠️  WARNING: Cookie might be incomplete!")
        print("   Expected format: sess=MTc2OTYw...")
        print("\n   Trying anyway...")
    
    print("\n" + "="*60)
    
    success = test_javelin_cookie(cookie)
    
    print("\n" + "="*60)
    if success:
        print("✅ ALL TESTS PASSED!")
        print("Cookie is working correctly.")
        print("\nYou can use this cookie in Settings.")
    else:
        print("❌ TESTS FAILED!")
        print("\nPossible issues:")
        print("1. Cookie expired - Get fresh cookie from browser")
        print("2. Cookie format wrong - Make sure you copy full value")
        print("3. Network issue - Check internet connection")
        print("4. Credentials wrong - Verify STOCK_ADMIN/Welcome1")
    print("="*60)
    
    sys.exit(0 if success else 1)