import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });

    const rows = orders.map((order) => ({
      运单号: order.trackingNumber || "",
      客户单号: order.customerOrderNumber || "",
      客户编号: order.customerCode || "",
      客户名称: order.customerName || "",
      寄件人: order.senderName || "",
      寄件人手机: order.senderPhone || "",
      寄件公司: order.senderCompany || "",
      寄件省份: order.senderProvince || "",
      寄件城市: order.senderCity || "",
      寄件区县: order.senderDistrict || "",
      寄件地址: order.senderAddress || "",
      收件人: order.receiverName || "",
      收件人手机: order.receiverPhone || "",
      收件公司: order.receiverCompany || "",
      收件省份: order.receiverProvince || "",
      收件城市: order.receiverCity || "",
      收件区县: order.receiverDistrict || "",
      收件地址: order.receiverAddress || "",
      物品名称: order.goodsName || "",
      物品类型: order.goodsType || "",
      物品数量: order.goodsQuantity,
      物品重量: order.goodsWeight,
      物品体积: order.goodsVolume,
      物品件数: order.goodsPieces,
      服务类型: order.serviceType || "",
      支付方式: order.paymentType || "",
      代收金额: order.collectionAmount,
      保价金额: order.insuredAmount,
      备注: order.remark || "",
      状态: order.status,
      创建时间: order.createdAt.toISOString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "订单数据");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="orders_export.xlsx"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: "导出订单失败" },
      { status: 500 }
    );
  }
}