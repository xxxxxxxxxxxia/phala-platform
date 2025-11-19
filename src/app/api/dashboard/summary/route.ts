import { NextRequest, NextResponse } from 'next/server';
import { getApi, getWorkersInfo, getNetworkStats, getAverageBlockTime } from '@/lib/phalaApi';
import { getPruntimeUrl, getNodeUrl } from '@/lib/config';

// 获取核心指标汇总
export async function GET(request: NextRequest) {
    console.log('🔍 [API] Dashboard Summary - 开始处理请求');
    try {
        let api;
        let header;
        let workers: any[] = [];
        let networkStats;
        let avgBlockTime: number | null = null;

        // 尝试连接 API
        console.log('📡 [API] 尝试连接区块链节点:', getNodeUrl());
        try {
            api = await getApi();
            console.log('✅ [API] 区块链节点连接成功, isConnected:', api.isConnected);
        } catch (apiError) {
            console.error('❌ [API] 连接区块链节点失败:', apiError);
            console.error('❌ [API] 错误详情:', {
                message: apiError instanceof Error ? apiError.message : String(apiError),
                stack: apiError instanceof Error ? apiError.stack : undefined
            });
            // 返回默认数据
            return NextResponse.json({
                success: false,
                error: apiError instanceof Error ? apiError.message : 'Unknown error'
                /*
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
                        health: 100,
                        uptime: 0
                    },
                    timestamp: Date.now()
                }
                */
            }, { status: 500 });
        }

        // 并行获取所有数据，但每个都有独立的错误处理
        console.log('📊 [API] 开始获取数据...');
        try {
            [header, workers, networkStats, avgBlockTime] = await Promise.all([
                api.rpc.chain.getHeader()
                    .then(h => {
                        const blockNum = h.number.toNumber();
                        console.log('✅ [API] 获取区块头成功, blockNumber:', blockNum);
                        return h;
                    })
                    .catch(err => {
                        console.error('❌ [API] 获取区块头失败:', err);
                        return null;
                    }),
                getWorkersInfo()
                    .then(w => {
                        console.log('✅ [API] 获取 Workers 成功, 数量:', w.length);
                        if (w.length > 0) {
                            console.log('📋 [API] Workers 详情:', w.slice(0, 3).map(worker => ({
                                publicKey: worker.publicKey.substring(0, 16) + '...',
                                status: worker.status,
                                teeType: worker.teeType
                            })));
                        } else {
                            console.warn('⚠️ [API] Workers 列表为空');
                        }
                        return w;
                    })
                    .catch(err => {
                        console.error('❌ [API] 获取 Workers 失败:', err);
                        return [];
                    }),
                getNetworkStats()
                    .then(stats => {
                        console.log('✅ [API] 获取网络统计成功:', {
                            totalWorkers: stats.totalWorkers,
                            onlineWorkers: stats.onlineWorkers,
                            offlineWorkers: stats.offlineWorkers,
                            averageScore: stats.averageScore
                        });
                        return stats;
                    })
                    .catch(err => {
                        console.error('❌ [API] 获取网络统计失败:', err);
                        return {
                            totalWorkers: 0,
                            onlineWorkers: 0,
                            offlineWorkers: 0,
                            unresponsiveWorkers: 0,
                            totalSessions: 0,
                            activeSessions: 0,
                            averageScore: 0,
                            lastBlockNumber: 0
                        };
                    }),
                getAverageBlockTime(10)
                    .then(time => {
                        console.log('✅ [API] 获取平均出块时间成功:', time, '秒');
                        return time;
                    })
                    .catch(err => {
                        console.error('❌ [API] 获取平均出块时间失败:', err);
                        return null;
                    })
            ]);
        } catch (dataError) {
            console.error('❌ [API] 获取数据时发生错误:', dataError);
            // 继续使用默认值
        }

        const blockNumber = header ? header.number.toNumber() : 0;
        const blockHash = header ? header.hash.toHex() : '0x0';

        console.log('📈 [API] 数据汇总:', {
            blockNumber,
            blockHash: blockHash.substring(0, 20) + '...',
            workersCount: workers.length,
            networkStats: networkStats ? {
                totalWorkers: networkStats.totalWorkers,
                onlineWorkers: networkStats.onlineWorkers,
                offlineWorkers: networkStats.offlineWorkers
            } : null,
            avgBlockTime
        });

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
                console.log('✅ [API] 获取合约数据成功, 数量:', contractsTotal);
            } catch (e) {
                console.error('❌ [API] 无法获取合约数据:', e);
            }
        }

        // 获取激励数据（简化版）
        let totalIncentiveAmount = 0;
        try {
            const incentiveResponse = await fetch(`${request.nextUrl.origin}/api/incentives?action=status`);
            if (incentiveResponse.ok) {
                const incentiveData = await incentiveResponse.json();
                totalIncentiveAmount = incentiveData.totalAmount || 0;
                console.log('✅ [API] 获取激励数据成功, totalAmount:', totalIncentiveAmount);
            } else {
                console.warn('⚠️ [API] 激励数据 API 响应失败, status:', incentiveResponse.status);
            }
        } catch (e) {
            console.error('❌ [API] 无法获取激励数据:', e);
        }

        // 确保 networkStats 有默认值
        if (!networkStats) {
            console.warn('⚠️ [API] networkStats 为空，使用默认值');
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

        const responseData = {
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
        };

        console.log('✅ [API] 返回数据摘要:', {
            blockNumber: responseData.blockchain.blockNumber,
            totalWorkers: responseData.workers.total,
            onlineWorkers: responseData.workers.online,
            systemHealth: responseData.system.health,
            contractsTotal: responseData.contracts.total,
            totalIncentiveAmount: responseData.incentives.totalAmount
        });

        return NextResponse.json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('❌ [API] Dashboard summary API error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}


