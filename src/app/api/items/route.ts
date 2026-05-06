import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.item.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.item.count(),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "获取数据失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, category, quantity, price, description, status } = body;

    if (!name) {
      return NextResponse.json(
        { error: "名称不能为空" },
        { status: 400 }
      );
    }

    const item = await prisma.item.create({
      data: {
        name,
        category: category || null,
        quantity: quantity || 0,
        price: price || 0,
        description: description || null,
        status: status || "active",
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "创建数据失败" },
      { status: 500 }
    );
  }
}
