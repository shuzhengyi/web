import { NextResponse } from 'next/server';
import { ParseEngine } from '@/lib/parse-engine';
import { detectExcelFormat } from '@/lib/zhipu-ai';

// 动态导入 file-parser，避免 pdf-parse 在模块加载时导致 DOMMatrix 错误
// import { parseFile, analyzeFileWithAI, detectFileType, type FileType } from '@/lib/file-parser';

export async function POST(request: Request) {
  try {
    // 动态导入 file-parser
    const { parseFile, analyzeFileWithAI, detectFileType } = await import('@/lib/file-parser');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: '请选择文件' }, { status: 400 });
    }

    // 检查文件是否为空
    if (file.size === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '文件为空' 
      }, { status: 400 });
    }

    // 检测文件类型
    const fileType = detectFileType(file);
    
    if (!fileType) {
      return NextResponse.json({ 
        success: false, 
        error: '不支持的文件格式' 
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 使用统一的文件解析器
    const parseResult = await parseFile(file, buffer);

    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: parseResult.error,
        errorType: parseResult.errorType,
        filePreview: parseResult.preview || '',
      });
    }

    // 使用 AI 分析文件内容并生成推荐规则
    const aiResult = await analyzeFileWithAI(
      fileType,
      parseResult.content || '',
      parseResult.structuredData
    );

    if (aiResult.success && aiResult.suggestedRule) {
      return NextResponse.json({
        success: true,
        suggestedRule: aiResult.suggestedRule,
        filePreview: parseResult.preview || '',
        structuredData: parseResult.structuredData,
      });
    }

    // AI 分析失败，返回基本信息让用户手动配置
    return NextResponse.json({
      success: false,
      error: aiResult.error || 'AI 分析失败，请手动配置规则',
      filePreview: parseResult.preview || '',
      structuredData: parseResult.structuredData,
    });
  } catch (error) {
    console.error('分析文件失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: `分析文件失败：${error instanceof Error ? error.message : '未知错误'}` 
    }, { status: 500 });
  }
}