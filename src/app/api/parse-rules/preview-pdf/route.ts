import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: '请上传文件',
      }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    
    // 使用 Buffer.from 转换为 Node.js Buffer
    const nodeBuffer = Buffer.from(buffer);
    
    // 动态导入 file-parser，使用已有的 parsePdf 函数
    const { parsePdf } = await import('@/lib/file-parser');
    const result = await parsePdf(nodeBuffer);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'PDF 文件解析失败',
      });
    }

    const structuredData = result.structuredData as any;
    if (!structuredData) {
      return NextResponse.json({
        success: false,
        error: 'PDF 文件解析结果为空',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        rows: structuredData.rows || [],
        headers: structuredData.headers || [],
        headerSection: structuredData.headerSection || [],
        dataSection: structuredData.dataSection || [],
        footerSection: structuredData.footerSection || [],
        headerRow: structuredData.headerRow || 1,
      },
    });
  } catch (error) {
    console.error('PDF 预览解析失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({
      success: false,
      error: `PDF 解析失败: ${errorMessage}`,
    }, { status: 500 });
  }
}
