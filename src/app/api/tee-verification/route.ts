import { NextRequest, NextResponse } from 'next/server';

const TEE_API_BASE_URL = 'http://8.147.106.136:3001/api'; // TEE API服务地址

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint');

        if (!endpoint) {
            return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
        }

        // 构建完整的URL，包括查询参数
        const url = new URL(`${TEE_API_BASE_URL}/${endpoint}`);
        // 将原始请求的查询参数传递给TEE API
        for (const [key, value] of searchParams.entries()) {
            if (key !== 'endpoint') { // 排除endpoint参数
                url.searchParams.set(key, value);
            }
        }
        const fullUrl = url.toString();

        console.log(`[TEE Verification Proxy] GET请求: ${fullUrl}`);

        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(180000) // 180秒超时
        });

        // 检查是否是文件下载请求
        if (endpoint === 'attestation/download') {
            const filename = searchParams.get('filename');

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`TEE API下载请求失败: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const fileData = await response.arrayBuffer();

            return new NextResponse(fileData, {
                status: 200,
                headers: {
                    'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }

        if (!response.ok) {
            throw new Error(`TEE API请求失败: ${response.status} ${response.statusText}`);
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
        console.error('[TEE Verification Proxy] GET请求失败:', error);
        return NextResponse.json(
            {
                error: 'TEE Verification代理请求失败',
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
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint');

        if (!endpoint) {
            return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
        }

        const fullUrl = `${TEE_API_BASE_URL}/${endpoint}`;

        // 尝试解析请求体，如果没有body则使用空对象
        let body = {};
        try {
            const text = await request.text();
            if (text) {
                body = JSON.parse(text);
            }
        } catch (error) {
            console.log(`[TEE Verification Proxy] 无法解析请求体，使用空对象`);
        }

        console.log(`[TEE Verification Proxy] POST请求: ${fullUrl}`);

        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120000) // 120秒超时
        });

        if (!response.ok) {
            throw new Error(`TEE API POST请求失败: ${response.status} ${response.statusText}`);
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
        console.error('[TEE Verification Proxy] POST请求失败:', error);
        return NextResponse.json(
            {
                error: 'TEE Verification POST代理请求失败',
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
