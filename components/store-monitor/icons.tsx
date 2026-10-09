import type { SVGProps } from "react";

// Ikon SVG (outline/solid sederhana) untuk Store Monitor — menggantikan emoji.
const base = (p: SVGProps<SVGSVGElement>) => ({ width: 14, height: 14, viewBox: "0 0 24 24", "aria-hidden": true, ...p });
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} fill="currentColor"><path d="M8 5v14l11-7z" /></svg>);
export const PauseIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>);
export const PrevIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>);
export const NextIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} fill="currentColor"><path d="M16 5h2v14h-2zM4 5l11 7L4 19z" /></svg>);
export const VolumeIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} {...stroke}><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /></svg>);
export const MuteIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} {...stroke}><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M22 9l-6 6M16 9l6 6" /></svg>);
export const MegaphoneIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} {...stroke}><path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z" /><path d="M15 9a4 4 0 010 6M18 6.5a8 8 0 010 11" /></svg>);
export const CalendarIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} {...stroke}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>);
export const RefreshIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} {...stroke}><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" /></svg>);
export const MusicIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} {...stroke}><path d="M9 18V6l11-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></svg>);
export const BatteryIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} {...stroke}><rect x="2.5" y="8" width="16" height="9" rx="2" /><path d="M21 11v3" /></svg>);
export const BoltIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} fill="currentColor"><path d="M13 2L5 13h5l-1 9 8-11h-5z" /></svg>);
export const PencilIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} {...stroke}><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>);
export const ClockIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const PowerIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)} {...stroke}><path d="M12 3v9M6.4 6.4a8 8 0 1011.2 0" /></svg>);
