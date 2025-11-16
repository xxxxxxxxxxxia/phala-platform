import { NextRequest, NextResponse } from 'next/server';
import { getApi } from '@/lib/phalaApi';

// 获取最新交易列表
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');

        let api;
        try {
            api = await getApi();
        } catch (apiError) {
            console.error('Failed to get API:', apiError);
            return NextResponse.json({
                success: true,
                data: { transactions: [] }
            });
        }

        let header;
        let latestBlockNumber = 0;
        try {
            header = await api.rpc.chain.getHeader();
            latestBlockNumber = header.number.toNumber();
        } catch (headerError) {
            console.error('Failed to get header:', headerError);
            return NextResponse.json({
                success: true,
                data: { transactions: [] }
            });
        }

        const transactions = [];
        const blockNumbers = Array.from({ length: Math.min(limit * 2, latestBlockNumber + 1) }, (_, i) =>
            latestBlockNumber - i
        );

        // 限制处理时间，避免超时
        const maxBlocks = Math.min(blockNumbers.length, 5);
        for (let i = 0; i < maxBlocks; i++) {
            if (transactions.length >= limit) break;
            const blockNum = blockNumbers[i];

            try {
                const blockHash = await Promise.race([
                    api.rpc.chain.getBlockHash(blockNum),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                ]) as any;
                const signedBlock = await Promise.race([
                    api.rpc.chain.getBlock(blockHash),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                ]) as any;

                // 查找时间戳
                let timestamp = Date.now() - (latestBlockNumber - blockNum) * 6000;
                const timestampExtrinsic = signedBlock.block.extrinsics.find(
                    (ext: any) => ext.method.section === 'timestamp' && ext.method.method === 'set'
                );
                if (timestampExtrinsic) {
                    const tsArg = timestampExtrinsic.args?.[0]?.toJSON();
                    if (typeof tsArg === 'number') {
                        timestamp = tsArg;
                    } else if (typeof tsArg === 'string') {
                        timestamp = parseInt(tsArg);
                    }
                }

                // 处理每个extrinsic作为交易
                signedBlock.block.extrinsics.forEach((extrinsic: any, index: number) => {
                    if (transactions.length >= limit) return;

                    // 跳过系统extrinsic
                    if (extrinsic.method.section === 'timestamp' || extrinsic.method.section === 'parachainSystem') {
                        return;
                    }

                    const txHash = extrinsic.hash?.toHex() || `0x${blockNum}${index}`;

                    transactions.push({
                        hash: txHash,
                        blockNumber: blockNum,
                        from: extrinsic.signer?.toString() || 'System',
                        to: extrinsic.method.args?.[0]?.toString() || 'Unknown',
                        value: '0',
                        timestamp,
                        status: 'success' // 简化处理
                    });
                });
            } catch (e) {
                console.log(`Failed to get transactions from block ${blockNum}:`, e);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                transactions: transactions.slice(0, limit)
            }
        });
    } catch (error) {
        console.error('Transactions latest API error:', error);
        return NextResponse.json({
            success: true,
            data: { transactions: [] }
        });
    }
}


