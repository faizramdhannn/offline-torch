# Offline Torch - Stock Management System

Next.js application with Google Sheets and Google Drive integration for managing stock, orders, petty cash, and user access.

## Features

### Authentication & User Management
- User authentication with bcrypt password hashing
- User registration with approval workflow
- Role-based permissions (Dashboard, Order Report, Stock, Petty Cash, Registration Request, User Settings)
- Registration request management with permission assignment

### Order Report
- View and filter order reports
- Date range filtering
- Multi-select status filtering with checkboxes
- Pagination (20 items per page)
- Excel export
- Import functionality for:
  - PowerBiz Sales Orders
  - Delivery Notes
  - Sales Invoices
- Automatic handling of null values (displayed as red "-")

### Petty Cash Management
- Add petty cash entries with automatic ID generation
- Upload receipts to Google Drive (JPG, PNG, PDF)
- Multi-filter: Date range, Category, Store (multi-select checkboxes)
- Pagination (20 items per page)
- Two export options:
  - **Excel Export**: Filtered data in spreadsheet format
  - **DOC Export**: Professional document with:
    - Header: "Petty Cash (username)" and date range
    - Table with: Date, Description (Title Case), Value, Photo
    - Embedded photos from Google Drive
    - Total value at the end
    - A4 format with normal margins
    - Multiple pages if needed
- Automatic store assignment (locked to logged-in user)
- Transfer checkbox
- Total value calculation

### Stock Management
- Placeholder for future implementation

## Setup

### 1. Install dependencies:
```bash
npm install
```

### 2. Configure Google Sheets API:
- Create a Google Cloud project
- Enable Google Sheets API and Google Drive API
- Create a service account and download credentials
- Share your Google Sheet with the service account email
- Copy `.env.local.example` to `.env.local`
- Add your credentials to `.env.local`:

```env
GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

### 3. Google Sheet Structure:

**Sheet: users**
```
Columns: id, name, user_name, password, dashboard, order_report, stock, registration_request, user_setting, petty_cash, last_activity
```

**Sheet: registration_request**
```
Columns: id, name, user_name, password, status, request_at
```

**Sheet: order_report**
```
Columns: order_date, sales_order, warehouse, status, sales_channel, payment_method, value_amount, delivery_note, sales_invoice
```

**Sheet: powerbiz_salesorder** (for import)
**Sheet: delivery_note** (for import)
**Sheet: sales_invoice** (for import)

**Sheet: petty_cash**
```
Columns: id, date, description, category, value, store, ket, transfer, link_url, created_at, update_at
```

**Sheet: master_dropdown**
```
Columns: category_petty_cash, (other columns as needed)
```

### 4. Google Drive Setup:
- Create a folder in Google Drive for petty cash receipts
- Share the folder with your service account email
- Copy the folder ID from the URL (after `/folders/`)
- Update `FOLDER_ID` in `lib/drive.ts` with your folder ID

### 5. Run development server:
```bash
npm run dev
```

### 6. Open http://localhost:3000

## Usage

### First Time Setup
1. Create initial admin user directly in Google Sheets (users sheet)
2. Use bcrypt to hash the password before adding to sheet
3. Set all permissions to TRUE for admin user

### Registration Flow
1. New users click "Belum punya akun? Daftar disini" on login page
2. Fill in Name, Username, and Password (min 6 characters)
3. Request is sent with bcrypt-hashed password
4. Admin approves in "Registration Requests" page
5. Admin selects which features the user can access
6. User can now login with their credentials

### Order Report
- Filter by date range and/or multiple statuses
- Click "Import" to upload PowerBiz, Delivery Notes, or Sales Invoices
- Click "Export to Excel" to download filtered data
- Pagination shows 20 items per page

### Petty Cash
- Click "Add Entry" to create new petty cash entry
- Fill in description, category, value (auto-formatted to Rupiah)
- Store is automatically set to logged-in username (locked)
- Upload receipt (optional) - file is automatically uploaded to Google Drive
- Use filters to view specific date ranges, categories, or stores
- Export to Excel for spreadsheet format
- Export to DOC for professional document with embedded images (requires registration_request permission)

## Color Scheme

- Primary: #0d334d (Dark Blue)
- Secondary: #afcc3c (Yellow-Green)

## Tech Stack

- Next.js 15
- TypeScript
- Tailwind CSS
- Google Sheets API
- Google Drive API
- BCrypt.js (password hashing)
- PapaParse (CSV parsing)
- XLSX (Excel parsing & generation)
- docx (Word document generation)

## File Upload & Storage

- Petty cash receipts are uploaded to Google Drive
- Files are renamed with format: `date_category_store_id.ext`
- Files are made publicly viewable (read-only)
- Direct view links are stored in Google Sheets

## Security Notes

- All passwords are hashed with bcrypt (10 rounds)
- Service account credentials are stored in environment variables
- Google Drive files are set to "anyone with link can view" (read-only)
- Role-based access control for all features
- Session data stored in localStorage (client-side)

## Permissions System

Each user can be granted access to:
- **Dashboard**: Home page access
- **Order Report**: View and manage order reports
- **Stock**: Access stock management (future feature)
- **Petty Cash**: Add and view petty cash entries
- **Registration Request**: Approve new users (also enables DOC export in Petty Cash)
- **User Settings**: Manage user settings

## Future Enhancements

- OCR for receipt validation (validate amount matches uploaded receipt)
- Stock management functionality
- User activity tracking
- Audit logs
- Advanced reporting
- Mobile app version
