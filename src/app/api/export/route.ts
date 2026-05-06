import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildExcelBuffer, type ItemRow } from "@/lib/excel";

export async function GET() {
  try {
    const items = await prisma.item.findMany({
      orderBy: { createdAt: "desc" },
    });

    const rows: ItemRow[] = items.map((item) => ({
      name: item.name,
      category: item.category || "",
      quantity: item.quantity,
      price: item.price,
      description: item.description || "",
      status: item.status,
    }));

    const buffer = buildExcelBuffer(rows);
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="items_export.xlsx"',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "导出失败" },
      { status: 500 }
    );
  }
}
