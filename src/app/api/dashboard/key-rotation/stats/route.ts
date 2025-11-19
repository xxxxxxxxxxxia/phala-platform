import { NextRequest, NextResponse } from 'next/server';
import { getApi } from '@/lib/phalaApi';

// 获取密钥轮换统计
export async function GET(request: NextRequest) {
    try {
        const api = await getApi();
        const header = await api.rpc.chain.getHeader();
        const currentBlock = header.number.toNumber();

        // 获取密钥轮换状态
        const rotationResponse = await fetch(`${request.nextUrl.origin}/api/key-rotation?action=status`);
        if (!rotationResponse.ok) {
            throw new Error(`Key rotation API 响应异常: ${rotationResponse.status}`);
        }
        const rotationData = await rotationResponse.json();

        const totalKeys = rotationData?.keys?.length || 0;
        const activeKeys = rotationData?.keys?.filter((k: any) => k.status === 'active').length || 0;
        const rotatingKeys = rotationData?.keys?.filter((k: any) => k.status === 'rotating').length || 0;
        const pendingMessages = (rotationData?.keys || []).reduce(
            (sum: number, key: any) => sum + (key?.pendingMessages || 0),
            0
        );
        const gatekeeperKeys = (rotationData?.keys || []).filter(
            (key: any) => typeof key?.keyId === 'string' && key.keyId.startsWith('GK_')
        ).length;
        const keySamples = (rotationData?.keys || [])
            .map((key: any) => ({
                id: key?.id || key?.keyId,
                keyId: key?.keyId,
                keyType: key?.keyType,
                owner: key?.owner,
                algorithm: key?.algorithm,
                pendingMessages: key?.pendingMessages || 0,
                status: key?.status || 'active',
                publicKey: key?.publicKey,
            }));

        // 估算下次轮换（简化处理）
        const rotationInterval = 100000; // 每10万个区块
        const lastRotationBlock = Math.floor(currentBlock / rotationInterval) * rotationInterval;
        const nextRotationBlock = lastRotationBlock + rotationInterval;
        const estimatedTime = (nextRotationBlock - currentBlock) * 6; // 假设6秒一个区块

        return NextResponse.json({
            success: true,
            data: {
                totalKeys,
                activeKeys,
                rotatingKeys,
                lastRotation: {
                    blockNumber: lastRotationBlock,
                    timestamp: Date.now() - (currentBlock - lastRotationBlock) * 6000
                },
                nextRotation: {
                    estimatedBlock: nextRotationBlock,
                    estimatedTime,
                    estimatedSeconds: Math.max(estimatedTime, 0),
                },
                overview: {
                    pendingMessages,
                    gatekeeperKeys,
                    keySamples,
                },
            }
        });
    } catch (error) {
        console.error('Key rotation stats API error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

