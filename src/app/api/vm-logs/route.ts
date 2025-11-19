// src/app/api/vm-logs/route.ts
// VM 日志代理路由：在服务端拉取 9210 端口的日志文本，避免 X-Frame-Options 限制

import { NextRequest, NextResponse } from 'next/server';

function textResponse(body: string, status = 200) {
    return new NextResponse(body, {
        status,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            // 允许在前端页面中以任意形式展示（包括 iframe 或 <pre>），不透传上游的安全头
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

function errorJson(message: string, status: number, error?: any) {
    console.error('[VM Logs Proxy] 请求失败:', message, error);
    return NextResponse.json(
        {
            error: message,
            message: error instanceof Error ? error.message : '未知错误',
            timestamp: Date.now(),
        },
        {
            status,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        }
    );
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const host = searchParams.get('host'); // 目标主机 IP
        const id = searchParams.get('id'); // VM ID
        const follow = searchParams.get('follow') ?? 'true';
        const ansi = searchParams.get('ansi') ?? 'false';
        const lines = searchParams.get('lines') ?? '200';
        const ch = searchParams.get('ch') ?? undefined; // stdout / stderr
        const port = searchParams.get('port') || '9210';

        if (!host) {
            return errorJson('VM Logs 代理错误: "host" 参数缺失', 400);
        }
        if (!id) {
            return errorJson('VM Logs 代理错误: "id" 参数缺失', 400);
        }

        const logParams = new URLSearchParams({
            id,
            follow,
            ansi,
            lines,
        });
        if (ch) {
            logParams.set('ch', ch);
        }

        const targetUrl = `http://${host}:${port}/logs?${logParams.toString()}`;
        console.log('[VM Logs Proxy] 请求日志:', targetUrl);

        const upstream = await fetch(targetUrl, { cache: 'no-store' });

        if (!upstream.ok) {
            const errorText = await upstream.text();
            throw new Error(`上游日志服务请求失败: ${upstream.status} ${upstream.statusText} - ${errorText}`);
        }

        const shouldStream = follow === 'true';

        if (shouldStream && upstream.body) {
            const headers = new Headers({
                'Content-Type': 'text/plain; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            });
            return new NextResponse(upstream.body, {
                status: 200,
                headers,
            });
        }

        const bodyText = await upstream.text();
        return textResponse(bodyText, 200);
    } catch (error) {
        return errorJson('VM Logs 代理请求失败', 500, error);
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}


