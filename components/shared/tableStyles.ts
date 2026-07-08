/**
 * Shared table cell/header classnames so every data table in the app
 * (stock, petty-cash, traffic-store, request-tracking, etc.) renders at the
 * same compact density instead of each page inventing its own px/text size.
 */
export const thClass =
  "px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap";
export const tdClass = "px-2 py-1 text-[11px] text-gray-700";
export const tableWrapClass = "overflow-x-auto rounded-lg border border-gray-100";
export const tableClass = "min-w-full divide-y divide-gray-100";
export const theadClass = "bg-gray-50";
export const trHoverClass = "hover:bg-gray-50 transition-colors";
