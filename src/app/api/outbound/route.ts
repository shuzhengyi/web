import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const externalCode = searchParams.get("externalCode");
    const status = searchParams.get("status");
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");

    const where: any = {};

    if (externalCode) {
      where.externalCode = { contains: externalCode, mode: 'insensitive' };
    }

    if (status) {
      where.status = status;
    }

    if (startTime || endTime) {
      where.createdAt = {};
      if (startTime) {
        where.createdAt.gte = new Date(startTime);
      }
      if (endTime) {
        where.createdAt.lte = new Date(endTime);
      }
    }

    const [outbounds, total] = await Promise.all([
      prisma.outboundOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { items: true },
      }),
      prisma.outboundOrder.count({ where }),
    ]);

    return NextResponse.json({
      outbounds,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('获取出库单失败:', error);
    return NextResponse.json({ error: "获取出库单失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      externalCode,
      storeName,
      receiverName,
      receiverPhone,
      receiverAddress,
      remark,
      items,
    } = body;

    if (!externalCode) {
      return NextResponse.json({ error: "外部编码不能为空" }, { status: 400 });
    }

    const outbound = await prisma.outboundOrder.create({
      data: {
        externalCode,
        storeName,
        receiverName,
        receiverPhone,
        receiverAddress,
        remark,
        status: 'pending',
        items: items ? {
          create: items.map((item: any) => ({
            skuCode: item.skuCode,
            skuName: item.skuName,
            quantity: item.quantity,
            specification: item.specification,
            remark: item.remark,
          })),
        } : undefined,
      },
      include: { items: true },
    });

    return NextResponse.json({
      success: true,
      message: "出库单创建成功",
      outbound,
    });
  } catch (error) {
    console.error('创建出库单失败:', error);
    return NextResponse.json({ error: "创建出库单失败" }, { status: 500 });
  }
}
