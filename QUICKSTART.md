# Quick Start Guide - Offline Torch

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 20+ installed
- Google account
- Basic knowledge of Google Sheets and Google Cloud

### Step 1: Clone & Install (1 min)
```bash
cd offline-torch-fixed
npm install
```

### Step 2: Google Cloud Setup (2 min)
1. Go to https://console.cloud.google.com/
2. Create project → Enable Google Sheets API + Google Drive API
3. Create Service Account → Download JSON key
4. Copy `.env.local.example` to `.env.local`
5. Paste JSON content into `GOOGLE_SHEETS_CREDENTIALS`

### Step 3: Google Sheets Setup (1 min)
1. Create Google Sheet
2. Share with service account email (from JSON)
3. Create these tabs: `users`, `registration_request`, `order_report`, `petty_cash`, `master_dropdown`, `powerbiz_salesorder`, `delivery_note`, `sales_invoice`
4. Copy Sheet ID from URL
5. Update `SPREADSHEET_ID` in `lib/sheets.ts`

### Step 4: Google Drive Setup (30 sec)
1. Create folder in Google Drive
2. Share with service account email
3. Copy Folder ID from URL
4. Update `FOLDER_ID` in `lib/drive.ts`

### Step 5: Create Admin User (30 sec)
In Google Sheets `users` tab, add:
```
id: 1
name: Admin
user_name: admin
password: $2a$10$[BCRYPT_HASH_OF_YOUR_PASSWORD]
dashboard: TRUE
order_report: TRUE
stock: TRUE
registration_request: TRUE
user_setting: TRUE
petty_cash: TRUE
last_activity: 2026-01-21T00:00:00Z
```

Generate password hash:
```bash
node -e "require('bcryptjs').hash('admin123', 10).then(console.log)"
```

### Step 6: Run! (10 sec)
```bash
npm run dev
```

Visit http://localhost:3000 and login with:
- Username: `admin`
- Password: `admin123` (or whatever you set)

## 🎯 First Actions

### For Admin
1. **Test Login** → Should see Dashboard
2. **Create Test User** → Logout → Click "Daftar disini"
3. **Approve User** → Login as admin → Registration Requests → Approve with permissions
4. **Add Petty Cash** → Petty Cash → Add Entry → Upload receipt
5. **Test Exports** → Export to Excel and DOC

### For Regular User
1. **Register** → Fill form → Wait for approval
2. **Login** → After approval
3. **View Order Reports** → If permission granted
4. **Add Petty Cash** → If permission granted

## 📝 Daily Usage

### Adding Petty Cash Entry
1. Petty Cash → Add Entry
2. Fill: Description, Category, Value
3. Upload receipt (optional)
4. Check "Transfer" if applicable
5. Submit

### Viewing Reports
1. Order Report or Petty Cash
2. Set filters (date, category, store)
3. Click "Apply Filter"
4. Export to Excel or DOC if needed

### Approving Users
1. Registration Requests
2. Click "Approve" on pending request
3. Select permissions
4. User can now login

## 🔑 Default Permissions

**Admin** (registration_request = TRUE):
- ✅ All features
- ✅ Can export DOC
- ✅ Can approve users

**Regular User**:
- ✅ Features based on assigned permissions
- ✅ Can export Excel
- ❌ Cannot export DOC
- ❌ Cannot approve users

## 🐛 Troubleshooting

**Can't login?**
- Check password is bcrypt hashed in sheet
- Verify user exists in `users` tab

**Import not working?**
- Check file format (CSV or XLSX)
- Verify headers match expected columns

**File upload fails?**
- Check Google Drive folder is shared with service account
- Verify FOLDER_ID is correct in lib/drive.ts

**DOC export fails?**
- Only users with registration_request=TRUE can export DOC
- Check Google Drive API is enabled
- Verify file URLs are accessible

## 📚 Learn More

- **Full Setup**: See `SETUP_GUIDE.md`
- **All Changes**: See `CHANGELOG.md`
- **Features**: See `README.md`

## 🆘 Need Help?

1. Check error message in browser console (F12)
2. Check Next.js terminal output
3. Verify Google Cloud Console for API errors
4. Review Google Sheets for data issues

## 🎉 You're Ready!

Your Offline Torch system is now set up. Start managing your:
- 📦 Orders
- 💰 Petty Cash
- 👥 Users
- 📊 Reports

Happy managing! 🚀
