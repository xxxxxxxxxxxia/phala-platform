// src/app/api/node-health/route.ts
// 区块链节点健康检查代理路由，解决CORS问题

import { NextRequest, NextResponse } from 'next/server';

const NODE_URL = 'http://8.147.107.221:19944';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint') || 'health';

        // 构建完整的节点URL
        const nodeEndpoint = `${NODE_URL}/${endpoint}`;

        console.log(`[Node Health Proxy] 代理请求: ${nodeEndpoint}`);

        // 发起请求到区块链节点
        const response = await fetch(nodeEndpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`节点健康检查失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        console.log(`[Node Health Proxy] 请求成功，返回数据:`, data);

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
        console.error('[Node Health Proxy] 代理请求失败:', error);

        return NextResponse.json(
            {
                error: '节点健康检查代理请求失败',
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
