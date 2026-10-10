// Keadaan klien (di memori): aturan pengumuman terjadwal & teks standby, dibaca layar standby tablet.
import type { AnnounceRule } from "./announceSchedule";

let rules: AnnounceRule[] = [];
let standbyText = "";
export const setAnnounceState = (r: AnnounceRule[], s: string) => { rules = r; standbyText = s; };
export const getAnnounceState = () => ({ rules, standbyText });
