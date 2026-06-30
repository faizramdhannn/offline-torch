export interface AttendanceRecord {
  id: string;
  store_id: string;
  store_name: string;
  device_info: string;
  browser: string;
  ip_address: string;
  is_valid_location: string;
  open_latitude: string;
  open_longitude: string;
  open_maps_url: string;
  open_timestamp: string;
  open_staff_name: string;
  open_selfie: string;
  close_latitude: string;
  close_longitude: string;
  close_maps_url: string;
  close_timestamp: string;
  close_staff_name: string;
  close_selfie: string;
  created_at: string;
  updated_at: string;
}

export interface StoreEntry {
  id: string;
  store_name: string;
}

export interface StoreDetail {
  id: string;
  store_name: string;
  type_store: string;
  open_hours: string;
  close_hours: string;
  store_wages: string;
}

export interface TaftEntry {
  id: string;
  store_name: string;
  taft_name: string;
  start_date: string;
  end_date: string;
}

export type AttendanceStep = "init" | "gps" | "selfie" | "taft" | "confirm" | "done";
export type ActionType = "open" | "close";
export type AttendanceTab = "capture" | "history";