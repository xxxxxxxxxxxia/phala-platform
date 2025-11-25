import { NextRequest, NextResponse } from 'next/server';
import { getApi } from '@/lib/phalaApi';

// 获取密钥轮换统计（基于合约密钥管理列表）
export async function GET(request: NextRequest) {
    try {
        const api = await getApi();
        const header = await api.rpc.chain.getHeader();
        const currentBlock = header.number.toNumber();

        // 从密钥管理接口获取集群与合约密钥信息
        const clusterResponse = await fetch(`${request.nextUrl.origin}/api/key-rotation?action=cluster-keys`);
        if (!clusterResponse.ok) {
            throw new Error(`Key rotation cluster API 响应异常: ${clusterResponse.status}`);
        }
        const clusterData = await clusterResponse.json();

        const clusters = Array.isArray(clusterData?.clusters) ? clusterData.clusters : [];
        // 将每个集群下的合约扁平化，并带上所属集群信息，语义与管理端页面保持一致
        const allContracts = clusters.flatMap((cluster: any) =>
            Array.isArray(cluster.contracts)
                ? cluster.contracts.map((contract: any) => ({
                    ...contract,
                    clusterId: cluster.clusterId,
                    clusterKey: cluster.clusterKey,
                    hasClusterKey: cluster.hasClusterKey,
                }))
                : []
        );

        // 按你确认的统计口径：
        // 总密钥数 = 合约总数；活跃密钥 = hasKey 为 true 的合约数；轮换中暂时为 0
        const totalKeys = allContracts.length;
        const activeKeys = allContracts.filter((c: any) => c?.hasKey).length;
        const rotatingKeys = 0;

        // 合约维度暂不统计消息数和 gatekeeper 数量，这里先置为 0，保留字段兼容前端结构
        const pendingMessages = 0;
        const gatekeeperKeys = 0;

        // 提供给大屏展示的合约样本列表
        const contractSamples = allContracts.map((contract: any, index: number) => ({
            id: contract.contractId || `contract-${index}`,
            contractId: contract.contractId,
            clusterId: contract.clusterId,
            hasKey: !!contract.hasKey,
            clusterKey: contract.clusterKey ?? null,
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
                    contractSamples,
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

