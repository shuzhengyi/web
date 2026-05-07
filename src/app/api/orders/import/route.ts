import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

interface ExcelRow {
  [key: string]: unknown;
}

function generateTrackingNumber(): string {
  const prefix = "YT";
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${dateStr}${timeStr}${random}`;
}

function parseString(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  return String(val);
}

function parseNumber(val: unknown): number {
  const num = parseFloat(String(val));
  return isNaN(num) ? 0 : num;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];

    const orders = [];
    for (const row of rows) {
      const hasData = Object.values(row).some(
        (val) => val !== null && val !== undefined && val !== ""
      );
      if (!hasData) continue;

      const existingTrackingNumber = parseString(row["运单号"] || row["trackingNumber"]);
      
      orders.push({
        trackingNumber: existingTrackingNumber || generateTrackingNumber(),
        customerOrderNumber: parseString(row["客户单号"] || row["customerOrderNumber"]),
        customerCode: parseString(row["客户编号"] || row["customerCode"]),
        customerName: parseString(row["客户名称"] || row["customerName"]),
        senderName: parseString(row["寄件人"] || row["senderName"]),
        senderPhone: parseString(row["寄件人手机"] || row["senderPhone"]),
        senderCompany: parseString(row["寄件公司"] || row["senderCompany"]),
        senderProvince: parseString(row["寄件省份"] || row["senderProvince"]),
        senderCity: parseString(row["寄件城市"] || row["senderCity"]),
        senderDistrict: parseString(row["寄件区县"] || row["senderDistrict"]),
        senderAddress: parseString(row["寄件地址"] || row["senderAddress"]),
        receiverName: parseString(row["收件人"] || row["receiverName"]),
        receiverPhone: parseString(row["收件人手机"] || row["receiverPhone"]),
        receiverCompany: parseString(row["收件公司"] || row["receiverCompany"]),
        receiverProvince: parseString(row["收件省份"] || row["receiverProvince"]),
        receiverCity: parseString(row["收件城市"] || row["receiverCity"]),
        receiverDistrict: parseString(row["收件区县"] || row["receiverDistrict"]),
        receiverAddress: parseString(row["收件地址"] || row["receiverAddress"]),
        goodsName: parseString(row["物品名称"] || row["goodsName"]),
        goodsType: parseString(row["物品类型"] || row["goodsType"]),
        goodsQuantity: Math.round(parseNumber(row["物品数量"] || row["goodsQuantity"])),
        goodsWeight: parseNumber(row["物品重量"] || row["goodsWeight"]),
        goodsVolume: parseNumber(row["物品体积"] || row["goodsVolume"]),
        goodsPieces: Math.round(parseNumber(row["物品件数"] || row["goodsPieces"])),
        serviceType: parseString(row["服务类型"] || row["serviceType"]),
        paymentType: parseString(row["支付方式"] || row["paymentType"]),
        collectionAmount: parseNumber(row["代收金额"] || row["collectionAmount"]),
        insuredAmount: parseNumber(row["保价金额"] || row["insuredAmount"]),
        remark: parseString(row["备注"] || row["remark"]),
        status: "pending",
      });
    }

    if (orders.length === 0) {
      return NextResponse.json({ error: "没有找到有效数据" }, { status: 400 });
    }

    await prisma.order.createMany({ data: orders });

    return NextResponse.json({ success: true, count: orders.length });
  } catch (error) {
    console.error("导入订单失败:", error);
    return NextResponse.json({ error: `导入订单失败: ${(error as Error).message}` }, { status: 500 });
  }
}