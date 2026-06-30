import type { ChartKey } from "./types";

// ─── Shared Attendance Constants ────────────────────────────────────────────
// Extracted verbatim from the original app/(main)/attendance/page.tsx.
// No values changed — only made `export`-able for reuse across components.

export const DAYS       = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
export const DAY_LABELS = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
export const DAY_LABELS_FULL = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];

export const CODE_COLORS: Record<string, string> = {
  P:   'bg-blue-100 text-blue-800',
  S:   'bg-yellow-100 text-yellow-800',
  F:   'bg-green-100 text-green-800',
  MF:  'bg-purple-100 text-purple-800',
  M:   'bg-orange-100 text-orange-800',
  O:   'bg-red-100 text-red-600',
  C:   'bg-pink-100 text-pink-800',
  '+': 'bg-red-100 text-red-700',
  I:   'bg-indigo-100 text-indigo-700',
  A:   'bg-red-200 text-red-900',
};

export const CODE_BG_CELL: Record<string, string> = {
  P:   'bg-blue-50',
  S:   'bg-yellow-50',
  F:   'bg-green-50',
  MF:  'bg-purple-50',
  M:   'bg-orange-50',
  O:   'bg-red-50',
  C:   'bg-pink-50',
  '+': 'bg-red-50',
  I:   'bg-indigo-50',
  A:   'bg-red-100',
};

export const RECAP_KEYS = [
  { key:'P',   label:'PAGI (P)'        },
  { key:'S',   label:'SIANG (S)'       },
  { key:'O',   label:'OFF (O)'         },
  { key:'F',   label:'FULL (F)'        },
  { key:'MF',  label:'MIDLE FULL (MF)' },
  { key:'C',   label:'CUTI (C)'        },
  { key:'+',   label:'SAKIT (+)'       },
  { key:'I',   label:'IZIN (I)'        },
  { key:'A',   label:'ALPA (A)'        },
];

export const OVERTIME_RATE = 17500;

export const MONTH_SHORT_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

// Used by the Full Report tab's analytics dashboard (ReportDashboard / MiniBarChart)
export const CHART_CFGS = [
  { key: 'masuk'  as ChartKey, label: 'Terbanyak Masuk',  color: '#3b82f6', unit: 'hari',  textCls: 'text-blue-600',   bgCls: 'bg-blue-500'   },
  { key: 'lembur' as ChartKey, label: 'Terbanyak Lembur', color: '#f97316', unit: 'jam',   textCls: 'text-orange-600', bgCls: 'bg-orange-500' },
  { key: 'cuti'   as ChartKey, label: 'Terbanyak Cuti',   color: '#ec4899', unit: 'hari',  textCls: 'text-pink-600',   bgCls: 'bg-pink-500'   },
  { key: 'off'    as ChartKey, label: 'Terbanyak OFF',    color: '#ef4444', unit: 'hari',  textCls: 'text-red-600',    bgCls: 'bg-red-500'    },
] as const;

export const DONUT_COLORS = [
  '#f97316','#fb923c','#fdba74','#fbbf24','#f59e0b',
  '#ef4444','#ec4899','#8b5cf6','#3b82f6','#22c55e',
];
