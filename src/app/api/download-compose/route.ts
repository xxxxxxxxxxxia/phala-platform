import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    // 读取public目录下的docker-compose.yaml文件
    const filePath = join(process.cwd(), 'public', 'docker-compose.yaml');
    const fileContent = readFileSync(filePath, 'utf8');
    
    // 设置响应头，让浏览器下载文件
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-yaml',
        'Content-Disposition': 'attachment; filename="docker-compose.yml"',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('下载docker-compose.yml失败:', error);
    return NextResponse.json(
      { error: '文件不存在或读取失败' },
      { status: 404 }
    );
  }
}

