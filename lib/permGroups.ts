// Definisi kolom permission (dipakai Settings dan halaman Role).
export const PERM_GROUPS: {
  label: string;
  color: string;          // header bg
  fields: { key: string; label: string }[];
}[] = [
  {
    label: "General",
    color: "bg-slate-100",
    fields: [
      { key: "dashboard",      label: "Dashboard" },
      { key: "analytics_order",label: "Analytics" },
      { key: "customer",       label: "Customer" },
      { key: "voucher",        label: "Voucher" },
      { key: "bundling",       label: "Bundling" },
    ],
  },
  {
    label: "Order & Sales",
    color: "bg-blue-50",
    fields: [
      { key: "order_report",        label: "Order" },
      { key: "order_report_import", label: "Import" },
      { key: "order_report_export", label: "Export" },
      { key: "sales_view",          label: "Sales" },
      { key: "sales_view_all",      label: "Semua" },
    ],
  },
  {
    label: "Stock",
    color: "bg-violet-50",
    fields: [
      { key: "stock",                label: "View" },
      { key: "stock_import",         label: "Import" },
      { key: "stock_export",         label: "Export" },
      { key: "stock_refresh_javelin",label: "Javelin" },
      { key: "stock_view_store",     label: "Store" },
      { key: "stock_view_pca",       label: "PCA" },
      { key: "stock_view_master",    label: "Master" },
      { key: "stock_view_hpp",       label: "HPP" },
      { key: "stock_view_hpt",       label: "HPT" },
      { key: "stock_view_hpj",       label: "HPJ" },
      { key: "stock_pca_view",       label: "Stock PCA" },
      { key: "stock_opname",         label: "STO" },
      { key: "stock_opname_report",  label: "STO Rpt" },
    ],
  },
  {
    label: "Finance",
    color: "bg-emerald-50",
    fields: [
      { key: "petty_cash",         label: "Kas" },
      { key: "petty_cash_add",     label: "Add" },
      { key: "petty_cash_export",  label: "Export" },
      { key: "petty_cash_balance", label: "Saldo" },
      { key: "canvasing",          label: "Canvas" },
      { key: "canvasing_export",   label: "Exp." },
    ],
  },
  {
    label: "Request & Traffic",
    color: "bg-orange-50",
    fields: [
      { key: "request",          label: "Request" },
      { key: "edit_request",     label: "Edit" },
      { key: "request_tracking", label: "Shipment" },
      { key: "tracking_edit",    label: "Resi" },
      { key: "traffic_store",    label: "Traffic" },
      { key: "report_store",     label: "Report" },
    ],
  },
  {
    label: "Invoice & Ops",
    color: "bg-rose-50",
    fields: [
      { key: "invoice",          label: "Invoice" },
      { key: "invoice_create",   label: "Create" },
      { key: "invoice_edit",     label: "Edit" },
      { key: "invoice_delete",   label: "Delete" },
      { key: "invoice_master",   label: "Master" },
      { key: "material_issue",   label: "Material" },
      { key: "material_issue_all",label: "Mat All" },
      { key: "asset_store",      label: "Asset" },
      { key: "employee_discount",          label: "Emp. Discount" },
      { key: "employee_discount_approval", label: "Disc. Approval" },
    ],
  },
  {
    label: "HR & Hadir",
    color: "bg-teal-50",
    fields: [
      { key: "attendance",           label: "Hadir" },
      { key: "attendance_report",    label: "Laporan" },
      { key: "attendance_store",     label: "Store" },
      { key: "attendance_store_all", label: "Semua" },
    ],
  },
  {
    label: "Daily Job",
    color: "bg-amber-50",
    fields: [
      { key: "daily_checklist",     label: "Checklist" },
      { key: "daily_checklist_all", label: "Semua" },
    ],
  },
  {
    label: "Admin",
    color: "bg-gray-100",
    fields: [
      { key: "registration_request", label: "Reg." },
      { key: "user_setting",         label: "Setting" },
      { key: "store_monitor",        label: "Monitor" },
    ],
  },
  {
    label: "ERP",
    color: "bg-indigo-50",
    fields: [
      { key: "step_erp", label: "Step ERP" },
      { key: "step_erp_all", label: "ERP All" },
    ],
  },
  {
    label: "Affiliate",
    color: "bg-pink-50",
    fields: [
      { key: "affiliate_view", label: "Affiliate" },
    ],
  },
];
