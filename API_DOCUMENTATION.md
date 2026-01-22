# API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All API routes except `/auth/login` and `/registration` (POST) require user authentication via localStorage.

## Endpoints

### Authentication

#### POST /auth/login
Login user and get permissions.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "id": "1",
  "name": "Admin User",
  "user_name": "admin",
  "dashboard": true,
  "order_report": true,
  "stock": true,
  "registration_request": true,
  "user_setting": true,
  "petty_cash": true
}
```

**Response (401):**
```json
{
  "error": "Invalid credentials"
}
```

---

### Registration

#### GET /registration
Get all registration requests.

**Response (200):**
```json
[
  {
    "id": "1234567890",
    "name": "John Doe",
    "user_name": "john",
    "password": "$2a$10$...",
    "status": "pending",
    "request_at": "21 Jan 2026, 10:30"
  }
]
```

#### POST /registration
Create new registration request.

**Request:**
```json
{
  "name": "John Doe",
  "username": "john",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true
}
```

#### PUT /registration
Approve or reject registration request.

**Request (Approve):**
```json
{
  "id": "1234567890",
  "status": "approved",
  "permissions": {
    "dashboard": true,
    "order_report": true,
    "stock": false,
    "registration_request": false,
    "user_setting": false,
    "petty_cash": true
  }
}
```

**Request (Reject):**
```json
{
  "id": "1234567890",
  "status": "rejected"
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

### Order Report

#### GET /order-report
Get all order reports.

**Response (200):**
```json
[
  {
    "order_date": "21-01-2026 10:30",
    "sales_order": "SO-001",
    "warehouse": "Main Warehouse",
    "status": "Completed",
    "sales_channel": "Online",
    "payment_method": "Transfer",
    "value_amount": "Rp 1.000.000",
    "delivery_note": "DN-001",
    "sales_invoice": "INV-001"
  }
]
```

---

### Import

#### POST /import
Import data to specific sheet.

**Request:**
```json
{
  "sheetName": "powerbiz_salesorder",
  "data": [
    ["SO-001", "Main Warehouse", "Completed", ...],
    ["SO-002", "Secondary Warehouse", "Pending", ...]
  ]
}
```

**Valid sheetNames:**
- `powerbiz_salesorder`
- `delivery_note`
- `sales_invoice`

**Response (200):**
```json
{
  "success": true
}
```

**Response (400):**
```json
{
  "error": "Invalid sheet name"
}
```

---

### Categories

#### GET /categories
Get all petty cash categories from master_dropdown.

**Response (200):**
```json
[
  "Office Supplies",
  "Transportation",
  "Meals",
  "Entertainment",
  "Other"
]
```

---

### Petty Cash

#### GET /petty-cash
Get all petty cash entries.

**Response (200):**
```json
[
  {
    "id": "12345678",
    "date": "21 Jan 2026",
    "description": "Office supplies purchase",
    "category": "Office Supplies",
    "value": "Rp 150.000",
    "store": "admin",
    "ket": "Monthly supplies",
    "transfer": "TRUE",
    "link_url": "https://drive.google.com/file/d/.../view",
    "created_at": "2026-01-21T10:30:00Z",
    "update_at": "2026-01-21T10:30:00Z"
  }
]
```

#### POST /petty-cash
Create new petty cash entry.

**Request (multipart/form-data):**
```
description: "Office supplies purchase"
category: "Office Supplies"
value: "Rp 150.000"
store: "admin"
ket: "Monthly supplies"
transfer: "true"
file: [File object]
```

**Response (200):**
```json
{
  "success": true,
  "id": "12345678"
}
```

**Response (500):**
```json
{
  "error": "Failed to create petty cash entry"
}
```

---

### Petty Cash Export

#### POST /petty-cash/export-doc
Export filtered petty cash data to DOCX format.

**Request:**
```json
{
  "data": [
    {
      "id": "12345678",
      "date": "21 Jan 2026",
      "description": "Office supplies",
      "value": "Rp 150.000",
      "link_url": "https://drive.google.com/file/d/.../view"
    }
  ],
  "username": "Admin User",
  "dateFrom": "2026-01-01",
  "dateTo": "2026-01-31"
}
```

**Response (200):**
- Content-Type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Binary DOCX file

**Response (500):**
```json
{
  "error": "Failed to generate document"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 400  | Bad Request (invalid parameters) |
| 401  | Unauthorized (invalid credentials) |
| 404  | Not Found |
| 500  | Internal Server Error |

---

## Data Types

### User
```typescript
interface User {
  id: string;
  name: string;
  user_name: string;
  dashboard: boolean;
  order_report: boolean;
  stock: boolean;
  registration_request: boolean;
  user_setting: boolean;
  petty_cash: boolean;
}
```

### RegistrationRequest
```typescript
interface RegistrationRequest {
  id: string;
  name: string;
  user_name: string;
  password: string;
  status: 'pending' | 'approved' | 'rejected';
  request_at: string;
}
```

### OrderReport
```typescript
interface OrderReport {
  order_date: string;
  sales_order: string;
  warehouse: string;
  status: string;
  sales_channel: string;
  payment_method: string;
  value_amount: string;
  delivery_note: string | null;
  sales_invoice: string | null;
}
```

### PettyCash
```typescript
interface PettyCash {
  id: string;
  date: string;
  description: string;
  category: string;
  value: string;
  store: string;
  ket: string;
  transfer: string;
  link_url: string;
  created_at: string;
  update_at: string;
}
```

---

## Rate Limits

No rate limits currently implemented. Consider adding in production:
- 100 requests per minute per user
- 1000 requests per hour per user
- 10MB file upload limit

---

## File Upload Specifications

### Supported Formats
- **Images**: JPG, JPEG, PNG
- **Documents**: PDF
- **Spreadsheets**: CSV, XLS, XLSX

### Size Limits
- Maximum file size: 5MB (configurable)
- Recommended image resolution: 800x600 minimum

### File Naming Convention
Uploaded files are automatically renamed:
```
{date}_{category}_{store}_{id}.{extension}

Example: 21_Jan_2026_Office_Supplies_admin_12345678.jpg
```

---

## Google Drive Integration

### File Storage
- All uploaded receipts stored in configured Drive folder
- Files set to "anyone with link can view"
- Links stored in `link_url` column

### Folder Structure
```
Petty Cash Receipts/
  ├── 21_Jan_2026_Office_Supplies_admin_12345678.jpg
  ├── 21_Jan_2026_Transportation_admin_12345679.pdf
  └── ...
```

---

## Security Notes

1. **Password Hashing**: All passwords bcrypt hashed (10 rounds)
2. **Authentication**: Client-side localStorage (consider JWT for production)
3. **Authorization**: Permission-based feature access
4. **File Access**: Google Drive files are public (view-only)
5. **API Keys**: Service account credentials in environment variables

---

## Development Tips

### Testing API Endpoints

Using cURL:
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get order reports
curl http://localhost:3000/api/order-report

# Create registration
curl -X POST http://localhost:3000/api/registration \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","username":"test","password":"test123"}'
```

Using Postman:
1. Import API collection (create from this doc)
2. Set environment variable for base URL
3. Use Bearer token if implementing JWT

### Common Errors

**"Failed to fetch"**
- Check API route exists
- Verify request method (GET/POST/PUT)
- Check request body format

**"Authentication failed"**
- Verify password is bcrypt hashed in sheet
- Check username exists in users sheet

**"Failed to import data"**
- Validate CSV/Excel format
- Check sheet name is valid
- Ensure data structure matches

**"Failed to upload to Drive"**
- Verify service account has access to folder
- Check FOLDER_ID is correct
- Ensure Google Drive API is enabled

---

## Future API Endpoints (v0.3.0)

Planned endpoints for next version:

- `POST /api/ocr/verify` - OCR receipt verification
- `GET /api/audit-log` - User activity log
- `GET /api/reports/summary` - Summary reports
- `PUT /api/petty-cash/:id` - Update entry
- `DELETE /api/petty-cash/:id` - Delete entry
- `GET /api/users` - List all users
- `PUT /api/users/:id` - Update user permissions
