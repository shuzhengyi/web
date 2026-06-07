import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ParseEngine, type ParsedItem } from '@/lib/parse-engine';
import * as XLSX from 'xlsx';

// 动态导入 file-parser，避免 pdf-parse 在模块加载时导致 DOMMatrix 错误
// import { parseFile, detectFileType, type FileType } from '@/lib/file-parser';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const mode = searchParams.get('mode');
    const skip = (page - 1) * pageSize;

    // 获取所有外部编码（用于重复检测）
    if (mode === 'external-codes') {
      try {
        const orders = await prisma.outboundOrder.findMany({
          select: { externalCode: true },
          where: { externalCode: { not: '' } },
        });
        const codes = orders.map(o => o.externalCode).filter(Boolean) as string[];
        console.log(`获取到 ${codes.length} 个外部编码`);
        return NextResponse.json({ success: true, codes });
      } catch (dbError) {
        console.error('获取外部编码失败:', dbError);
        // 如果数据库查询失败，返回空数组，不阻止导入流程
        return NextResponse.json({ success: true, codes: [] });
      }
    }

    const [orders, total] = await Promise.all([
      prisma.outboundOrder.findMany({
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.outboundOrder.count(),
    ]);

    return NextResponse.json({ success: true, orders, total });
  } catch (error) {
    console.error('获取出库单失败:', error);
    return NextResponse.json({ success: false, error: '获取出库单失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // 动态导入 file-parser，避免 pdf-parse 在模块加载时导致 DOMMatrix 错误
    const { parseFile, detectFileType } = await import('@/lib/file-parser');
    
    console.log('开始处理导入请求...');
    const formData = await request.formData();
    
    // 检查是否是预览模式（不保存到数据库）
    const previewMode = formData.get('preview') === 'true';
    console.log('预览模式:', previewMode);
    const file = formData.get('file') as File;
    const ruleId = formData.get('ruleId');
    console.log('文件:', file?.name, '规则 ID:', ruleId);

    // 文件验证
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: '请选择文件',
        errorType: 'empty'
      }, { status: 400 });
    }

    // 检查文件大小
    if (file.size === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '文件为空，请选择有效的文件',
        errorType: 'empty'
      }, { status: 400 });
    }

    // 检查文件类型
    const fileType = detectFileType(file);

    if (!fileType) {
      return NextResponse.json({ 
        success: false, 
        error: '不支持的文件格式。请上传 Excel（.xlsx/.xls）、Word（.docx）或 PDF 文件',
        errorType: 'format'
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    console.log('文件 buffer 大小:', buffer.length);
    
    let items: ParsedItem[] = [];
    let parseResult: any = null;
    let parseErrors: string[] = [];

    // 根据文件类型选择解析方式
    if (fileType === 'excel') {
      // Excel 文件解析
      if (ruleId) {
        console.log('查找规则 ID:', ruleId);
        const rule = await prisma.parseRule.findUnique({
          where: { id: parseInt(ruleId as string) },
        });
        console.log('规则找到:', !!rule);

        if (rule) {
          console.log('规则名称:', rule.name);
          console.log('规则配置:', JSON.stringify(rule.config, null, 2));
          console.log('开始解析 Excel...');
          try {
            const engine = new ParseEngine(rule.config as any);
            parseResult = engine.parseExcel(buffer);
            console.log('解析结果:', parseResult?.success, '数据条数:', parseResult?.items?.length);
            
            if (parseResult.success) {
              items = parseResult.items;
              parseErrors = parseResult.errors || [];
            } else {
              parseErrors = parseResult.errors || ['解析失败'];
            }
          } catch (parseError: any) {
            console.error('Excel 解析错误:', parseError);
            parseErrors.push(`解析错误：${parseError.message}`);
            
            // 尝试生成文件预览
            try {
              const workbook = XLSX.read(buffer);
              const sheet = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheet];
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
              const preview = jsonData.slice(0, 10).map(row => 
                row.map(cell => String(cell || '')).join('\t')
              ).join('\n');
              
              return NextResponse.json({ 
                success: false, 
                error: 'Excel 文件解析失败，请检查规则配置',
                details: parseError.message,
                errorType: 'parse',
                filePreview: preview,
                fileInfo: {
                  name: file.name,
                  size: file.size,
                  type: file.type
                }
              }, { status: 400 });
            } catch (previewError) {
              return NextResponse.json({ 
                success: false, 
                error: 'Excel 文件解析失败',
                details: parseError.message,
                errorType: 'parse'
              }, { status: 400 });
            }
          }
        } else {
          return NextResponse.json({ 
            success: false, 
            error: '找不到指定的解析规则',
            errorType: 'parse'
          }, { status: 400 });
        }
      } else {
        return NextResponse.json({ 
          success: false, 
          error: '请选择解析规则',
          errorType: 'parse'
        }, { status: 400 });
      }
    } else if (fileType === 'word' || fileType === 'pdf') {
      // Word/PDF 文件解析
      try {
        const fileParseResult = await parseFile(file, buffer);
        
        if (!fileParseResult.success) {
          return NextResponse.json({ 
            success: false, 
            error: fileParseResult.error || `${fileType === 'word' ? 'Word' : 'PDF'} 文件解析失败`,
            errorType: fileParseResult.errorType || 'parse',
            filePreview: fileParseResult.preview || '',
            fileInfo: {
              name: file.name,
              size: file.size,
              type: file.type
            }
          }, { status: 400 });
        }

        // Word/PDF 文件目前需要手动配置规则来提取数据
        // 这里返回文件内容，让用户手动配置
        return NextResponse.json({ 
          success: false, 
          error: `${fileType === 'word' ? 'Word' : 'PDF'} 文件已成功读取，但需要配置解析规则来提取数据`,
          errorType: 'parse',
          filePreview: fileParseResult.preview || '',
          fileInfo: {
            name: file.name,
            size: file.size,
            type: file.type
          }
        }, { status: 400 });
      } catch (parseError: any) {
        console.error(`${fileType} 解析错误:`, parseError);
        return NextResponse.json({ 
          success: false, 
          error: `${fileType === 'word' ? 'Word' : 'PDF'} 文件解析失败`,
          details: parseError.message,
          errorType: 'parse'
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({ 
        success: false, 
        error: '不支持的文件类型',
        errorType: 'format'
      }, { status: 400 });
    }

    console.log('准备保存历史记录...');
    
    // 预览模式：只返回解析结果，不保存到数据库
    if (previewMode) {
      console.log('预览模式，不保存到数据库');
      return NextResponse.json({
        success: true,
        preview: true,
        items,
        warnings: parseResult?.warnings || [],
        errors: parseErrors,
      });
    }
    
    // 正常模式：保存到数据库
    const history = await prisma.parseHistory.create({
      data: {
        ruleId: ruleId ? parseInt(ruleId as string) : null,
        fileName: file.name,
        fileType: fileType,
        status: items.length > 0 ? 'success' : 'failed',
        successCount: items.length,
        failCount: parseErrors.length,
        errorMessage: parseErrors.join('; ') || null,
        parsedData: items as any,
      },
    });
    console.log('历史记录保存成功:', history.id);

    if (items.length > 0) {
      console.log('开始保存出库单...');
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
    }

    console.log('导入完成，返回结果');
    return NextResponse.json({
      success: true,
      history,
      items,
      warnings: parseResult?.warnings || [],
    });
  } catch (error) {
    console.error('导入出库单失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    const errorStack = error instanceof Error ? error.stack : '无堆栈信息';
    console.error('错误详情:', errorMessage);
    console.error('错误堆栈:', errorStack);
    return NextResponse.json({ 
      success: false, 
      error: '导入出库单失败',
      details: errorMessage,
      stack: errorStack,
      errorType: 'unknown'
    }, { status: 500 });
  }
}
