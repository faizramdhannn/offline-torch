"use client";

import ErrorReportPage from "@/components/dailyJob/ErrorReportPage";

export default function StockEntryReportPage() {
  return (
    <ErrorReportPage
      config={{
        remainingKey: "stock_entry",
        endpoint: "/api/daily-job/stock-entry",
        title: "Stock Entry Report",
        errorFieldLabel: "Nomor / Referensi Stock Entry",
        errorField: "error_stock_entry",
        categoryField: "error_category_stock_entry",
        notesField: "error_notes_stock_entry",
        imageUrlField: "error_image_url_stock_entry",
        solvedField: "error_solved_stock_entry",
        dropdownCategoryKey: "error_category_stock_entry",
        dropdownSolvedKey: "error_solved_stock_entry",
      }}
    />
  );
}
