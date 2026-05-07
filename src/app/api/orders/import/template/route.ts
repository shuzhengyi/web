import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const headers = [
      "运单号",
      "客户单号",
      "客户编号",
      "客户名称",
      "寄件人",
      "寄件人手机",
      "寄件公司",
      "寄件省份",
      "寄件城市",
      "寄件区县",
      "寄件地址",
      "收件人",
      "收件人手机",
      "收件公司",
      "收件省份",
      "收件城市",
      "收件区县",
      "收件地址",
      "物品名称",
      "物品类型",
      "物品数量",
      "物品重量(kg)",
      "物品体积(m³)",
      "物品件数",
      "服务类型",
      "支付方式",
      "代收金额",
      "保价金额",
      "备注",
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "订单导入模板");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="orders_import_template.xlsx"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "生成模板失败" },
      { status: 500 }
    );
  }
}