// src/lib/workerHeartbeat.ts
// Worker心跳检测和离线状态监控

import { ApiPromise } from '@polkadot/api';
import { getApi } from './phalaApi';

export interface WorkerHeartbeat {
    publicKey: string;
    lastHeartbeat: number;
    isOnline: boolean;
    responseTime: number;
    consecutiveFailures: number;
    lastSeen: number;
}

export interface HeartbeatConfig {
    heartbeatInterval: number; // 心跳间隔(ms)
    offlineThreshold: number;   // 离线阈值(ms)
    maxRetries: number;        // 最大重试次数
    timeoutMs: number;         // 超时时间(ms)
}

const DEFAULT_CONFIG: HeartbeatConfig = {
    heartbeatInterval: 30000,  // 30秒
    offlineThreshold: 90000,   // 90秒无响应视为离线
    maxRetries: 3,
    timeoutMs: 10000,          // 10秒超时
};

class WorkerHeartbeatMonitor {
    private heartbeats: Map<string, WorkerHeartbeat> = new Map();
    private config: HeartbeatConfig;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;

    constructor(config: Partial<HeartbeatConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // 启动心跳监控
    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        console.log('[WorkerHeartbeat] 启动心跳监控...');

        // 立即执行一次检测
        this.performHeartbeatCheck();

        // 设置定时检测
        this.intervalId = setInterval(() => {
            this.performHeartbeatCheck();
        }, this.config.heartbeatInterval);
    }

    // 停止心跳监控
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[WorkerHeartbeat] 停止心跳监控');
    }

    // 执行心跳检测
    private async performHeartbeatCheck(): Promise<void> {
        try {
            const api = await getApi();
            const workers = await this.getRegisteredWorkers(api);

            console.log(`[WorkerHeartbeat] 检测 ${workers.length} 个worker...`);

            for (const worker of workers) {
                await this.checkWorkerHeartbeat(worker, api);
            }

            // 清理过期的离线worker
            this.cleanupOfflineWorkers();

        } catch (error) {
            console.error('[WorkerHeartbeat] 心跳检测失败:', error);
        }
    }

    // 获取已注册的worker列表
    private async getRegisteredWorkers(api: ApiPromise): Promise<string[]> {
        try {
            const workers = await api.query.phalaRegistry.workers.entries();
            return workers.map(([key]) => key.args[0].toHuman() as string);
        } catch (error) {
            console.error('[WorkerHeartbeat] 获取worker列表失败:', error);
            return [];
        }
    }

    // 检查单个worker的心跳
    private async checkWorkerHeartbeat(publicKey: string, api: ApiPromise): Promise<void> {
        const startTime = Date.now();
        const existingHeartbeat = this.heartbeats.get(publicKey);

        try {
            // 尝试获取worker的session信息作为心跳检测
            const sessionBinding = await api.query.phalaComputation.workerBindings(publicKey);
            const sessionId = sessionBinding.toHuman() as string | null;

            if (sessionId) {
                // 获取session状态
                const sessionInfoOpt = await api.query.phalaComputation.sessions(sessionId);
                if (sessionInfoOpt.isSome) {
                    const sessionInfo = sessionInfoOpt.unwrap().toJSON() as any;
                    const responseTime = Date.now() - startTime;

                    // 更新心跳信息
                    this.updateHeartbeat(publicKey, {
                        publicKey,
                        lastHeartbeat: Date.now(),
                        isOnline: this.isWorkerOnline(sessionInfo),
                        responseTime,
                        consecutiveFailures: 0,
                        lastSeen: Date.now(),
                    });

                    console.log(`[WorkerHeartbeat] ${publicKey.substring(0, 8)}... 在线, 响应时间: ${responseTime}ms`);
                    return;
                }
            }

            // 如果没有session或session无效，增加失败计数
            this.handleHeartbeatFailure(publicKey, existingHeartbeat);

        } catch (error) {
            console.error(`[WorkerHeartbeat] 检测worker ${publicKey.substring(0, 8)}... 失败:`, error);
            this.handleHeartbeatFailure(publicKey, existingHeartbeat);
        }
    }

    // 判断worker是否在线
    private isWorkerOnline(sessionInfo: any): boolean {
        const state = sessionInfo.state;
        return state === 'Ready' || state === 'WorkerIdle';
    }

    // 更新心跳信息
    private updateHeartbeat(publicKey: string, heartbeat: WorkerHeartbeat): void {
        this.heartbeats.set(publicKey, heartbeat);
    }

    // 处理心跳失败
    private handleHeartbeatFailure(publicKey: string, existingHeartbeat: WorkerHeartbeat | undefined): void {
        const consecutiveFailures = (existingHeartbeat?.consecutiveFailures || 0) + 1;
        const isOnline = consecutiveFailures < this.config.maxRetries;

        this.updateHeartbeat(publicKey, {
            publicKey,
            lastHeartbeat: existingHeartbeat?.lastHeartbeat || Date.now(),
            isOnline,
            responseTime: existingHeartbeat?.responseTime || 0,
            consecutiveFailures,
            lastSeen: existingHeartbeat?.lastSeen || Date.now(),
        });

        if (!isOnline) {
            console.warn(`[WorkerHeartbeat] ${publicKey.substring(0, 8)}... 离线 (连续失败 ${consecutiveFailures} 次)`);
        }
    }

    // 清理过期的离线worker
    private cleanupOfflineWorkers(): void {
        const now = Date.now();
        const offlineThreshold = this.config.offlineThreshold;

        for (const [publicKey, heartbeat] of this.heartbeats.entries()) {
            if (!heartbeat.isOnline && (now - heartbeat.lastSeen) > offlineThreshold) {
                console.log(`[WorkerHeartbeat] 清理过期离线worker: ${publicKey.substring(0, 8)}...`);
                this.heartbeats.delete(publicKey);
            }
        }
    }

    // 获取所有worker的心跳状态
    getHeartbeatStatus(): WorkerHeartbeat[] {
        return Array.from(this.heartbeats.values());
    }

    // 获取在线worker数量
    getOnlineWorkerCount(): number {
        return Array.from(this.heartbeats.values()).filter(h => h.isOnline).length;
    }

    // 获取离线worker数量
    getOfflineWorkerCount(): number {
        return Array.from(this.heartbeats.values()).filter(h => !h.isOnline).length;
    }

    // 检查特定worker是否在线
    isWorkerOnline(publicKey: string): boolean {
        const heartbeat = this.heartbeats.get(publicKey);
        return heartbeat?.isOnline || false;
    }

    // 获取worker的最后心跳时间
    getLastHeartbeat(publicKey: string): number | null {
        const heartbeat = this.heartbeats.get(publicKey);
        return heartbeat?.lastHeartbeat || null;
    }
}

// 全局心跳监控实例
let globalHeartbeatMonitor: WorkerHeartbeatMonitor | null = null;

// 获取全局心跳监控实例
export const getHeartbeatMonitor = (): WorkerHeartbeatMonitor => {
    if (!globalHeartbeatMonitor) {
        globalHeartbeatMonitor = new WorkerHeartbeatMonitor();
    }
    return globalHeartbeatMonitor;
};

// 启动全局心跳监控
export const startHeartbeatMonitoring = (config?: Partial<HeartbeatConfig>): void => {
    const monitor = getHeartbeatMonitor();
    if (config) {
        monitor['config'] = { ...DEFAULT_CONFIG, ...config };
    }
    monitor.start();
};

// 停止全局心跳监控
export const stopHeartbeatMonitoring = (): void => {
    if (globalHeartbeatMonitor) {
        globalHeartbeatMonitor.stop();
    }
};

// 获取worker离线状态
export const getWorkerOfflineStatus = async (): Promise<{
    onlineWorkers: number;
    offlineWorkers: number;
    totalWorkers: number;
    heartbeats: WorkerHeartbeat[];
}> => {
    const monitor = getHeartbeatMonitor();
    const heartbeats = monitor.getHeartbeatStatus();

    return {
        onlineWorkers: monitor.getOnlineWorkerCount(),
        offlineWorkers: monitor.getOfflineWorkerCount(),
        totalWorkers: heartbeats.length,
        heartbeats,
    };
};
