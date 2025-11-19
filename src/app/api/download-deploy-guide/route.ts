import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(request: NextRequest) {
  try {
    // 读取部署手册文件
    const filePath = join(process.cwd(), 'docs', '部署手册.md');
    
    // 检查文件是否存在
    if (!existsSync(filePath)) {
      console.error('文件不存在:', filePath);
      console.error('当前工作目录:', process.cwd());
      return NextResponse.json(
        { error: `文件未找到: ${filePath}` },
        { status: 404 }
      );
    }
    
    const fileContent = await readFile(filePath, 'utf-8');
    
    // 对文件名进行 URL 编码，解决中文文件名问题
    const encodedFilename = encodeURIComponent('部署手册.md');
    
    // 返回文件内容，设置正确的响应头
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('下载部署手册失败:', error);
    return NextResponse.json(
      { error: `读取文件失败: ${error.message || error}` },
      { status: 500 }
    );
  }
}


