"use client";

import ErrorReportPage from "@/components/dailyJob/ErrorReportPage";

export default function DeliveryNoteReportPage() {
  return (
    <ErrorReportPage
      config={{
        remainingKey: "delivery_note",
        endpoint: "/api/daily-job/delivery-note",
        title: "Delivery Note Report",
        errorFieldLabel: "Nomor Sales Order (Delivery Note)",
        errorField: "error_sales_order_delivery_note",
        categoryField: "error_category_delivery_note",
        notesField: "error_notes_delivery_note",
        imageUrlField: "error_image_url_delivery_note",
        solvedField: "error_solved_delivery_note",
        dropdownCategoryKey: "error_category_delivery_note",
        dropdownSolvedKey: "error_solved_delivery_note",
      }}
    />
  );
}
