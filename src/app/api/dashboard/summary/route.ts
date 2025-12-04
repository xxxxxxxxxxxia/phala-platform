import { NextRequest, NextResponse } from 'next/server';
import { getApi, getWorkersInfo, getNetworkStats, getAverageBlockTime } from '@/lib/phalaApi';
import { fetchHygonDevices } from '@/lib/hygonDevices';
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
        let contractsByOwner: Record<string, number> = {};

        // 1) 优先使用管理端的合约状态接口（包含 owner 等丰富信息）
        try {
            const contractsController = new AbortController();
            const timeoutId = setTimeout(() => contractsController.abort(), 30000);

            try {
                const realRes = await fetch(`${request.nextUrl.origin}/api/contracts/real`, {
                    signal: contractsController.signal,
                });
                clearTimeout(timeoutId);
                const realData = await realRes.json().catch(() => null);

                if (realRes.ok && realData?.success && Array.isArray(realData.data?.contracts)) {
                    const list = realData.data.contracts as any[];
                    contractsTotal = realData.data.totalContracts ?? list.length;
                    contractsActive = realData.data.activeContracts ?? contractsTotal;
                    list.forEach((c) => {
                        const owner = c.owner || 'Unknown';
                        contractsByOwner[owner] = (contractsByOwner[owner] || 0) + 1;
                    });
                    console.log('✅ [API] Dashboard 使用 /api/contracts/real 的合约数据, 数量:', contractsTotal);
                } else {
                    throw new Error('Real contracts API returned error');
                }
            } catch (contractsError: any) {
                clearTimeout(timeoutId);
                console.warn('⚠️ [API] /api/contracts/real 不可用，尝试快速合约接口:', contractsError?.message ?? String(contractsError));

                // 回退到快速合约接口
                try {
                    const fastRes = await fetch(`${request.nextUrl.origin}/api/contracts/fast?action=status`);
                    const fastData = await fastRes.json().catch(() => null);
                    if (fastRes.ok && fastData?.success && Array.isArray(fastData.data?.contracts)) {
                        const list = fastData.data.contracts as any[];
                        contractsTotal = fastData.data.totalContracts ?? list.length;
                        contractsActive = fastData.data.activeContracts ?? contractsTotal;
                        list.forEach((c) => {
                            const owner = c.owner || 'Unknown';
                            contractsByOwner[owner] = (contractsByOwner[owner] || 0) + 1;
                        });
                        console.log('✅ [API] Dashboard 使用 /api/contracts/fast 的合约数据, 数量:', contractsTotal);
                    }
                } catch (fastError) {
                    console.error('❌ [API] /api/contracts/fast 也不可用:', fastError);
                }
            }
        } catch (e) {
            console.error('❌ [API] 在获取管理端合约数据时发生错误:', e);
        }

        // 2) 如果仍然没有拿到总数，则回退到链上查询（原有逻辑）
        if (contractsTotal === 0 && api) {
            try {
                const contracts = await api.query.phalaRegistry.contractKeys.entries();
                contractsTotal = contracts.length;
                contractsActive = contracts.length; // 简化处理，实际应该查询状态
                console.log('✅ [API] 回退到链上获取合约数据, 数量:', contractsTotal);
            } catch (e) {
                console.error('❌ [API] 无法从链上获取合约数据:', e);
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

        // 使用和响应监控页面完全相同的计算逻辑
        // 1. 获取SGX workers（和响应监控页面一样）
        const sgxWorkers = workers; // 已经通过 getWorkersInfo() 获取
        const sgxTotal = sgxWorkers.length;
        const sgxOnline = sgxWorkers.filter(w => w.status === 'Online').length;
        const sgxOffline = sgxWorkers.filter(w => w.status === 'Offline').length;

        // 2. 获取Hygon设备（和响应监控页面一样）
        const hygonDevices = await fetchHygonDevices(api);
        const hygonDeviceCount = hygonDevices.length;
        const hygonCvmCount = hygonDevices.reduce((sum, device) => sum + (device.cvms?.length || 0), 0);

        // 3. 计算总数（和响应监控页面完全一样）
        const totalWorkers = sgxTotal + hygonDeviceCount;
        const totalOnline = sgxOnline; // 只计算SGX workers中在线的，不包括Hygon设备（和响应监控页面一样）
        const totalOffline = sgxOffline;

        workersByTeeType.SGX.total = sgxTotal;
        workersByTeeType.SGX.online = sgxOnline;
        workersByTeeType.SGX.offline = sgxOffline;
        workersByTeeType.CSV.total = hygonDeviceCount;
        workersByTeeType.CSV.online = 0; // 响应监控页面不把Hygon设备算在在线数里
        workersByTeeType.CSV.offline = 0;

        const onlineRatio = totalWorkers > 0
            ? totalOnline / totalWorkers
            : 0;
        const systemHealth = Math.round(onlineRatio * 100);

        const responseData = {
            blockchain: {
                blockNumber,
                blockHash,
                avgBlockTime: avgBlockTime || 0,
                consensusNodes: totalWorkers
            },
            workers: {
                total: totalWorkers, // SGX workers + Hygon devices（和响应监控页面一样）
                sgxTotal,
                hygonDeviceCount,
                online: totalOnline, // SGX online + Hygon devices（和响应监控页面一样）
                offline: totalOffline,
                unresponsive: networkStats?.unresponsiveWorkers || 0,
                byTeeType: workersByTeeType
            },
            contracts: {
                total: contractsTotal,
                active: contractsActive,
                byType: {
                    SGX: contractsTotal,
                    System: 0
                },
                byOwner: contractsByOwner,
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
            hygon: {
                deviceCount: hygonDeviceCount,
                cvmCount: hygonCvmCount
            },
            timestamp: Date.now()
        };

        console.log('✅ [API] 返回数据摘要:', {
            blockNumber: responseData.blockchain.blockNumber,
            sgxTotal,
            hygonDeviceCount,
            totalWorkers: responseData.workers.total,
            sgxOnline,
            totalOnline: responseData.workers.online,
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


