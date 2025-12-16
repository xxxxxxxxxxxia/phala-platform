import { NextRequest, NextResponse } from 'next/server';

const KMS_BASE_URL = 'http://43.132.154.142:13002/prpc';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint, data } = body;

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: '缺少endpoint参数' },
        { status: 400 }
      );
    }

    // 调用 KMS API
    const response = await fetch(`${KMS_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data || {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          success: false, 
          error: `KMS API 请求失败: ${response.status} ${response.statusText}`,
          details: errorText
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('KMS Proxy Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '代理请求失败' 
      },
      { status: 500 }
    );
  }
}
