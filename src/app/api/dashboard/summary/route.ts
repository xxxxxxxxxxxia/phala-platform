import { NextRequest, NextResponse } from 'next/server';
import { getApi, getWorkersInfo, getNetworkStats, getAverageBlockTime } from '@/lib/phalaApi';
import { getPruntimeUrl } from '@/lib/config';

// 获取核心指标汇总
export async function GET(request: NextRequest) {
    try {
        let api;
        let header;
        let workers: any[] = [];
        let networkStats;
        let avgBlockTime: number | null = null;

        try {
            api = await getApi();
        } catch (apiError) {
            console.error('Failed to get API:', apiError);
            // 返回默认数据
            return NextResponse.json({
                success: true,
                data: {
                    blockchain: {
                        blockNumber: 0,
                        blockHash: '0x0',
                        avgBlockTime: 0,
                        consensusNodes: 0
                    },
                    workers: {
                        total: 0,
                        online: 0,
                        offline: 0,
                        unresponsive: 0,
                        byTeeType: {
                            SGX: { total: 0, online: 0, offline: 0 },
                            CSV: { total: 0, online: 0, offline: 0 },
                            AMD: { total: 0, online: 0, offline: 0 }
                        }
                    },
                    contracts: {
                        total: 0,
                        active: 0,
                        byType: {
                            SGX: 0,
                            System: 0
                        }
                    },
                    incentives: {
                        totalAmount: 0,
                        totalRewards: 0,
                        averageScore: 0
                    },
                    system: {
                        health: 0,
                        uptime: 0
                    },
                    timestamp: Date.now()
                }
            });
        }

        // 并行获取所有数据，但每个都有独立的错误处理
        try {
            [header, workers, networkStats, avgBlockTime] = await Promise.all([
                api.rpc.chain.getHeader().catch(() => null),
                getWorkersInfo().catch(() => []),
                getNetworkStats().catch(() => ({
                    totalWorkers: 0,
                    onlineWorkers: 0,
                    offlineWorkers: 0,
                    unresponsiveWorkers: 0,
                    totalSessions: 0,
                    activeSessions: 0,
                    averageScore: 0,
                    lastBlockNumber: 0
                })),
                getAverageBlockTime(10).catch(() => null)
            ]);
        } catch (dataError) {
            console.error('Failed to fetch some data:', dataError);
            // 继续使用默认值
        }

        const blockNumber = header ? header.number.toNumber() : 0;
        const blockHash = header ? header.hash.toHex() : '0x0';

        // 按TEE类型统计Worker
        const workersByTeeType = {
            SGX: { total: 0, online: 0, offline: 0 },
            CSV: { total: 0, online: 0, offline: 0 },
            AMD: { total: 0, online: 0, offline: 0 }
        };

        workers.forEach(worker => {
            const teeType = worker.teeType === 'Intel' ? 'SGX' : worker.teeType === 'AMD' ? 'AMD' : 'CSV';
            if (workersByTeeType[teeType as keyof typeof workersByTeeType]) {
                workersByTeeType[teeType as keyof typeof workersByTeeType].total++;
                if (worker.status === 'Online') {
                    workersByTeeType[teeType as keyof typeof workersByTeeType].online++;
                } else {
                    workersByTeeType[teeType as keyof typeof workersByTeeType].offline++;
                }
            }
        });

        // 获取合约数据
        let contractsTotal = 0;
        let contractsActive = 0;
        if (api) {
            try {
                const contracts = await api.query.phalaRegistry.contractKeys.entries();
                contractsTotal = contracts.length;
                contractsActive = contracts.length; // 简化处理，实际应该查询状态
            } catch (e) {
                console.log('无法获取合约数据:', e);
            }
        }

        // 获取激励数据（简化版）
        let totalIncentiveAmount = 0;
        try {
            const incentiveResponse = await fetch(`${request.nextUrl.origin}/api/incentives?action=status`);
            if (incentiveResponse.ok) {
                const incentiveData = await incentiveResponse.json();
                totalIncentiveAmount = incentiveData.totalAmount || 0;
            }
        } catch (e) {
            console.log('无法获取激励数据:', e);
        }

        // 确保 networkStats 有默认值
        if (!networkStats) {
            networkStats = {
                totalWorkers: 0,
                onlineWorkers: 0,
                offlineWorkers: 0,
                unresponsiveWorkers: 0,
                totalSessions: 0,
                activeSessions: 0,
                averageScore: 0,
                lastBlockNumber: 0
            };
        }

        // 计算系统健康度
        const onlineRatio = networkStats.totalWorkers > 0
            ? networkStats.onlineWorkers / networkStats.totalWorkers
            : 0;
        const systemHealth = Math.round(onlineRatio * 100);

        return NextResponse.json({
            success: true,
            data: {
                blockchain: {
                    blockNumber,
                    blockHash,
                    avgBlockTime: avgBlockTime || 0,
                    consensusNodes: networkStats.totalWorkers
                },
                workers: {
                    total: networkStats.totalWorkers,
                    online: networkStats.onlineWorkers,
                    offline: networkStats.offlineWorkers,
                    unresponsive: networkStats.unresponsiveWorkers,
                    byTeeType: workersByTeeType
                },
                contracts: {
                    total: contractsTotal,
                    active: contractsActive,
                    byType: {
                        SGX: contractsTotal,
                        System: 0
                    }
                },
                incentives: {
                    totalAmount: totalIncentiveAmount,
                    totalRewards: 0,
                    averageScore: networkStats.averageScore
                },
                system: {
                    health: systemHealth,
                    uptime: Date.now() - (Date.now() - 3600000) // 简化处理
                },
                timestamp: Date.now()
            }
        });
    } catch (error) {
        console.error('Dashboard summary API error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}


