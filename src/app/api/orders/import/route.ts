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

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface DuplicateInfo {
  row: number;
  duplicateWith: number;
  type: 'batch' | 'database';
}

interface SubmitResult {
  success: boolean;
  successCount: number;
  failCount: number;
  errors: ValidationError[];
  duplicates: DuplicateInfo[];
}

function validateRow(row: any, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!row.senderName) {
    errors.push({ row: index + 1, field: 'senderName', message: '发件人姓名不能为空' });
  }
  
  if (!row.senderPhone) {
    errors.push({ row: index + 1, field: 'senderPhone', message: '发件人电话不能为空' });
  } else if (!/^1[3-9]\d{9}$/.test(String(row.senderPhone))) {
    errors.push({ row: index + 1, field: 'senderPhone', message: '发件人电话格式错误' });
  }
  
  if (!row.senderAddress) {
    errors.push({ row: index + 1, field: 'senderAddress', message: '发件人地址不能为空' });
  }
  
  if (!row.receiverName) {
    errors.push({ row: index + 1, field: 'receiverName', message: '收件人姓名不能为空' });
  }
  
  if (!row.receiverPhone) {
    errors.push({ row: index + 1, field: 'receiverPhone', message: '收件人电话不能为空' });
  } else if (!/^1[3-9]\d{9}$/.test(String(row.receiverPhone))) {
    errors.push({ row: index + 1, field: 'receiverPhone', message: '收件人电话格式错误' });
  }
  
  if (!row.receiverAddress) {
    errors.push({ row: index + 1, field: 'receiverAddress', message: '收件人地址不能为空' });
  }
  
  if (!row.goodsWeight || typeof row.goodsWeight !== 'number' || row.goodsWeight <= 0) {
    errors.push({ row: index + 1, field: 'goodsWeight', message: '重量必须为正数' });
  }
  
  if (!row.goodsPieces || typeof row.goodsPieces !== 'number' || row.goodsPieces <= 0 || !Number.isInteger(row.goodsPieces)) {
    row.goodsPieces = 1;
  }
  
  if (!row.goodsType) {
    row.goodsType = '常温';
  } else {
    const goodsTypeStr = String(row.goodsType).toLowerCase();
    const validTypes = ["常温", "冷藏", "冷冻", "normal", "cold", "frozen"];
    if (!validTypes.some(t => goodsTypeStr.includes(t.toLowerCase()))) {
      errors.push({ row: index + 1, field: 'goodsType', message: '温层必须为：常温、冷藏或冷冻' });
    }
  }
  
  return errors;
}

async function checkDuplicates(orders: any[]): Promise<DuplicateInfo[]> {
  const duplicates: DuplicateInfo[] = [];
  const seenCodes = new Map<string, number>();
  
  for (let i = 0; i < orders.length; i++) {
    const code = orders[i].customerOrderNumber;
    if (code) {
      if (seenCodes.has(code)) {
        duplicates.push({ row: i + 1, duplicateWith: seenCodes.get(code)! + 1, type: 'batch' });
      } else {
        seenCodes.set(code, i);
      }
    }
  }
  
  const codes = orders.filter(o => o.customerOrderNumber).map(o => o.customerOrderNumber);
  if (codes.length > 0) {
    const existingOrders = await prisma.order.findMany({
      where: { customerOrderNumber: { in: codes } },
      select: { customerOrderNumber: true }
    });
    
    const existingCodes = new Set(existingOrders.map(o => o.customerOrderNumber));
    for (let i = 0; i < orders.length; i++) {
      const code = orders[i].customerOrderNumber;
      if (code && existingCodes.has(code)) {
        duplicates.push({ row: i + 1, duplicateWith: -1, type: 'database' });
      }
    }
  }
  
  return duplicates;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const previewOnly = formData.get("previewOnly") === "true";
    const importData = formData.get("importData") as string;
    const submitOnly = formData.get("submitOnly") === "true";
    
    if (importData) {
      const data = JSON.parse(importData);
      
      const allErrors: ValidationError[] = [];
      const invalidIndices: Set<number> = new Set();
      
      data.forEach((order: any, index: number) => {
        const errors = validateRow(order, index);
        if (errors.length > 0) {
          invalidIndices.add(index);
          allErrors.push(...errors);
        }
      });
      
      const duplicates = await checkDuplicates(data);
      
      if (duplicates.length > 0) {
        duplicates.forEach(dup => {
          invalidIndices.add(dup.row - 1);
        });
      }
      
      data.forEach((order: any, index: number) => {
        if (!order.customerOrderNumber) {
          invalidIndices.add(index);
          allErrors.push({ row: index + 1, field: 'customerOrderNumber', message: '客户单号为空' });
        }
      });
      
      duplicates.forEach(dup => {
        const msg = dup.type === 'batch' ? `客户单号与第${dup.duplicateWith}行重复` : '客户单号在数据库中已存在';
        allErrors.push({ row: dup.row, field: 'customerOrderNumber', message: msg });
      });
      
      if (allErrors.length > 0) {
        return NextResponse.json({
          success: false,
          successCount: 0,
          failCount: invalidIndices.size,
          errors: allErrors,
          duplicates: duplicates,
          message: '有错误的行不允许提交，请先修正错误'
        }, { status: 400 });
      }
      
      const validOrders = data.map((order: any) => ({
        ...order,
        trackingNumber: generateTrackingNumber(),
        status: "pending" as const
      }));
      
      await prisma.order.createMany({ data: validOrders as any[] });
      
      return NextResponse.json({
        success: true,
        successCount: validOrders.length,
        failCount: 0,
        errors: [],
        duplicates: [],
        message: `成功提交 ${validOrders.length} 条订单`
      });
    }
    
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

    let worksheet = workbook.Sheets[workbook.SheetNames[0]];
    let range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");

    if (workbook.SheetNames.length > 1) {
      for (const sheetName of workbook.SheetNames) {
        const currentSheet = workbook.Sheets[sheetName];
        const currentRange = XLSX.utils.decode_range(currentSheet["!ref"] || "A1:A1");
        
        const rowCount = currentRange.e.r - currentRange.s.r + 1;
        const colCount = currentRange.e.c - currentRange.s.c + 1;
        
        if (rowCount > 3 && colCount > 5) {
          worksheet = currentSheet;
          range = currentRange;
          break;
        }
      }
    }

    if (range.s.r === range.e.r && range.s.c === range.e.c && range.s.r === 0 && range.s.c === 0) {
      return NextResponse.json({ error: "工作表为空" }, { status: 400 });
    }

    let headerRow = range.s.r;
    const headers: string[] = [];
    const fieldMapping = new Map<string, number>();

    const MAX_ROWS_TO_CHECK = 5;
    
    for (let checkRow = range.s.r; checkRow <= Math.min(range.s.r + MAX_ROWS_TO_CHECK, range.e.r); ++checkRow) {
      const rowHeaders: string[] = [];
      const rowMapping = new Map<string, number>();

      for (let C = range.s.c; C <= range.e.c; ++C) {
        const headerCell = worksheet[XLSX.utils.encode_cell({ r: checkRow, c: C })];
        const headerValue = headerCell ? String(headerCell.v || "").trim() : "";

        if (headerValue) {
          rowHeaders.push(headerValue);

          const mapping = findFieldMapping(headerValue);
          if (mapping) {
            rowMapping.set(mapping.field, C);
          }
        }
      }

      if (rowMapping.size >= 3) {
        headerRow = checkRow;
        headers.length = 0;
        headers.push(...rowHeaders);
        fieldMapping.clear();
        rowMapping.forEach((value, key) => fieldMapping.set(key, value));
        break;
      }

      if (checkRow === Math.min(range.s.r + MAX_ROWS_TO_CHECK, range.e.r) && rowMapping.size === 0) {
        headers.length = 0;
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const headerCell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
          const headerValue = headerCell ? String(headerCell.v || "").trim() : "";
          if (headerValue) {
            headers.push(headerValue);
          }
        }
      }
    }

    const templateResult = detectTemplate(headers);

    if (fieldMapping.size === 0 && headers.length > 0) {
      return NextResponse.json({
        success: true,
        data: [],
        headers: headers,
        detectedTemplate: "自定义模板",
        confidence: 0,
        errors: [],
        duplicates: [],
        needManualMapping: true
      });
    }

    const orders = [];
    const mergedCells = worksheet["!merges"] || [];

    for (let R = headerRow + 1; R <= range.e.r; ++R) {
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

      const order: Record<string, unknown> = {
        customerOrderNumber: null,
        goodsName: null,
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
          const value = parseExcelValue(cell?.v, fieldConfig.type);
          order[field] = value;
          
          if (field === 'goodsQuantity' && !order.goodsPieces) {
            order.goodsPieces = value;
          }
        }
      }

      orders.push(order);
    }

    if (orders.length === 0) {
      return NextResponse.json({ error: "没有找到有效数据" }, { status: 400 });
    }

    const allErrors: ValidationError[] = [];
    orders.forEach((order, index) => {
      const errors = validateRow(order, index);
      allErrors.push(...errors);
    });

    const duplicates = await checkDuplicates(orders);

    if (previewOnly) {
      return NextResponse.json({
        success: true,
        data: orders,
        headers: headers,
        detectedTemplate: templateResult.suggestedTemplate,
        confidence: Math.round(templateResult.confidence * 100),
        errors: allErrors,
        duplicates: duplicates
      });
    }

    if (submitOnly) {
      if (allErrors.length > 0) {
        return NextResponse.json({
          success: false,
          successCount: 0,
          failCount: orders.length,
          errors: allErrors,
          duplicates: [],
          message: '有错误的行不允许提交，请先修正错误'
        }, { status: 400 });
      }
      
      if (duplicates.length > 0) {
        return NextResponse.json({
          success: false,
          successCount: 0,
          failCount: duplicates.length,
          errors: [],
          duplicates: duplicates,
          message: '存在重复的客户单号，请先处理重复数据'
        }, { status: 400 });
      }
    }

    const validOrders = orders.map(order => ({
      ...order,
      trackingNumber: generateTrackingNumber(),
      status: "pending"
    }));

    await prisma.order.createMany({ data: validOrders as any[] });

    return NextResponse.json({
      success: true,
      successCount: validOrders.length,
      failCount: 0,
      errors: [],
      duplicates: [],
      message: `成功提交 ${validOrders.length} 条订单`
    });
  } catch (error) {
    console.error("导入订单失败:", error);
    return NextResponse.json({ error: `导入订单失败: ${(error as Error).message}` }, { status: 500 });
  }
}
