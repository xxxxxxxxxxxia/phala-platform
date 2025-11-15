// src/app/api/connection-status/route.ts
// 连接状态API端点

import { NextRequest, NextResponse } from 'next/server';
import { getConnectionStatus, getWebSocketMonitor } from '@/lib/websocketMonitor';
import { getWorkerOfflineStatus } from '@/lib/workerHeartbeat';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'full';

        switch (type) {
            case 'connection':
                // 只返回连接状态
                const connectionStatus = getConnectionStatus();
                return NextResponse.json({
                    success: true,
                    data: connectionStatus,
                    timestamp: Date.now()
                });

            case 'workers':
                // 只返回worker状态
                const workerStatus = await getWorkerOfflineStatus();
                return NextResponse.json({
                    success: true,
                    data: workerStatus,
                    timestamp: Date.now()
                });

            case 'full':
            default:
                // 返回完整状态
                const fullConnectionStatus = getConnectionStatus();
                const fullWorkerStatus = await getWorkerOfflineStatus();
                const monitor = getWebSocketMonitor();
                const connectionStats = monitor.getConnectionStats();

                return NextResponse.json({
                    success: true,
                    data: {
                        connection: fullConnectionStatus,
                        workers: fullWorkerStatus,
                        stats: connectionStats,
                        summary: {
                            isConnected: fullConnectionStatus.isConnected,
                            onlineWorkers: fullWorkerStatus.onlineWorkers,
                            offlineWorkers: fullWorkerStatus.offlineWorkers,
                            totalWorkers: fullWorkerStatus.totalWorkers,
                            systemHealth: calculateSystemHealth(fullConnectionStatus, fullWorkerStatus),
                        }
                    },
                    timestamp: Date.now()
                });
        }
    } catch (error) {
        console.error('Error getting connection status:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to get connection status',
            timestamp: Date.now()
        }, { status: 500 });
    }
}

// 计算系统健康度
function calculateSystemHealth(connectionStatus: any, workerStatus: any): number {
    let health = 50; // 基础健康度

    // 连接状态影响
    if (connectionStatus.isConnected) {
        health += 30;
    } else {
        health -= 20;
    }

    // Worker状态影响
    if (workerStatus.totalWorkers > 0) {
        const onlineRatio = workerStatus.onlineWorkers / workerStatus.totalWorkers;
        health += onlineRatio * 20;
    }

    // 错误计数影响
    if (connectionStatus.errorCount > 0) {
        health -= Math.min(20, connectionStatus.errorCount * 2);
    }

    return Math.max(0, Math.min(100, health));
}

// 强制重连
export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'reconnect') {
            const monitor = getWebSocketMonitor();
            await monitor.forceReconnect();

            return NextResponse.json({
                success: true,
                message: '重连请求已发送',
                timestamp: Date.now()
            });
        }

        return NextResponse.json({
            success: false,
            error: 'Invalid action',
            timestamp: Date.now()
        }, { status: 400 });

    } catch (error) {
        console.error('Error in connection action:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to perform action',
            timestamp: Date.now()
        }, { status: 500 });
    }
}
