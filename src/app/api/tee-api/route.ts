// src/app/api/tee-api/route.ts
// TEE API代理路由，解决CORS问题

import { NextRequest, NextResponse } from 'next/server';

const TEE_API_URL = 'http://8.147.107.221:3001';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint') || 'api/health';

        // 构建完整的TEE API URL
        const teeApiEndpoint = `${TEE_API_URL}/${endpoint}`;

        console.log(`[TEE API Proxy] 代理请求: ${teeApiEndpoint}`);

        // 发起请求到TEE API
        const response = await fetch(teeApiEndpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`TEE API请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        console.log(`[TEE API Proxy] 请求成功，返回数据:`, data);

        // 返回数据，设置CORS头
        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });

    } catch (error) {
        console.error('[TEE API Proxy] 代理请求失败:', error);

        return NextResponse.json(
            {
                error: 'TEE API代理请求失败',
                message: error instanceof Error ? error.message : '未知错误',
                timestamp: Date.now()
            },
            {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            }
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
