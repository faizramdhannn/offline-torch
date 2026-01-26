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
  customer: boolean;
  voucher: boolean;
  bundling: boolean;
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
  update_by: string;
  created_at: string;
  update_at: string;
}

export interface Customer {
  phone_number: string;
  customer_name: string;
  location_store: string;
  total_order: string;
  total_value: string;
  average_value: string;
  followup: string;
  result: string;
  ket: string;
  link_url: string;
  update_by: string;
  update_at: string;
}

export interface Voucher {
  id: string;
  voucher_name: string;
  category: string;
  description: string;
  created_at: string;
  update_at: string;
}

export interface Bundling {
  id: string;
  bundling_name: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string;
  option_6: string;
  total_value: string;
  discount_percentage: string;
  discount_value: string;
  value: string;
  torch_cirebon: string;
  torch_jogja: string;
  torch_karawaci: string;
  torch_karawang: string;
  torch_lampung: string;
  torch_lembong: string;
  torch_makassar: string;
  torch_malang: string;
  torch_margonda: string;
  torch_medan: string;
  torch_pekalongan: string;
  torch_purwokerto: string;
  torch_surabaya: string;
  torch_tambun: string;
  status: string;
  created_at: string;
  update_at: string;
}