# Offline Torch - Setup Guide

## Detailed Setup Instructions

### 1. Google Cloud Project Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google Sheets API
   - Google Drive API

### 2. Service Account Creation

1. In Google Cloud Console, go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Give it a name (e.g., "offline-torch-service")
4. Click "Create and Continue"
5. Grant role: "Editor" (or more restrictive custom role)
6. Click "Done"
7. Click on the service account email
8. Go to "Keys" tab
9. Click "Add Key" > "Create new key"
10. Select "JSON" format
11. Download the JSON file

### 3. Google Sheets Setup

1. Create a new Google Sheet or use existing one
2. Note the Sheet ID from the URL: 
   `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
3. Share the sheet with your service account email (found in the JSON file)
   - Give "Editor" permission
4. Create the following sheets (tabs):
   - `users`
   - `registration_request`
   - `order_report`
   - `powerbiz_salesorder`
   - `delivery_note`
   - `sales_invoice`
   - `petty_cash`
   - `master_dropdown`

#### Sheet Structure Details

**users sheet:**
```
| id | name | user_name | password | dashboard | order_report | stock | registration_request | user_setting | petty_cash | last_activity |
```

**registration_request sheet:**
```
| id | name | user_name | password | status | request_at |
```

**order_report sheet:**
```
| order_date | sales_order | warehouse | status | sales_channel | payment_method | value_amount | delivery_note | sales_invoice |
```

**petty_cash sheet:**
```
| id | date | description | category | value | store | ket | transfer | link_url | created_at | update_at |
```

**master_dropdown sheet:**
```
| category_petty_cash |
|---------------------|
| Office Supplies     |
| Transportation      |
| Meals               |
| etc...              |
```

### 4. Google Drive Setup

1. Create a folder in Google Drive for petty cash receipts
2. Share the folder with your service account email
   - Give "Editor" permission
3. Copy the folder ID from the URL:
   `https://drive.google.com/drive/folders/{FOLDER_ID}`
4. Update `FOLDER_ID` in `lib/drive.ts` with your folder ID

### 5. Environment Variables

1. Copy `.env.local.example` to `.env.local`
2. Open the JSON file you downloaded from Google Cloud
3. Copy the entire JSON content
4. Paste it into `.env.local` as the value for `GOOGLE_SHEETS_CREDENTIALS`
   - Make sure to keep it as a single line with escaped quotes

Example:
```env
GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account","project_id":"...",...}'
```

### 6. Initial Admin User Setup

Since you can't create the first user through the app, you need to create it directly in Google Sheets:

1. Open your Google Sheet > `users` tab
2. Add a row with the following data:
   ```
   id: 1
   name: Admin
   user_name: admin
   password: [HASHED_PASSWORD]
   dashboard: TRUE
   order_report: TRUE
   stock: TRUE
   registration_request: TRUE
   user_setting: TRUE
   petty_cash: TRUE
   last_activity: [current timestamp]
   ```

To hash the password, you can use this Node.js script:
```javascript
const bcrypt = require('bcryptjs');
const password = 'your_password_here';
bcrypt.hash(password, 10).then(hash => console.log(hash));
```

Or use an online bcrypt generator with 10 rounds.

### 7. Install Dependencies and Run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` and login with your admin credentials.

### 8. Testing the Setup

1. **Test Login**: Try logging in with your admin user
2. **Test Registration**: Create a test user through the registration page
3. **Test Approval**: Approve the test user in Registration Requests
4. **Test Petty Cash**: Add a petty cash entry with file upload
5. **Test Export**: Export petty cash to both Excel and DOC formats

## Troubleshooting

### Google Sheets API Errors

- Make sure the service account email is added to the sheet with Editor permissions
- Check that the SHEET_ID in `lib/sheets.ts` matches your sheet ID
- Verify that Google Sheets API is enabled in Google Cloud Console

### Google Drive Upload Errors

- Ensure the service account email has Editor permissions on the folder
- Check that the FOLDER_ID in `lib/drive.ts` is correct
- Verify that Google Drive API is enabled in Google Cloud Console

### Password Authentication Errors

- Make sure passwords in the `users` sheet are bcrypt hashed
- Check that bcrypt rounds are set to 10 (default in the code)

### File Upload Issues

- Check file size limits (default Next.js limit is 4MB)
- Verify file types are allowed: .jpg, .jpeg, .png, .pdf
- Ensure Google Drive folder has enough storage space

## Security Best Practices

1. **Never commit .env.local to version control**
2. **Use strong passwords** (min 8 characters, mix of letters, numbers, symbols)
3. **Regularly rotate service account keys**
4. **Limit service account permissions** to only what's needed
5. **Monitor Google Drive folder** for unauthorized files
6. **Set up audit logging** in Google Cloud Console
7. **Regularly backup your Google Sheets data**

## Production Deployment

For production deployment (e.g., Vercel, Netlify):

1. Add `GOOGLE_SHEETS_CREDENTIALS` as environment variable in your hosting platform
2. Make sure to set proper CORS settings if needed
3. Enable production-grade error logging
4. Set up monitoring and alerts
5. Use a custom domain with SSL/TLS
6. Implement rate limiting for API routes
7. Set up automated backups for Google Sheets

## Support

For issues or questions, please refer to:
- README.md for general information
- This guide for setup instructions
- Google Cloud documentation for API-specific issues
