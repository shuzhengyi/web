import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { ParsedItem } from '@/lib/parse-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, fileName, fileType, ruleId } = body as {
      items: ParsedItem[];
      fileName?: string;
      fileType?: string;
      ruleId?: string | number;
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '没有数据需要保存' 
      }, { status: 400 });
    }

    console.log('开始保存数据，条数:', items.length);

    // 将 ruleId 转换为整数
    const parsedRuleId = typeof ruleId === 'string' ? parseInt(ruleId, 10) : ruleId;

    // 保存历史记录
    const history = await prisma.parseHistory.create({
      data: {
        ruleId: parsedRuleId || null,
        fileName: fileName || 'unknown',
        fileType: fileType || 'excel',
        status: 'success',
        successCount: items.length,
        failCount: 0,
        errorMessage: null,
        parsedData: items as any,
      },
    });
    console.log('历史记录保存成功:', history.id);

    // 按 externalCode 分组
    const grouped = new Map<string, ParsedItem[]>();
    for (const item of items) {
      const key = item.externalCode || '_default_';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }
    console.log('分组结果:', grouped.size, '个单据');

    // 保存出库单
    for (const [externalCode, codeItems] of grouped) {
      if (codeItems.length === 0) continue;

      const firstItem = codeItems[0];
      console.log('创建出库单:', externalCode);
      const order = await prisma.outboundOrder.create({
        data: {
          externalCode: externalCode === '_default_' ? `ORDER_${Date.now()}` : externalCode,
          storeName: firstItem.storeName,
          receiverName: firstItem.receiverName,
          receiverPhone: firstItem.receiverPhone,
          receiverAddress: firstItem.receiverAddress,
          status: 'pending',
          remark: '',
          items: {
            create: codeItems.map(item => ({
              skuCode: item.skuCode,
              skuName: item.skuName,
              quantity: item.quantity,
              specification: item.specification,
              remark: item.remark,
            })),
          },
        },
      });
      console.log('出库单创建成功:', order.id);
    }

    console.log('保存完成');
    return NextResponse.json({
      success: true,
      history,
      savedCount: items.length,
    });
  } catch (error) {
    console.error('保存数据失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({ 
      success: false, 
      error: `保存数据失败: ${errorMessage}` 
    }, { status: 500 });
  }
}