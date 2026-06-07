import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await prisma.outboundOrder.findUnique({
      where: { id: parseInt(id) },
      include: { items: true },
    });
    
    if (!order) {
      return NextResponse.json({ success: false, error: '出库单不存在' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('获取出库单失败:', error);
    return NextResponse.json({ success: false, error: '获取出库单失败' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    const order = await prisma.outboundOrder.update({
      where: { id: parseInt(id) },
      data: {
        status: data.status,
        remark: data.remark,
      },
    });
    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('更新出库单失败:', error);
    return NextResponse.json({ success: false, error: '更新出库单失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.outboundOrder.delete({
      where: { id: parseInt(id) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除出库单失败:', error);
    return NextResponse.json({ success: false, error: '删除出库单失败' }, { status: 500 });
  }
}
