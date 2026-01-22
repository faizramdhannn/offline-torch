# Changelog - Offline Torch v0.2.0

## Major Changes

### 1. Stock Page - DIKOSONGKAN ✅
- Stock page sekarang kosong dan siap untuk implementasi future
- Removed semua fungsi import dari stock page
- File: `app/stock/page.tsx`

### 2. Order Report - Enhanced ✅

#### Import Functionality
- **Lokasi baru**: Button "Import" di samping "Export to Excel"
- **Modal popup** untuk memilih file type:
  - PowerBiz Sales Order
  - Delivery Note
  - Sales Invoice
- Support CSV dan Excel file upload
- File: `app/order-report/page.tsx`

#### Null Value Handling
- Delivery Note dan Sales Invoice kolom menampilkan "-" merah jika null
- Menggunakan conditional rendering untuk check "null" string value

#### Filter Enhancement
- **Status Filter**: Multi-select dengan checkbox (bukan dropdown)
- Bisa pilih multiple status sekaligus
- Checkbox UI yang user-friendly

#### Pagination
- **20 items per page** (bukan unlimited scroll)
- Previous/Next buttons
- Page number buttons dengan smart ellipsis
- Show "Showing X to Y of Z entries"

### 3. Login & Registration - NEW ✅

#### Registration Feature
- Link "Belum punya akun? Daftar disini" di login page
- Form registration dengan: Name, Username, Password (min 6 char)
- Password di-hash dengan bcrypt sebelum disimpan
- Success message setelah submit
- Auto-redirect ke login setelah 2 detik
- File: `app/login/page.tsx`

#### Registration Request Management
- Halaman untuk approve/reject registration requests
- **Approval Modal** dengan permission checkboxes:
  - Dashboard
  - Order Report
  - Stock
  - Petty Cash
  - Registration Request
  - User Settings
- Approve button → pilih permissions → create user
- Reject button → update status ke rejected
- File: `app/registration/page.tsx`

### 4. Petty Cash - NEW FEATURE ✅

#### Data Entry
- **Add Entry** modal dengan fields:
  - Description (free text)
  - Category (dropdown dari master_dropdown sheet)
  - Value (auto-format ke Rupiah: Rp 1.000.000)
  - Store (auto-filled, locked ke username login)
  - Keterangan (textarea, optional)
  - Transfer (checkbox → TRUE/FALSE)
  - File upload (JPG, PNG, PDF)
- **Auto-generated fields**:
  - ID: 8 digit timestamp
  - Date: Format "DD MMM YYYY"
  - File naming: `date_category_store_id.ext`
- File: `app/petty-cash/page.tsx`

#### File Upload to Google Drive
- Upload ke folder specific di Google Drive
- Auto-rename file dengan naming convention
- Generate public view link
- Store link di Google Sheets
- Files: `lib/drive.ts`, `app/api/petty-cash/route.ts`

#### Filters
- **Date Range**: Date From dan Date To
- **Category**: Multi-select checkbox (dari master_dropdown)
- **Store**: Multi-select checkbox (dari unique values)
- Apply Filter dan Reset buttons

#### Pagination
- 20 items per page
- Previous/Next navigation
- Page numbers dengan smart display

#### Export Features

**Excel Export (untuk semua user dengan petty_cash access)**
- Export filtered data ke XLSX
- Columns: Date, Description (Title Case), Category, Value, Store, Ket, Transfer, Link
- File: `app/petty-cash/page.tsx`

**DOC Export (hanya untuk user dengan registration_request = TRUE)**
- Professional document format A4
- **Header**:
  - "Petty Cash (username)"
  - Date range (if filtered)
- **Table**:
  - Date | Description (Title Case) | Value | Photo
  - Embedded photos dari Google Drive URLs
  - Dynamic rows based on filter
  - Total value di akhir
- **Pagination**: Max 10 rows per page
- Multiple pages jika data banyak
- Normal margins (1 inch all sides)
- File: `app/api/petty-cash/export-doc/route.ts`

### 5. API Changes

#### New API Routes
- `POST /api/registration` - Create registration request
- `PUT /api/registration` - Approve/reject request
- `GET /api/categories` - Get dropdown categories
- `GET /api/petty-cash` - Get all petty cash entries
- `POST /api/petty-cash` - Create new entry with file upload
- `POST /api/petty-cash/export-doc` - Generate DOCX export

#### Updated API Routes
- `POST /api/auth/login` - Added petty_cash permission
- `GET /api/registration` - Returns registration requests

#### New Library Functions
- `appendSheetData()` - Append rows to Google Sheets
- `uploadToGoogleDrive()` - Upload files to Drive
- `getFileContentFromDrive()` - Download files from Drive

### 6. Database Schema Changes

#### users sheet - Added Column
- `petty_cash` (TRUE/FALSE)

#### New Sheets
- `petty_cash`:
  ```
  id | date | description | category | value | store | ket | transfer | link_url | created_at | update_at
  ```
- `master_dropdown`:
  ```
  category_petty_cash | (other columns)
  ```

### 7. UI/UX Improvements
- Consistent pagination across all list pages (20 items)
- Multi-select filters dengan checkbox UI
- Modal popups untuk forms (Import, Add Entry, Approval)
- Loading states untuk async operations
- Success/Error messages dengan alerts
- Responsive design maintained
- Color scheme consistency (Primary: #0d334d, Secondary: #afcc3c)

### 8. Security Enhancements
- All passwords bcrypt hashed (10 rounds)
- Google Drive files set to public view-only
- Permission-based feature access
- Service account for Google APIs

## Files Changed/Added

### New Files (22 files)
- `app/petty-cash/page.tsx`
- `app/api/petty-cash/route.ts`
- `app/api/petty-cash/export-doc/route.ts`
- `app/api/categories/route.ts`
- `lib/drive.ts`
- `SETUP_GUIDE.md`
- `CHANGELOG.md`

### Modified Files (10 files)
- `app/login/page.tsx` - Added registration
- `app/registration/page.tsx` - Added approval modal
- `app/order-report/page.tsx` - Import, filters, pagination
- `app/stock/page.tsx` - Emptied for future implementation
- `app/api/registration/route.ts` - POST & PUT methods
- `app/api/auth/login/route.ts` - Added petty_cash permission
- `components/Sidebar.tsx` - Added Petty Cash menu
- `lib/sheets.ts` - Added appendSheetData function
- `types/index.ts` - Added PettyCash interface
- `README.md` - Updated documentation
- `package.json` - Added docx dependency

## Breaking Changes
- Users must add `petty_cash` column to users sheet
- Must create `petty_cash` and `master_dropdown` sheets
- Must setup Google Drive folder and update FOLDER_ID
- Need to enable Google Drive API in Google Cloud

## Migration Guide

1. **Update Google Sheets**:
   ```
   - Add column "petty_cash" to users sheet
   - Create sheet "petty_cash" with columns
   - Create sheet "master_dropdown" with categories
   ```

2. **Setup Google Drive**:
   ```
   - Create folder for petty cash receipts
   - Share with service account
   - Update FOLDER_ID in lib/drive.ts
   ```

3. **Enable Google Drive API**:
   ```
   - Go to Google Cloud Console
   - Enable Google Drive API
   - Service account already has access
   ```

4. **Install New Dependencies**:
   ```bash
   npm install
   # docx package will be installed
   ```

5. **Update User Permissions**:
   - Edit existing users in users sheet
   - Set petty_cash to TRUE for users who need access

## Testing Checklist

- [ ] Login with existing user works
- [ ] New user registration creates request
- [ ] Admin can approve with permissions
- [ ] Approved user can login
- [ ] Order Report import works (all 3 types)
- [ ] Order Report filters work (date + multi-status)
- [ ] Order Report pagination works (20 per page)
- [ ] Petty Cash add entry works
- [ ] File upload to Google Drive works
- [ ] Petty Cash filters work (date + category + store)
- [ ] Petty Cash pagination works (20 per page)
- [ ] Excel export works (all users)
- [ ] DOC export works (admin users only)
- [ ] Sidebar shows correct menus based on permissions

## Known Issues / Future Enhancements

### Known Issues
- OCR validation not yet implemented (mentioned in requirements but complex)
- DOC export may timeout for very large datasets (>100 entries)
- Image download in DOC export requires public Drive links

### Future Enhancements
- OCR validation for receipt amounts
- Stock management implementation
- Batch operations for petty cash
- Advanced reporting and analytics
- Mobile app version
- Real-time sync
- Audit logging
- User activity tracking

## Version Info
- **Version**: 0.2.0
- **Previous Version**: 0.1.0
- **Release Date**: January 2026
- **Node Version**: 20+
- **Next.js Version**: 16.1.4
- **React Version**: 19.2.3
