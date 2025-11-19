import { NextRequest, NextResponse } from 'next/server';
import { getApi } from '@/lib/phalaApi';

// 获取最新区块列表
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
                success: false,
                error: 'Failed to connect to Phala API'
            }, { status: 500 });
        }

        let header;
        let latestBlockNumber = 0;
        try {
            header = await api.rpc.chain.getHeader();
            latestBlockNumber = header.number.toNumber();
        } catch (headerError) {
            console.error('Failed to get header:', headerError);
            return NextResponse.json({
                success: false,
                error: 'Failed to get chain header'
            }, { status: 500 });
        }

        const blocks = [];
        const blockNumbers = Array.from({ length: Math.min(limit, latestBlockNumber + 1) }, (_, i) =>
            latestBlockNumber - i
        ).reverse();

        // 限制处理时间，避免超时
        const maxBlocks = Math.min(blockNumbers.length, limit);
        for (let i = 0; i < maxBlocks; i++) {
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
                let timestamp = Date.now() - (latestBlockNumber - blockNum) * 6000; // 估算
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

                blocks.push({
                    number: blockNum,
                    hash: blockHash.toHex(),
                    timestamp,
                    transactionCount: signedBlock.block.extrinsics.length,
                    proposer: 'System', // 简化处理
                    extrinsics: signedBlock.block.extrinsics.length,
                    parentHash: signedBlock.block.header.parentHash.toHex()
                });
            } catch (e) {
                console.log(`Failed to get block ${blockNum}:`, e);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                blocks: blocks.reverse() // 从旧到新排序
            }
        });
    } catch (error) {
        console.error('Blocks latest API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error in blocks API'
        }, { status: 500 });
    }
}


