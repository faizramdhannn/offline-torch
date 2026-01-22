export interface User {
  id: string;
  name: string;
  user_name: string;
  password: string;
  dashboard: boolean;
  order_report: boolean;
  stock: boolean;
  registration_request: boolean;
  user_setting: boolean;
  petty_cash: boolean;
  petty_cash_add: boolean;
  petty_cash_export: boolean;
  order_report_import: boolean;
  order_report_export: boolean;
  last_activity: string;
}

export interface RegistrationRequest {
  id: string;
  name: string;
  user_name: string;
  password: string;
  status: string;
  request_at: string;
}

export interface OrderReport {
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

export interface PettyCash {
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