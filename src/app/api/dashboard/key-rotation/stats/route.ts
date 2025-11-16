import { NextRequest, NextResponse } from 'next/server';
import { getApi } from '@/lib/phalaApi';

// 获取密钥轮换统计
export async function GET(request: NextRequest) {
    try {
        let api;
        let currentBlock = 0;

        try {
            api = await getApi();
            const header = await api.rpc.chain.getHeader();
            currentBlock = header.number.toNumber();
        } catch (apiError) {
            console.error('Failed to get API:', apiError);
            return NextResponse.json({
                success: true,
                data: {
                    totalKeys: 0,
                    activeKeys: 0,
                    rotatingKeys: 0,
                    lastRotation: { blockNumber: 0, timestamp: 0 },
                    nextRotation: { estimatedBlock: 0, estimatedTime: 0 }
                }
            });
        }

        // 获取密钥轮换状态
        const rotationResponse = await fetch(`${request.nextUrl.origin}/api/key-rotation?action=status`);
        let rotationData = null;
        if (rotationResponse.ok) {
            rotationData = await rotationResponse.json();
        }

        const totalKeys = rotationData?.keys?.length || 0;
        const activeKeys = rotationData?.keys?.filter((k: any) => k.status === 'active').length || 0;
        const rotatingKeys = rotationData?.keys?.filter((k: any) => k.status === 'rotating').length || 0;

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
                    estimatedTime
                }
            }
        });
    } catch (error) {
        console.error('Key rotation stats API error:', error);
        return NextResponse.json({
            success: true,
            data: {
                totalKeys: 0,
                activeKeys: 0,
                rotatingKeys: 0,
                lastRotation: { blockNumber: 0, timestamp: 0 },
                nextRotation: { estimatedBlock: 0, estimatedTime: 0 }
            }
        });
    }
}


