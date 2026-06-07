import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const rules = await prisma.parseRule.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ success: true, rules });
  } catch (error) {
    console.error('获取解析规则失败:', error);
    return NextResponse.json({ success: false, error: '获取解析规则失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const rule = await prisma.parseRule.create({
      data: {
        name: data.name,
        description: data.description || '',
        fileType: data.fileType || 'excel',
        config: data.config || {},
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error('创建解析规则失败:', error);
    return NextResponse.json({ success: false, error: '创建解析规则失败' }, { status: 500 });
  }
}
