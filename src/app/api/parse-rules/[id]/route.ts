import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rule = await prisma.parseRule.findUnique({
      where: { id: parseInt(id) },
    });
    if (!rule) {
      return NextResponse.json({ success: false, error: '规则不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error('获取解析规则失败:', error);
    return NextResponse.json({ success: false, error: '获取解析规则失败' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    const rule = await prisma.parseRule.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        description: data.description,
        fileType: data.fileType,
        config: data.config,
        isActive: data.isActive,
      },
    });
    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error('更新解析规则失败:', error);
    return NextResponse.json({ success: false, error: '更新解析规则失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.parseRule.delete({
      where: { id: parseInt(id) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除解析规则失败:', error);
    return NextResponse.json({ success: false, error: '删除解析规则失败' }, { status: 500 });
  }
}
