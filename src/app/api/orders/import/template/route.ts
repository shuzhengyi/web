import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

interface TemplateConfig {
  name: string;
  headers: string[];
  filename: string;
  hasMergedCells?: boolean;
  mergedRegions?: { s: { r: number; c: number }; e: { r: number; c: number } }[];
}

const templates: Record<string, TemplateConfig> = {
  template1: {
    name: "模板1",
    filename: "template1.xlsx",
    headers: ["外部编码", "发件人姓名", "发件人电话", "发件人地址", "收件人姓名", "收件人电话", "收件人地址", "重量(kg)", "件数", "温层", "备注"],
  },
  template2: {
    name: "模板2",
    filename: "template2.xlsx",
    headers: ["外部订单号", "发货人", "发货电话", "发货地址", "收货人", "收货电话", "收货地址", "重量(kg)", "数量", "温度要求", "附言"],
  },
  template3: {
    name: "模板3",
    filename: "template3.xlsx",
    headers: ["Ref Code", "Sender", "Sender Tel", "Sender Address", "Receiver", "Receiver Tel", "Receiver Address", "Weight(kg)", "Qty", "Temp Zone", "Note"],
  },
  template4: {
    name: "模板4",
    filename: "template4.xlsx",
    headers: ["发件人", "发件电话", "发件地址", "外部编码", "收件人", "收件电话", "收件地址", "备注", "重量(kg)", "件数", "温层"],
    hasMergedCells: true,
    mergedRegions: [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 0, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 0, c: 6 } },
      { s: { r: 0, c: 7 }, e: { r: 0, c: 7 } },
      { s: { r: 0, c: 8 }, e: { r: 0, c: 10 } },
    ],
  },
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const templateType = url.searchParams.get("type") || "template1";
    
    if (!templates[templateType]) {
      return NextResponse.json({ error: "无效的模板类型" }, { status: 400 });
    }

    const config = templates[templateType];
    const worksheet = XLSX.utils.aoa_to_sheet([config.headers]);
    
    if (config.hasMergedCells && config.mergedRegions) {
      worksheet["!merges"] = config.mergedRegions;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, config.name);

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${config.filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: `生成模板失败: ${(error as Error).message}` }, { status: 500 });
  }
}

export async function POST() {
  try {
    const allWorkbooks: XLSX.WorkBook[] = [];
    
    Object.values(templates).forEach((config, index) => {
      const worksheet = XLSX.utils.aoa_to_sheet([config.headers]);
      
      if (config.hasMergedCells && config.mergedRegions) {
        worksheet["!merges"] = config.mergedRegions;
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, config.name);
      allWorkbooks.push(workbook);
    });

    const combinedWorkbook = XLSX.utils.book_new();
    allWorkbooks.forEach((wb, index) => {
      const sheetName = Object.keys(templates)[index];
      const worksheet = wb.Sheets[wb.SheetNames[0]];
      XLSX.utils.book_append_sheet(combinedWorkbook, worksheet, Object.values(templates)[index].name);
    });

    const buffer = XLSX.write(combinedWorkbook, { type: "buffer", bookType: "xlsx" });
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="all_templates.xlsx"',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: `生成模板失败: ${(error as Error).message}` }, { status: 500 });
  }
}
