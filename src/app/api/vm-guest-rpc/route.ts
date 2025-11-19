// src/app/api/vm-guest-rpc/route.ts
// VM Guest RPC API代理路由，解决CORS问题

import { NextRequest, NextResponse } from 'next/server';

// 统一的成功响应
function successResponse(data: any) {
    return NextResponse.json(data, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

// 统一的错误响应
function errorResponse(message: string, status: number, error?: any) {
    console.error(`[VM Guest RPC Proxy] 代理请求失败: ${message}`, error);
    return NextResponse.json(
        {
            error: message,
            message: error instanceof Error ? error.message : '未知错误',
            timestamp: Date.now()
        },
        {
            status: status,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        }
    );
}

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const host = searchParams.get('host'); // 目标主机IP
        const method = searchParams.get('method'); // Guest RPC方法名，如 'NetworkInfo'
        const port = searchParams.get('port') || '9210'; // 端口号，默认 9210
        
        // 必须提供 host 和 method
        if (!host) {
            return errorResponse('VM Guest RPC 代理错误: "host" 参数缺失', 400);
        }
        if (!method) {
            return errorResponse('VM Guest RPC 代理错误: "method" 参数缺失', 400);
        }
        
        // 构建目标 URL - guest RPC 使用 /guest/{method} 路径
        const targetUrl = `http://${host}:${port}/guest/${method}?json`;
        const body = await request.json();

        console.log(`[VM Guest RPC Proxy] 代理POST请求: ${targetUrl}`, body);

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`VM Guest RPC POST请求失败: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();

        console.log(`[VM Guest RPC Proxy] 请求成功`);

        return successResponse(data);

    } catch (error) {
        console.error('[VM Guest RPC Proxy] POST代理请求失败:', error);

        return errorResponse(
            'VM Guest RPC POST代理请求失败',
            500,
            error
        );
    }
}

// 处理OPTIONS预检请求
export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}






















