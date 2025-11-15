import { NextRequest, NextResponse } from 'next/server';
import { getTeeApiUrl } from '@/lib/config';

export async function GET(request: NextRequest) {
    try {
        const teeApiUrl = getTeeApiUrl();
        console.log('---[调试] TEE API URL:', teeApiUrl);
        console.log('---[调试] Full Request URL:', `${teeApiUrl}/vm/status`);

        const response = await fetch(`${teeApiUrl}/vm/status`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        console.log('---[调试] 响应状态:', response.status, response.statusText);
        console.log('---[调试] 响应头:', JSON.stringify([...response.headers.entries()]));

        let respText;
        try {
            respText = await response.text();
            console.log('---[调试] 响应body:', respText);
        } catch (err) {
            console.error('---[调试] 解析响应body失败:', err);
        }

        // 重新构造response对象进行JSON处理
        let data = null;
        try {
            data = respText ? JSON.parse(respText) : null;
        } catch (err) {
            console.error('---[调试] JSON.parse 响应body失败:', err, 'body:', respText);
        }

        if (!response.ok || !data) {
            console.error('---[调试] BackEnd response not ok or无数据:', respText);
            throw new Error(`Backend API error: ${response.status} - ${respText}`);
        }

        // 打印拿到的data
        console.log('---[调试] 成功获取 VM status data:', data);
        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    } catch (error) {
        console.error('---[调试] Error in proxy/vm/status:', error);
        console.error('---[调试] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        return NextResponse.json(
            {
                error: 'Failed to fetch VM status',
                details: error instanceof Error ? error.message : 'Unknown error'
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
