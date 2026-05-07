import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { mapHeadersToFields, parseExcelValue, findFieldMapping, ORDER_FIELDS, detectTemplate } from "@/lib/excel-mapper";

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

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      return NextResponse.json({ error: "只支持 Excel 文件格式 (.xlsx/.xls)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    
    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: "文件为空" }, { status: 400 });
    }

    const workbook = XLSX.read(arrayBuffer, { 
      cellNF: true, 
      cellDates: true,
      type: "buffer"
    });

    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ error: "Excel 文件中没有工作表" }, { status: 400 });
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");

    if (range.s.r === range.e.r && range.s.c === range.e.c && range.s.r === 0 && range.s.c === 0) {
      return NextResponse.json({ error: "工作表为空" }, { status: 400 });
    }

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

    const templateResult = detectTemplate(headers);

    if (fieldMapping.size === 0) {
      return NextResponse.json({
        error: "无法识别Excel模板格式",
        message: "请确保表头包含以下字段之一：寄件人、收件人、物品名称、重量、件数等",
        availableFields: ORDER_FIELDS.map(f => f.field)
      }, { status: 400 });
    }

    const orders = [];
    const mergedCells = worksheet["!merges"] || [];
    const errors: string[] = [];
    let successCount = 0;
    let failCount = 0;

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
        if (cell && cell.v !== null && cell.v !== undefined && cell.v !== "") {
          hasData = true;
          rowData[field] = cell.v;
        }
      }

      if (!hasData) continue;

      const trackingNumberField = fieldMapping.get("trackingNumber");
      let trackingNumber: string | null = null;

      if (trackingNumberField !== undefined) {
        let cellIndex = trackingNumberField;
        for (const merge of mergedCells) {
          if (R >= merge.s.r && R <= merge.e.r && trackingNumberField >= merge.s.c && trackingNumberField <= merge.e.c) {
            cellIndex = merge.s.c;
            break;
          }
        }
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: cellIndex })];
        if (cell && cell.v) {
          trackingNumber = String(cell.v).trim() || null;
        }
      }

      const order: Record<string, unknown> = {
        trackingNumber: trackingNumber || generateTrackingNumber(),
        customerOrderNumber: null,
        senderName: null,
        senderPhone: null,
        senderAddress: null,
        receiverName: null,
        receiverPhone: null,
        receiverAddress: null,
        goodsWeight: 0,
        goodsQuantity: 0,
        goodsPieces: 0,
        goodsType: null,
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

      const rowErrors: string[] = [];

      if (!order.senderName) {
        rowErrors.push("发件人姓名不能为空");
      }
      if (!order.senderPhone) {
        rowErrors.push("发件人电话不能为空");
      }
      if (!order.senderAddress) {
        rowErrors.push("发件人地址不能为空");
      }
      if (!order.receiverName) {
        rowErrors.push("收件人姓名不能为空");
      }
      if (!order.receiverPhone) {
        rowErrors.push("收件人电话不能为空");
      }
      if (!order.receiverAddress) {
        rowErrors.push("收件人地址不能为空");
      }
      if (!order.goodsWeight || typeof order.goodsWeight !== "number" || order.goodsWeight <= 0) {
        rowErrors.push("重量必须为正数");
      }
      if (!order.goodsPieces || typeof order.goodsPieces !== "number" || order.goodsPieces <= 0 || !Number.isInteger(order.goodsPieces)) {
        rowErrors.push("件数必须为正整数");
      }
      if (!order.goodsType) {
        rowErrors.push("温层不能为空");
      } else if (typeof order.goodsType === "string") {
        const goodsTypeStr = order.goodsType as string;
        const validTypes = ["常温", "冷藏", "冷冻", "normal", "cold", "frozen"];
        if (!validTypes.some(t => goodsTypeStr.toLowerCase().includes(t))) {
          rowErrors.push("温层必须为：常温、冷藏或冷冻");
        }
      }

      if (rowErrors.length > 0) {
        errors.push(`第 ${R + 1} 行：${rowErrors.join("；")}`);
        failCount++;
        continue;
      }

      orders.push(order);
      successCount++;
    }

    if (orders.length === 0) {
      return NextResponse.json({ 
        error: "没有找到有效数据",
        details: errors 
      }, { status: 400 });
    }

    await prisma.order.createMany({ data: orders as any[] });

    return NextResponse.json({
      success: true,
      successCount,
      failCount,
      errors,
      detectedFields: Array.from(fieldMapping.keys()),
      detectedTemplate: templateResult.suggestedTemplate,
      confidence: Math.round(templateResult.confidence * 100)
    });
  } catch (error) {
    console.error("导入订单失败:", error);
    return NextResponse.json({ error: `导入订单失败: ${(error as Error).message}` }, { status: 500 });
  }
}
