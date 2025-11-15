// 全局数据管理服务
class DataService {
  private cache: Map<string, any> = new Map();
  private timestamps: Map<string, number> = new Map();
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly CACHE_DURATION = 600000; // 10分钟缓存
  private readonly REFRESH_INTERVAL = 600000; // 10分钟刷新一次

  // 获取缓存数据
  getCachedData<T>(key: string): T | null {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() - timestamp > this.CACHE_DURATION) {
      return null;
    }
    return this.cache.get(key) || null;
  }

  // 设置缓存数据
  setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, data);
    this.timestamps.set(key, Date.now());
  }

  // 获取数据（优先从缓存，否则从API）
  async getData<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    useCache: boolean = true
  ): Promise<T> {
    // 如果使用缓存且缓存有效，直接返回
    if (useCache) {
      const cached = this.getCachedData<T>(key);
      if (cached !== null) {
        console.log(`[DataService] 使用缓存数据: ${key}`);
        return cached;
      }
    }

    try {
      console.log(`[DataService] 从API获取数据: ${key}`);
      // 从API获取数据，添加更短的超时时间
      const data = await Promise.race([
        fetchFunction(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000) // 5秒超时
        )
      ]) as T;
      
      this.setCachedData(key, data);
      console.log(`[DataService] 数据获取成功: ${key}`);
      return data;
    } catch (error) {
      console.error(`[DataService] API获取失败: ${key}`, error);
      // 如果API失败，返回缓存数据（如果有的话）
      const cached = this.getCachedData<T>(key);
      if (cached !== null) {
        console.log(`[DataService] API失败，使用缓存数据: ${key}`);
        return cached;
      }
      // 如果连缓存都没有，返回默认值而不是抛出错误
      console.warn(`[DataService] 无可用数据，返回默认值: ${key}`);
      return this.getDefaultData<T>(key);
    }
  }

  // 获取默认数据
  private getDefaultData<T>(key: string): T {
    const defaults: { [key: string]: any } = {
      'tee-verification': {
        totalDevices: 0,
        activeDevices: 0,
        byzantineNodes: [],
        pendingRegistrations: [],
        devices: []
      },
      'scheduling': {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        failedTasks: 0,
        averageExecutionTime: 0,
        resourceUtilization: 0,
        tasks: []
      },
      'monitoring': {
        totalAlerts: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
        averageResponseTime: 0,
        uptime: 0,
        alerts: []
      }
    };
    
    return (defaults[key] || {}) as T;
  }

  // 启动定时刷新（简化版，减少频率）
  startAutoRefresh(key: string, fetchFunction: () => Promise<any>): void {
    // 清除现有的定时器
    this.stopAutoRefresh(key);

    // 设置新的定时器，减少刷新频率到5分钟
    const interval = setInterval(async () => {
      try {
        const data = await fetchFunction();
        this.setCachedData(key, data);
        console.log(`[DataService] 自动刷新数据: ${key}`);
      } catch (error) {
        console.error(`[DataService] 自动刷新失败: ${key}`, error);
      }
    }, 600000); // 10分钟刷新一次

    this.refreshIntervals.set(key, interval);
  }

  // 停止定时刷新
  stopAutoRefresh(key: string): void {
    const interval = this.refreshIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.refreshIntervals.delete(key);
    }
  }

  // 清除所有缓存
  clearCache(): void {
    this.cache.clear();
    this.timestamps.clear();
    // 清除所有定时器
    this.refreshIntervals.forEach(interval => clearInterval(interval));
    this.refreshIntervals.clear();
  }

  // 获取缓存状态
  getCacheStatus(): { key: string; timestamp: number; age: number }[] {
    const status: { key: string; timestamp: number; age: number }[] = [];
    this.timestamps.forEach((timestamp, key) => {
      status.push({
        key,
        timestamp,
        age: Date.now() - timestamp
      });
    });
    return status;
  }
}

// 创建全局实例
export const dataService = new DataService();

// 预定义的API获取函数
export const apiFetchers = {
  // TEE验证数据
  async fetchTEEVerificationData() {
    try {
      const response = await fetch('/api/tee-verification-simple?action=status', {
        signal: AbortSignal.timeout(5000) // 5秒超时
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'API returned error');
      }
      return result.data;
    } catch (error) {
      console.warn('[DataService] TEE验证API失败，使用默认数据');
      return {
        totalDevices: 0,
        activeDevices: 0,
        byzantineNodes: [],
        pendingRegistrations: [],
        devices: []
      };
    }
  },

  // 调度数据
  async fetchSchedulingData() {
    try {
      const response = await fetch('/api/scheduling?action=status', {
        signal: AbortSignal.timeout(5000) // 5秒超时
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'API returned error');
      }
      return result.data;
    } catch (error) {
      console.warn('[DataService] 调度API失败，使用默认数据');
      return {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        failedTasks: 0,
        averageExecutionTime: 0,
        resourceUtilization: 0,
        tasks: []
      };
    }
  },

  // 监控数据
  async fetchMonitoringData() {
    try {
      const response = await fetch('/api/monitoring?action=status', {
        signal: AbortSignal.timeout(5000) // 5秒超时
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'API returned error');
      }
      return result.data;
    } catch (error) {
      console.warn('[DataService] 监控API失败，使用默认数据');
      return {
        totalAlerts: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
        averageResponseTime: 0,
        uptime: 0,
        alerts: []
      };
    }
  }
};

// 启动所有数据的自动刷新
export function startAllAutoRefresh(): void {
  dataService.startAutoRefresh('tee-verification', apiFetchers.fetchTEEVerificationData);
  dataService.startAutoRefresh('scheduling', apiFetchers.fetchSchedulingData);
  dataService.startAutoRefresh('monitoring', apiFetchers.fetchMonitoringData);
}

// 停止所有自动刷新
export function stopAllAutoRefresh(): void {
  dataService.stopAutoRefresh('tee-verification');
  dataService.stopAutoRefresh('scheduling');
  dataService.stopAutoRefresh('monitoring');
}


