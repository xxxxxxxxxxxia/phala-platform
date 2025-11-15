import { NextRequest, NextResponse } from 'next/server';

/**
 * Worker响应状态检查API
 * 代理请求到worker的pRuntime服务，避免CORS问题
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint');
        const target = searchParams.get('target');

        if (!endpoint || !target) {
            return NextResponse.json(
                { error: 'Missing endpoint or target parameter' },
                { status: 400 }
            );
        }

        // 构建worker URL - target已经是完整的URL（例如 http://8.147.107.221:18000）
        const workerUrl = `${target}${endpoint}`;

        console.log(`[Worker Response API] 检查: ${workerUrl}`);
        console.log(`[Worker Response API] 参数 - endpoint: ${endpoint}, target: ${target}`);

        // 获取worker响应
        const response = await fetch(workerUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(5000), // 5秒超时
        });

        console.log(`[Worker Response API] 响应状态码: ${response.status}, ok: ${response.ok}`);

        if (!response.ok) {
            console.error(`[Worker Response API] 请求失败: ${response.status}`);
            return NextResponse.json(
                { error: `Worker request failed: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log(`[Worker Response API] 成功获取数据:`, {
            initialized: data.initialized,
            registered: data.registered,
            version: data.version,
            blocknum: data.blocknum
        });

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[Worker Response API] 错误:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to check worker response' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint');
        const target = searchParams.get('target');

        if (!endpoint || !target) {
            return NextResponse.json(
                { error: 'Missing endpoint or target parameter' },
                { status: 400 }
            );
        }

        // 构建worker URL - target已经是完整的URL（例如 http://8.147.107.221:18000）
        const workerUrl = `${target}${endpoint}`;

        console.log(`[Worker Response API] POST请求: ${workerUrl}`);
        console.log(`[Worker Response API] 参数 - endpoint: ${endpoint}, target: ${target}`);

        // 获取请求体
        const body = await request.json().catch(() => ({}));

        // 获取worker响应（使用POST方法）
        const response = await fetch(workerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000), // 10秒超时
        });

        console.log(`[Worker Response API] 响应状态码: ${response.status}, ok: ${response.ok}`);

        if (!response.ok) {
            console.error(`[Worker Response API] 请求失败: ${response.status}`);
            const errorText = await response.text();
            console.error(`[Worker Response API] 错误响应: ${errorText}`);
            return NextResponse.json(
                { error: `Worker request failed: ${response.status}`, details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log(`[Worker Response API] 成功获取数据`);

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[Worker Response API] POST错误:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to check worker response' },
            { status: 500 }
        );
    }
}
