// Bentuk data preset suasana, grup toko, dan template pengumuman (disimpan di database lewat /api/devices/prefs).
export interface Preset { name: string; playlist_id: number; volume: number; shuffle: boolean }
export interface Group { name: string; users: string[] }
export interface Template { name: string; text: string; seconds: number }
