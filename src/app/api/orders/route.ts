import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "10");
  const keyword = searchParams.get("keyword") || "";
  const customerOrderNumber = searchParams.get("customerOrderNumber") || "";
  const receiverName = searchParams.get("receiverName") || "";
  const startTime = searchParams.get("startTime") || "";
  const endTime = searchParams.get("endTime") || "";

  try {
    const where: any = {};
    
    if (keyword) {
      where.OR = [
        { trackingNumber: { contains: keyword, mode: "insensitive" } },
        { customerOrderNumber: { contains: keyword, mode: "insensitive" } },
        { senderName: { contains: keyword, mode: "insensitive" } },
        { receiverName: { contains: keyword, mode: "insensitive" } },
        { customerName: { contains: keyword, mode: "insensitive" } },
        { senderPhone: { contains: keyword } },
        { receiverPhone: { contains: keyword } },
      ];
    }
    
    if (customerOrderNumber) {
      where.customerOrderNumber = { contains: customerOrderNumber, mode: "insensitive" };
    }
    
    if (receiverName) {
      where.receiverName = { contains: receiverName, mode: "insensitive" };
    }
    
    if (startTime) {
      const startDate = new Date(startTime);
      if (!isNaN(startDate.getTime())) {
        where.createdAt = { ...where.createdAt, gte: startDate };
      }
    }
    
    if (endTime) {
      const endDate = new Date(endTime);
      endDate.setHours(23, 59, 59, 999);
      if (!isNaN(endDate.getTime())) {
        where.createdAt = { ...where.createdAt, lte: endDate };
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total });
  } catch (error) {
    console.error("获取订单失败:", error);
    return NextResponse.json({ error: "获取订单失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const order = await prisma.order.create({ data: body });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("创建订单失败:", error);
    return NextResponse.json({ error: "创建订单失败" }, { status: 500 });
  }
}
