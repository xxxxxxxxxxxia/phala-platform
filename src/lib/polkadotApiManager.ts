// 全局Polkadot API连接管理器
// 统一管理所有Polkadot API连接，避免重复创建连接

import { ApiPromise, WsProvider } from '@polkadot/api';
import { getNodeUrl } from '@/lib/config';

class PolkadotApiManager {
  private api: ApiPromise | null = null;
  private connectionPromise: Promise<ApiPromise> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 5000; // 5秒
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000; // 30秒检查一次连接健康
  private connectionTimeout = 15000; // 15秒连接超时（从30秒减少到15秒）

  /**
   * 获取API实例（单例模式，全局共享）
   * @param usePhalaOptions 是否使用@phala/sdk的options
   */
  async getApi(usePhalaOptions: boolean = false): Promise<ApiPromise> {
    // 如果已有连接且健康，直接返回
    if (this.api && this.isConnectionHealthy()) {
      return this.api;
    }

    // 如果正在连接中，等待连接完成
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // 创建新连接
    this.connectionPromise = this.createConnection(usePhalaOptions);
    return this.connectionPromise;
  }

  /**
   * 创建新连接
   * @param usePhalaOptions 是否使用@phala/sdk的options（用于某些需要特殊配置的路由）
   */
  private async createConnection(usePhalaOptions: boolean = false): Promise<ApiPromise> {
    const wsEndpoint = getNodeUrl();
    console.log(`[PolkadotApiManager] 正在连接至 ${wsEndpoint}...`);

    try {
      const provider = new WsProvider(wsEndpoint);
      
      // 使用Promise.race实现连接超时
      let connectionPromise: Promise<ApiPromise>;
      
      if (usePhalaOptions) {
        // 某些路由需要@phala/sdk的options
        const { options } = await import('@phala/sdk');
        connectionPromise = ApiPromise.create(options({
          provider,
          noInitWarn: true,
        }));
      } else {
        connectionPromise = ApiPromise.create({ provider });
      }
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('连接超时')), this.connectionTimeout)
      );

      const api = await Promise.race([connectionPromise, timeoutPromise]);

      // 等待连接就绪
      await api.isReady;
      console.log(`[PolkadotApiManager] 连接已就绪`);

      // 设置连接事件监听
      this.setupConnectionHandlers(api);

      this.api = api;
      this.connectionPromise = null;
      this.reconnectAttempts = 0;
      this.lastHealthCheck = Date.now();

      return api;
    } catch (error) {
      this.connectionPromise = null;
      console.error(`[PolkadotApiManager] 连接失败:`, error);

      // 自动重连机制
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`[PolkadotApiManager] 将在 ${this.reconnectDelay}ms 后尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
        return this.createConnection();
      }

      throw error;
    }
  }

  /**
   * 设置连接事件处理器
   */
  private setupConnectionHandlers(api: ApiPromise): void {
    api.on('connected', () => {
      console.log('[PolkadotApiManager] 节点连接成功');
      this.lastHealthCheck = Date.now();
      this.reconnectAttempts = 0;
    });

    api.on('disconnected', () => {
      console.warn('[PolkadotApiManager] 节点已断开连接');
      // 延迟清理，给重连机会
      setTimeout(() => {
        if (!api.isConnected) {
          this.api = null;
        }
      }, 5000);
    });

    api.on('error', (error: Error) => {
      console.error('[PolkadotApiManager] 连接错误:', error.message);
    });
  }

  /**
   * 检查连接健康状态
   */
  private isConnectionHealthy(): boolean {
    if (!this.api) return false;

    // 检查连接状态
    if (!this.api.isConnected) {
      return false;
    }

    // 定期健康检查（非阻塞）
    const now = Date.now();
    if (now - this.lastHealthCheck > this.healthCheckInterval) {
      this.lastHealthCheck = now;
      // 异步检查，不阻塞当前请求
      this.checkHealthAsync();
    }

    return true;
  }

  /**
   * 异步健康检查
   */
  private async checkHealthAsync(): Promise<void> {
    if (!this.api) return;

    try {
      // 快速检查：获取最新区块号（轻量级查询）
      await Promise.race([
        this.api.rpc.chain.getHeader(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('健康检查超时')), 3000))
      ]);
      // 健康检查成功，更新最后检查时间
      this.lastHealthCheck = Date.now();
    } catch (error) {
      console.warn('[PolkadotApiManager] 健康检查失败，连接可能有问题:', error);
      // 如果健康检查失败，标记连接为不健康，下次请求时会重新连接
      if (this.api && !this.api.isConnected) {
        this.api = null;
      }
    }
  }

  /**
   * 断开连接（清理资源）
   */
  async disconnect(): Promise<void> {
    if (this.api) {
      try {
        await this.api.disconnect();
      } catch (error) {
        console.error('[PolkadotApiManager] 断开连接时出错:', error);
      }
      this.api = null;
    }
    this.connectionPromise = null;
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): { connected: boolean; healthy: boolean } {
    return {
      connected: this.api?.isConnected ?? false,
      healthy: this.isConnectionHealthy()
    };
  }
}

// 导出单例实例
export const polkadotApiManager = new PolkadotApiManager();

// 导出便捷函数，保持向后兼容
export const getApi = () => polkadotApiManager.getApi();

