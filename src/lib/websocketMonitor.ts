// src/lib/websocketMonitor.ts
// WebSocket连接状态监控

import { ApiPromise } from '@polkadot/api';
import { getApi } from './phalaApi';

export interface ConnectionStatus {
    isConnected: boolean;
    lastConnected: number;
    lastDisconnected: number;
    connectionCount: number;
    errorCount: number;
    lastError: string | null;
}

export interface WebSocketEvent {
    type: 'connected' | 'disconnected' | 'error' | 'reconnecting';
    timestamp: number;
    message?: string;
    error?: string;
}

class WebSocketConnectionMonitor {
    private connectionStatus: ConnectionStatus = {
        isConnected: false,
        lastConnected: 0,
        lastDisconnected: 0,
        connectionCount: 0,
        errorCount: 0,
        lastError: null,
    };

    private eventListeners: ((event: WebSocketEvent) => void)[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 5000; // 5秒
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor() {
        this.setupConnectionMonitoring();
    }

    // 设置连接监控
    private setupConnectionMonitoring(): void {
        this.monitorConnection();
    }

    // 监控连接状态
    private async monitorConnection(): Promise<void> {
        try {
            const api = await getApi();

            // 监听连接事件
            api.on('connected', () => {
                this.handleConnection();
            });

            api.on('disconnected', () => {
                this.handleDisconnection();
            });

            api.on('error', (error: Error) => {
                this.handleError(error);
            });

            // 检查当前连接状态
            if (api.isConnected) {
                this.handleConnection();
            } else {
                this.handleDisconnection();
            }

        } catch (error) {
            console.error('[WebSocketMonitor] 设置连接监控失败:', error);
            this.handleError(error as Error);
        }
    }

    // 处理连接成功
    private handleConnection(): void {
        this.connectionStatus.isConnected = true;
        this.connectionStatus.lastConnected = Date.now();
        this.connectionStatus.connectionCount++;
        this.reconnectAttempts = 0;

        // 清除重连定时器
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        this.emitEvent({
            type: 'connected',
            timestamp: Date.now(),
            message: 'WebSocket连接成功',
        });

        console.log('[WebSocketMonitor] 连接成功');
    }

    // 处理连接断开
    private handleDisconnection(): void {
        this.connectionStatus.isConnected = false;
        this.connectionStatus.lastDisconnected = Date.now();

        this.emitEvent({
            type: 'disconnected',
            timestamp: Date.now(),
            message: 'WebSocket连接断开',
        });

        console.log('[WebSocketMonitor] 连接断开');

        // 尝试重连
        this.attemptReconnect();
    }

    // 处理连接错误
    private handleError(error: Error): void {
        this.connectionStatus.errorCount++;
        this.connectionStatus.lastError = error.message;

        this.emitEvent({
            type: 'error',
            timestamp: Date.now(),
            error: error.message,
        });

        console.error('[WebSocketMonitor] 连接错误:', error.message);

        // 如果连接断开，尝试重连
        if (!this.connectionStatus.isConnected) {
            this.attemptReconnect();
        }
    }

    // 尝试重连
    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocketMonitor] 达到最大重连次数，停止重连');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避

        console.log(`[WebSocketMonitor] ${delay}ms后尝试第${this.reconnectAttempts}次重连...`);

        this.emitEvent({
            type: 'reconnecting',
            timestamp: Date.now(),
            message: `第${this.reconnectAttempts}次重连尝试`,
        });

        this.reconnectTimeout = setTimeout(async () => {
            try {
                // 重新获取API连接
                await getApi();
            } catch (error) {
                console.error('[WebSocketMonitor] 重连失败:', error);
                this.handleError(error as Error);
            }
        }, delay);
    }

    // 添加事件监听器
    addEventListener(listener: (event: WebSocketEvent) => void): void {
        this.eventListeners.push(listener);
    }

    // 移除事件监听器
    removeEventListener(listener: (event: WebSocketEvent) => void): void {
        const index = this.eventListeners.indexOf(listener);
        if (index > -1) {
            this.eventListeners.splice(index, 1);
        }
    }

    // 发送事件
    private emitEvent(event: WebSocketEvent): void {
        this.eventListeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('[WebSocketMonitor] 事件监听器错误:', error);
            }
        });
    }

    // 获取连接状态
    getConnectionStatus(): ConnectionStatus {
        return { ...this.connectionStatus };
    }

    // 检查是否连接
    isConnected(): boolean {
        return this.connectionStatus.isConnected;
    }

    // 获取连接统计
    getConnectionStats(): {
        isConnected: boolean;
        uptime: number;
        connectionCount: number;
        errorCount: number;
        lastError: string | null;
    } {
        const now = Date.now();
        const uptime = this.connectionStatus.isConnected
            ? now - this.connectionStatus.lastConnected
            : 0;

        return {
            isConnected: this.connectionStatus.isConnected,
            uptime,
            connectionCount: this.connectionStatus.connectionCount,
            errorCount: this.connectionStatus.errorCount,
            lastError: this.connectionStatus.lastError,
        };
    }

    // 强制重连
    async forceReconnect(): Promise<void> {
        try {
            console.log('[WebSocketMonitor] 强制重连...');
            this.reconnectAttempts = 0;
            await getApi();
        } catch (error) {
            console.error('[WebSocketMonitor] 强制重连失败:', error);
            this.handleError(error as Error);
        }
    }

    // 清理资源
    destroy(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.eventListeners = [];
    }
}

// 全局WebSocket监控实例
let globalWebSocketMonitor: WebSocketConnectionMonitor | null = null;

// 获取全局WebSocket监控实例
export const getWebSocketMonitor = (): WebSocketConnectionMonitor => {
    if (!globalWebSocketMonitor) {
        globalWebSocketMonitor = new WebSocketConnectionMonitor();
    }
    return globalWebSocketMonitor;
};

// 启动WebSocket监控
export const startWebSocketMonitoring = (): void => {
    const monitor = getWebSocketMonitor();
    console.log('[WebSocketMonitor] 启动WebSocket连接监控');
};

// 停止WebSocket监控
export const stopWebSocketMonitoring = (): void => {
    if (globalWebSocketMonitor) {
        globalWebSocketMonitor.destroy();
        globalWebSocketMonitor = null;
    }
};

// 获取连接状态
export const getConnectionStatus = (): ConnectionStatus => {
    const monitor = getWebSocketMonitor();
    return monitor.getConnectionStatus();
};

// 检查连接状态
export const isConnected = (): boolean => {
    const monitor = getWebSocketMonitor();
    return monitor.isConnected();
};
