// src/app/api/pruntime-proxy/route.ts
// Pruntime API代理路由，解决CORS问题

import { NextRequest, NextResponse } from 'next/server';

//const PRUNTIME_URL = 'http://8.147.107.221:18000';

// 从请求中动态获取目标 URL
function getTargetUrl(request: NextRequest): { target: string | null, endpoint: string } {
    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target'); // <-- [修改] 读取 'target' 参数
    const endpoint = searchParams.get('endpoint') || 'prpc/PhactoryAPI.GetInfo';
    return { target, endpoint };
}

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
    console.error(`[Pruntime Proxy] 代理请求失败: ${message}`, error);
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

export async function GET(request: NextRequest) {
    try {
        //const { searchParams } = new URL(request.url);
        //const endpoint = searchParams.get('endpoint') || 'prpc/PhactoryAPI.GetInfo';
        const { target, endpoint } = getTargetUrl(request); //+++
        // [修改] 必须提供 target
        if (!target) {
            return errorResponse('Pruntime 代理错误: "target" URL 参数缺失', 400);
        }
        
        // [修改] 构建动态的 pruntime URL
        const pruntimeEndpoint = `${target}/${endpoint}`;

        // 构建完整的pruntime URL
        //const pruntimeEndpoint = `${PRUNTIME_URL}/${endpoint}`;

        console.log(`[Pruntime Proxy] 代理请求: ${pruntimeEndpoint}`);

        // 发起请求到pruntime
        const response = await fetch(pruntimeEndpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Pruntime请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        console.log(`[Pruntime Proxy] 请求成功，返回数据:`, {
            initialized: data.initialized,
            registered: data.registered,
            version: data.version,
            blocknum: data.blocknum
        });

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
        console.error('[Pruntime Proxy] 代理请求失败:', error);

        return NextResponse.json(
            {
                error: 'Pruntime代理请求失败',
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

export async function POST(request: NextRequest) {
    try {
        //const { searchParams } = new URL(request.url);
        //const endpoint = searchParams.get('endpoint') || 'prpc/PhactoryAPI.GetInfo';
        const { target, endpoint } = getTargetUrl(request); //++

        // [修改] 必须提供 target +++
        if (!target) {
            return errorResponse('Pruntime 代理错误: "target" URL 参数缺失', 400);
        }
        
        //const pruntimeEndpoint = `${PRUNTIME_URL}/${endpoint}`;
        // [修改] 构建动态的 pruntime URL
        const pruntimeEndpoint = `${target}/${endpoint}`;
        const body = await request.json();

        console.log(`[Pruntime Proxy] 代理POST请求: ${pruntimeEndpoint}`);

        const response = await fetch(pruntimeEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Pruntime POST请求失败: ${response.status} ${response.statusText}  (访问 ${target})`);
        }

        const data = await response.json();

        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });

    } catch (error) {
        console.error('[Pruntime Proxy] POST代理请求失败:', error);

        return NextResponse.json(
            {
                error: 'Pruntime POST代理请求失败',
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
