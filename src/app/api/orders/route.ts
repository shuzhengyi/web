import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "10");
  const keyword = searchParams.get("keyword") || "";

  try {
    const where = keyword
      ? {
          OR: [
            { trackingNumber: { contains: keyword } },
            { customerOrderNumber: { contains: keyword } },
            { senderName: { contains: keyword } },
            { receiverName: { contains: keyword } },
            { customerName: { contains: keyword } },
          ],
        }
      : {};

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
  } catch {
    return NextResponse.json({ error: "获取订单失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const order = await prisma.order.create({ data: body });
    return NextResponse.json(order, { status: 201 });
  } catch {
    return NextResponse.json({ error: "创建订单失败" }, { status: 500 });
  }
}