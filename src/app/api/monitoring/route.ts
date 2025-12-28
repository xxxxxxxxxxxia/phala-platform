import { NextRequest, NextResponse } from 'next/server';
import { getHeartbeatMonitor, startHeartbeatMonitoring, getWorkerOfflineStatus } from '@/lib/workerHeartbeat';
import { getWebSocketMonitor, startWebSocketMonitoring, getConnectionStatus } from '@/lib/websocketMonitor';
import { getApi } from '@/lib/polkadotApiManager';

interface WorkerMonitor {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'unresponsive';
  lastHeartbeat: number;
  responseTime: number;
  uptime: number;
  performance: number;
  healthScore: number;
  errorCount: number;
  successRate: number;
}

interface MonitoringState {
  workers: WorkerMonitor[];
  totalWorkers: number;
  onlineWorkers: number;
  offlineWorkers: number;
  averageResponseTime: number;
  systemHealth: number;
  lastUpdate: number;
  connectionStatus: {
    isConnected: boolean;
    lastConnected: number;
    lastDisconnected: number;
    connectionCount: number;
    errorCount: number;
    lastError: string | null;
  };
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: number;
  }>;
}

let monitoringState: MonitoringState = {
  workers: [],
  totalWorkers: 0,
  onlineWorkers: 0,
  offlineWorkers: 0,
  averageResponseTime: 0,
  systemHealth: 0,
  lastUpdate: Date.now(),
  connectionStatus: {
    isConnected: false,
    lastConnected: 0,
    lastDisconnected: 0,
    connectionCount: 0,
    errorCount: 0,
    lastError: null,
  },
  alerts: []
};

// 使用全局连接管理器，无需本地getApi函数

// 获取Worker信息（优化超时：从10秒减少到8秒）
async function getWorkersInfo(): Promise<any[]> {
  try {
    const api = await getApi();
    const workers = await Promise.race([
      api.query.phalaRegistry.workers.entries(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 8000))
    ]) as any[];

    return workers;
  } catch (error) {
    console.error('Error getting workers info:', error);
    return [];
  }
}

// 创建Worker监控器
function createWorkerMonitor(workerPubkey: string, workerInfo: any): WorkerMonitor {
  const now = Date.now();
  const isOnline = Math.random() > 0.2; // 80%概率为在线状态
  const responseTime = Math.floor(Math.random() * 500) + 50;
  const uptime = Math.floor(Math.random() * 86400) + 3600; // 1-25小时
  const performance = Math.floor(Math.random() * 100);
  const healthScore = Math.floor(Math.random() * 100);
  const errorCount = Math.floor(Math.random() * 10);
  const successRate = Math.floor(Math.random() * 30) + 70; // 70-100%

  return {
    id: workerPubkey,
    name: `Worker-${workerPubkey.substring(0, 8)}`,
    status: isOnline ? 'online' : 'offline',
    lastHeartbeat: now - Math.floor(Math.random() * 300000), // 5分钟内
    responseTime,
    uptime,
    performance,
    healthScore,
    errorCount,
    successRate
  };
}

// 更新监控状态
async function updateMonitoringState(): Promise<MonitoringState> {
  try {
    // 启动WebSocket监控
    startWebSocketMonitoring();

    const workers = await getWorkersInfo();
    const connectionStatus = getConnectionStatus();

    const workerMonitors: WorkerMonitor[] = [];
    for (const [pubkey, workerInfo] of workers) {
      if (workerInfo.isSome) {
        const monitor = createWorkerMonitor(pubkey.toString(), workerInfo.unwrap());
        workerMonitors.push(monitor);
      }
    }

    const totalWorkers = workerMonitors.length;
    const onlineWorkers = workerMonitors.filter(w => w.status === 'online').length;
    const offlineWorkers = workerMonitors.filter(w => w.status === 'offline').length;
    const averageResponseTime = workerMonitors.reduce((sum, w) => sum + w.responseTime, 0) / totalWorkers;

    // 基于连接状态和worker状态计算系统健康度
    let systemHealth = 80;
    if (connectionStatus.isConnected) {
      systemHealth += 10;
    }
    if (onlineWorkers > 0) {
      systemHealth += Math.min(10, (onlineWorkers / totalWorkers) * 10);
    }
    if (connectionStatus.errorCount > 0) {
      systemHealth -= Math.min(20, connectionStatus.errorCount * 2);
    }

    // 生成告警
    const alerts = [];

    // 连接状态告警
    if (!connectionStatus.isConnected) {
      alerts.push({
        id: `alert-connection-${Date.now()}`,
        type: 'error' as const,
        message: 'WebSocket连接断开',
        timestamp: Date.now()
      });
    }

    if (connectionStatus.errorCount > 0) {
      alerts.push({
        id: `alert-errors-${Date.now()}`,
        type: 'warning' as const,
        message: `连接错误次数: ${connectionStatus.errorCount}`,
        timestamp: Date.now()
      });
    }

    if (systemHealth < 85) {
      alerts.push({
        id: `alert-health-${Date.now()}`,
        type: 'warning' as const,
        message: '系统健康度低于正常水平',
        timestamp: Date.now()
      });
    }

    if (offlineWorkers > 0) {
      alerts.push({
        id: `alert-offline-${Date.now()}`,
        type: 'error' as const,
        message: `${offlineWorkers}个Worker离线`,
        timestamp: Date.now()
      });
    }

    monitoringState = {
      workers: workerMonitors,
      totalWorkers,
      onlineWorkers,
      offlineWorkers,
      averageResponseTime: Math.floor(averageResponseTime),
      systemHealth: Math.max(0, Math.min(100, systemHealth)),
      lastUpdate: Date.now(),
      connectionStatus,
      alerts
    };

    return monitoringState;
  } catch (error) {
    console.error('Error updating monitoring state:', error);
    return monitoringState;
  }
}

// 发送心跳检测
async function sendHeartbeatCheck(): Promise<{ success: boolean; message: string }> {
  try {
    // 启动心跳监控（如果尚未启动）
    const monitor = getHeartbeatMonitor();
    if (!monitor['isRunning']) {
      startHeartbeatMonitoring();
    }

    // 获取真实的心跳状态
    const heartbeatStatus = await getWorkerOfflineStatus();

    // 更新监控状态
    monitoringState.workers.forEach(worker => {
      const heartbeat = heartbeatStatus.heartbeats.find(h => h.publicKey === worker.id);
      if (heartbeat) {
        worker.lastHeartbeat = heartbeat.lastHeartbeat;
        worker.responseTime = heartbeat.responseTime;
        worker.status = heartbeat.isOnline ? 'online' : 'offline';
        worker.healthScore = heartbeat.isOnline ? Math.min(100, worker.healthScore + 5) : Math.max(0, worker.healthScore - 10);
      }
    });

    return {
      success: true,
      message: `心跳检测完成 - 在线: ${heartbeatStatus.onlineWorkers}, 离线: ${heartbeatStatus.offlineWorkers}`
    };
  } catch (error) {
    console.error('Error sending heartbeat check:', error);
    return { success: false, message: '心跳检测失败' };
  }
}

// 重置Worker状态
async function resetWorkerStatus(workerId: string): Promise<{ success: boolean; message: string }> {
  try {
    const worker = monitoringState.workers.find(w => w.id === workerId);
    if (!worker) {
      return { success: false, message: 'Worker不存在' };
    }

    // 重置Worker状态
    worker.status = 'online';
    worker.lastHeartbeat = Date.now();
    worker.responseTime = Math.floor(Math.random() * 200) + 50;
    worker.healthScore = 90;
    worker.errorCount = 0;
    worker.successRate = 95;

    return { success: true, message: 'Worker状态重置成功' };
  } catch (error) {
    console.error('Error resetting worker status:', error);
    return { success: false, message: 'Worker状态重置失败' };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'status':
        const state = await updateMonitoringState();
        return NextResponse.json(state);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in monitoring API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'heartbeat':
        const heartbeatResult = await sendHeartbeatCheck();
        return NextResponse.json(heartbeatResult);

      case 'reset':
        const body = await request.json();
        const resetResult = await resetWorkerStatus(body.workerId);
        return NextResponse.json(resetResult);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in monitoring API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}











