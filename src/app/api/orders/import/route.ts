import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { mapHeadersToFields, parseExcelValue, findFieldMapping, ORDER_FIELDS } from "@/lib/excel-mapper";

function generateTrackingNumber(): string {
  const prefix = "YT";
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${dateStr}${timeStr}${random}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { cellNF: true, cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
    const headers: string[] = [];
    const fieldMapping = new Map<string, number>();

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const headerCell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
      const headerValue = headerCell ? String(headerCell.v || "").trim() : "";

      if (headerValue) {
        headers.push(headerValue);

        const mapping = findFieldMapping(headerValue);
        if (mapping) {
          fieldMapping.set(mapping.field, C);
        }
      }
    }

    if (fieldMapping.size === 0) {
      return NextResponse.json({
        error: "无法识别Excel模板格式。请确保表头包含以下字段之一：寄件人、收件人、物品名称等"
      }, { status: 400 });
    }

    const orders = [];
    const mergedCells = worksheet["!merges"] || [];

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const rowData: Record<string, unknown> = {};

      let hasData = false;
      for (const [field, colIndex] of fieldMapping.entries()) {
        let cellIndex = colIndex;

        for (const merge of mergedCells) {
          if (R >= merge.s.r && R <= merge.e.r && colIndex >= merge.s.c && colIndex <= merge.e.c) {
            cellIndex = merge.s.c;
            break;
          }
        }

        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: cellIndex })];
        const fieldConfig = ORDER_FIELDS.find(f => f.field === field);

        if (cell && cell.v !== null && cell.v !== undefined && cell.v !== "") {
          hasData = true;
          rowData[field] = cell.v;
        }
      }

      if (!hasData) continue;

      const trackingNumberField = fieldMapping.get("trackingNumber");
      let trackingNumber: string | null = null;

      if (trackingNumberField !== undefined) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: trackingNumberField })];
        if (cell && cell.v) {
          trackingNumber = String(cell.v).trim() || null;
        }
      }

      const order: Record<string, unknown> = {
        trackingNumber: trackingNumber || generateTrackingNumber(),
        customerOrderNumber: null,
        customerCode: null,
        customerName: null,
        senderName: null,
        senderPhone: null,
        senderCompany: null,
        senderProvince: null,
        senderCity: null,
        senderDistrict: null,
        senderAddress: null,
        receiverName: null,
        receiverPhone: null,
        receiverCompany: null,
        receiverProvince: null,
        receiverCity: null,
        receiverDistrict: null,
        receiverAddress: null,
        goodsName: null,
        goodsType: null,
        goodsQuantity: 0,
        goodsWeight: 0,
        goodsVolume: 0,
        goodsPieces: 0,
        serviceType: null,
        paymentType: null,
        collectionAmount: 0,
        insuredAmount: 0,
        remark: null,
        status: "pending",
      };

      for (const [field, colIndex] of fieldMapping.entries()) {
        let cellIndex = colIndex;

        for (const merge of mergedCells) {
          if (R >= merge.s.r && R <= merge.e.r && colIndex >= merge.s.c && colIndex <= merge.e.c) {
            cellIndex = merge.s.c;
            break;
          }
        }

        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: cellIndex })];
        const fieldConfig = ORDER_FIELDS.find(f => f.field === field);

        if (fieldConfig) {
          order[field] = parseExcelValue(cell?.v, fieldConfig.type);
        }
      }

      orders.push(order);
    }

    if (orders.length === 0) {
      return NextResponse.json({ error: "没有找到有效数据" }, { status: 400 });
    }

    await prisma.order.createMany({ data: orders as any[] });

    const detectedFields = Array.from(fieldMapping.keys());
    return NextResponse.json({
      success: true,
      count: orders.length,
      detectedFields
    });
  } catch (error) {
    console.error("导入订单失败:", error);
    return NextResponse.json({ error: `导入订单失败: ${(error as Error).message}` }, { status: 500 });
  }
}
