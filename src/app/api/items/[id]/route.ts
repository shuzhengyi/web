import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, category, quantity, price, description, status } = body;

    const item = await prisma.item.update({
      where: { id: parseInt(id, 10) },
      data: {
        name,
        category: category || null,
        quantity: quantity ?? 0,
        price: price ?? 0,
        description: description || null,
        status: status || "active",
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json(
      { error: "更新数据失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.item.delete({
      where: { id: parseInt(id, 10) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "删除数据失败" },
      { status: 500 }
    );
  }
}
