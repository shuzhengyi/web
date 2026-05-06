import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { parseExcelBuffer } from "@/lib/excel";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "请上传文件" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const rows = parseExcelBuffer(buffer);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "文件中没有有效数据" },
        { status: 400 }
      );
    }

    const validRows = rows.filter((row) => row.name && row.name.trim() !== "");

    if (validRows.length === 0) {
      return NextResponse.json(
        { error: "没有有效的数据行（名称不能为空）" },
        { status: 400 }
      );
    }

    const result = await prisma.item.createMany({
      data: validRows.map((row) => ({
        name: row.name,
        category: row.category || null,
        quantity: row.quantity || 0,
        price: row.price || 0,
        description: row.description || null,
        status: row.status || "active",
      })),
    });

    return NextResponse.json({
      success: true,
      imported: result.count,
      total: rows.length,
      skipped: rows.length - validRows.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "导入失败" },
      { status: 500 }
    );
  }
}
