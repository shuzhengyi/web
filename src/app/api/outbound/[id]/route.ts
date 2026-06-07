import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const outbound = await prisma.outboundOrder.findUnique({
      where: { id: parseInt(id) },
      include: { items: true },
    });

    if (!outbound) {
      return NextResponse.json({ error: "出库单不存在" }, { status: 404 });
    }

    return NextResponse.json(outbound);
  } catch (error) {
    console.error('获取出库单失败:', error);
    return NextResponse.json({ error: "获取出库单失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      externalCode,
      storeName,
      receiverName,
      receiverPhone,
      receiverAddress,
      status,
      remark,
    } = body;

    const outbound = await prisma.outboundOrder.update({
      where: { id: parseInt(id) },
      data: {
        externalCode,
        storeName,
        receiverName,
        receiverPhone,
        receiverAddress,
        status,
        remark,
      },
    });

    return NextResponse.json({
      success: true,
      message: "出库单更新成功",
      outbound,
    });
  } catch (error) {
    console.error('更新出库单失败:', error);
    return NextResponse.json({ error: "更新出库单失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.outboundOrder.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({
      success: true,
      message: "出库单删除成功",
    });
  } catch (error) {
    console.error('删除出库单失败:', error);
    return NextResponse.json({ error: "删除出库单失败" }, { status: 500 });
  }
}
