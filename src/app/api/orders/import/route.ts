import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

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
    const rows = XLSX.utils.sheet_to_json(worksheet);

    const orders = rows
      .filter((row: Record<string, any>) => {
        return Object.values(row).some((val) => val && val !== "" && val !== null);
      })
      .map((row: Record<string, any>) => ({
        trackingNumber: row["运单号"] || row["trackingNumber"] || null,
        customerOrderNumber: row["客户单号"] || row["customerOrderNumber"] || null,
        customerCode: row["客户编号"] || row["customerCode"] || null,
        customerName: row["客户名称"] || row["customerName"] || null,
        senderName: row["寄件人"] || row["senderName"] || null,
        senderPhone: row["寄件人手机"] || row["senderPhone"] || null,
        senderCompany: row["寄件公司"] || row["senderCompany"] || null,
        senderProvince: row["寄件省份"] || row["senderProvince"] || null,
        senderCity: row["寄件城市"] || row["senderCity"] || null,
        senderDistrict: row["寄件区县"] || row["senderDistrict"] || null,
        senderAddress: row["寄件地址"] || row["senderAddress"] || null,
        receiverName: row["收件人"] || row["receiverName"] || null,
        receiverPhone: row["收件人手机"] || row["receiverPhone"] || null,
        receiverCompany: row["收件公司"] || row["receiverCompany"] || null,
        receiverProvince: row["收件省份"] || row["receiverProvince"] || null,
        receiverCity: row["收件城市"] || row["receiverCity"] || null,
        receiverDistrict: row["收件区县"] || row["receiverDistrict"] || null,
        receiverAddress: row["收件地址"] || row["receiverAddress"] || null,
        goodsName: row["物品名称"] || row["goodsName"] || null,
        goodsType: row["物品类型"] || row["goodsType"] || null,
        goodsQuantity: !isNaN(parseInt(row["物品数量"]?.toString() || "0")) 
          ? parseInt(row["物品数量"]?.toString() || "0") 
          : 0,
        goodsWeight: !isNaN(parseFloat(row["物品重量"]?.toString() || "0")) 
          ? parseFloat(row["物品重量"]?.toString() || "0") 
          : 0,
        goodsVolume: !isNaN(parseFloat(row["物品体积"]?.toString() || "0")) 
          ? parseFloat(row["物品体积"]?.toString() || "0") 
          : 0,
        goodsPieces: !isNaN(parseInt(row["物品件数"]?.toString() || "0")) 
          ? parseInt(row["物品件数"]?.toString() || "0") 
          : 0,
        serviceType: row["服务类型"] || row["serviceType"] || null,
        paymentType: row["支付方式"] || row["paymentType"] || null,
        collectionAmount: !isNaN(parseFloat(row["代收金额"]?.toString() || "0")) 
          ? parseFloat(row["代收金额"]?.toString() || "0") 
          : 0,
        insuredAmount: !isNaN(parseFloat(row["保价金额"]?.toString() || "0")) 
          ? parseFloat(row["保价金额"]?.toString() || "0") 
          : 0,
        remark: row["备注"] || row["remark"] || null,
        status: "pending",
      }));

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