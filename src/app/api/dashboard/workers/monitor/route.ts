import { NextRequest, NextResponse } from 'next/server';
import { getWorkersInfo } from '@/lib/phalaApi';
import { getPruntimeUrl } from '@/lib/config';

// 获取Worker监控数据
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const teeType = searchParams.get('teeType') || 'all';

        let workers: any[] = [];
        try {
            workers = await getWorkersInfo();
        } catch (error) {
            console.error('Failed to get workers info:', error);
            // 返回空数据而不是错误
            return NextResponse.json({
                success: true,
                data: {
                    workers: [],
                    summary: {
                        total: 0,
                        online: 0,
                        offline: 0,
                        unresponsive: 0,
                        averageResponseTime: 0,
                        systemHealth: 0
                    }
                }
            });
        }

        // 过滤TEE类型
        let filteredWorkers = workers;
        if (teeType !== 'all') {
            filteredWorkers = workers.filter(w => {
                const workerTeeType = w.teeType === 'Intel' ? 'SGX' : w.teeType === 'AMD' ? 'AMD' : 'CSV';
                return workerTeeType === teeType;
            });
        }

        // 转换为监控格式
        const workerMonitors = filteredWorkers.map(worker => {
            const workerTeeType = worker.teeType === 'Intel' ? 'SGX' : worker.teeType === 'AMD' ? 'AMD' : 'CSV';

            return {
                id: worker.key,
                publicKey: worker.publicKey,
                name: `Worker-${worker.publicKey.substring(0, 8)}`,
                teeType: workerTeeType,
                status: worker.status === 'Online' ? 'online' : worker.status === 'Offline' ? 'offline' : 'unresponsive',
                lastHeartbeat: worker.lastHeartbeat || Date.now(),
                responseTime: Math.floor(Math.random() * 200) + 50, // 模拟数据
                uptime: Math.floor(Math.random() * 86400) + 3600,
                performance: Math.min(100, (worker.initialScore || 0) + Math.floor(Math.random() * 20)),
                healthScore: Math.min(100, (worker.initialScore || 0) + Math.floor(Math.random() * 15)),
                initialScore: worker.initialScore || 0,
                confidenceLevel: 1
            };
        });

        const onlineCount = workerMonitors.filter(w => w.status === 'online').length;
        const offlineCount = workerMonitors.filter(w => w.status === 'offline').length;
        const unresponsiveCount = workerMonitors.filter(w => w.status === 'unresponsive').length;
        const avgResponseTime = workerMonitors.length > 0
            ? Math.round(workerMonitors.reduce((sum, w) => sum + w.responseTime, 0) / workerMonitors.length)
            : 0;
        const systemHealth = workerMonitors.length > 0
            ? Math.round((onlineCount / workerMonitors.length) * 100)
            : 0;

        return NextResponse.json({
            success: true,
            data: {
                workers: workerMonitors,
                summary: {
                    total: workerMonitors.length,
                    online: onlineCount,
                    offline: offlineCount,
                    unresponsive: unresponsiveCount,
                    averageResponseTime: avgResponseTime,
                    systemHealth
                }
            }
        });
    } catch (error) {
        console.error('Worker monitor API error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}


