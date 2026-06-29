import { NextRequest, NextResponse } from "next/server";
import { buildCanvasingDoc } from "@/components/canvasing/exportDocBuilder";

export async function POST(request: NextRequest) {
  try {
    const { data, storeName } = await request.json();

    const buffer = await buildCanvasingDoc(data, storeName);

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Canvasing_${storeName}_${Date.now()}.docx"`,
      },
    });
  } catch (error) {
    console.error("Error generating document:", error);
    return NextResponse.json(
      {
        error: "Failed to generate document",
        details:
          error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}