import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const templates: Record<string, { name: string; filename: string }> = {
  template1: {
    name: "模板1-标准格式",
    filename: "template1-standard.xlsx",
  },
  template2: {
    name: "模板2-电商格式",
    filename: "template2-ecommerce.xlsx",
  },
  template3: {
    name: "模板3-英文格式",
    filename: "template3-english.xlsx",
  },
  template4: {
    name: "模板4-分组格式",
    filename: "template4-grouped.xlsx",
  },
  template5: {
    name: "模板5-客户单号格式",
    filename: "template5-multisheet.xlsx",
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
    const filePath = path.join(process.cwd(), "public", "templates", config.filename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "模板文件不存在" }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${config.filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: `下载模板失败: ${(error as Error).message}` }, { status: 500 });
  }
}
