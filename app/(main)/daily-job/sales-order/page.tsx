"use client";

import ErrorReportPage from "@/components/dailyJob/ErrorReportPage";

export default function SalesOrderReportPage() {
  return (
    <ErrorReportPage
      config={{
        remainingKey: "sales_order",
        endpoint: "/api/daily-job/sales-order",
        title: "Sales Order Report",
        errorFieldLabel: "Nomor Sales Order",
        errorField: "error_sales_order",
        categoryField: "error_category_sales_order",
        notesField: "error_notes_sales_order",
        imageUrlField: "error_image_url_sales_order",
        solvedField: "error_solved_sales_order",
        dropdownCategoryKey: "error_category_sales_order",
        dropdownSolvedKey: "error_solved_sales_order",
      }}
    />
  );
}
