// 统一配置管理
export const CONFIG = {
  // 开发环境
  development: {
    // 区块链节点配置
    nodeUrl: 'ws://8.147.107.221:19944',
    nodeHost: '8.147.107.221',
    nodePort: 19944,

    // pRuntime 配置
    pruntimeUrl: 'http://8.147.107.221:18000',
    pruntimeHost: '8.147.107.221',
    pruntimePort: 18000,

    // API 配置
    apiUrl: 'http://8.147.107.221:3001',
    apiHost: '8.147.107.221',
    apiPort: 3001,

    // 其他服务配置
    teeApiUrl: 'http://8.147.106.136:3001/api',
    fastApiUrl: 'http://8.147.107.221:3000',

    // 健康检查端点
    healthCheckUrl: 'http://8.147.107.221:19944/health',
    pruntimeInfoUrl: 'http://8.147.107.221:8000/info',

    hasPruntime: true
  },

  // 生产环境
  production: {
    // 区块链节点配置
    nodeUrl: 'ws://8.147.107.221:19944',
    nodeHost: '8.147.107.221',
    nodePort: 19944,

    // pRuntime 配置
    pruntimeUrl: 'http://8.147.107.221:18000',
    pruntimeHost: '8.147.107.221',
    pruntimePort: 18000,

    // API 配置
    apiUrl: 'http://8.147.107.221:3001',
    apiHost: '8.147.107.221',
    apiPort: 3001,

    // 其他服务配置
    teeApiUrl: 'http://8.147.106.136:3001/api',
    fastApiUrl: 'http://8.147.107.221:3000',

    // 健康检查端点
    healthCheckUrl: 'http://8.147.107.221:19944/health',
    pruntimeInfoUrl: 'http://8.147.107.221:8000/info',

    hasPruntime: true
  }
};

// 获取当前配置
export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return CONFIG[env as keyof typeof CONFIG] || CONFIG.development;
};

// 检查是否有 pRuntime
export const hasPruntime = () => {
  return getConfig().hasPruntime;
};

// 获取节点URL
export const getNodeUrl = () => {
  return getConfig().nodeUrl;
};

// 获取 pRuntime URL
export const getPruntimeUrl = () => {
  return getConfig().pruntimeUrl;
};

// 获取 API URL
export const getApiUrl = () => {
  return getConfig().apiUrl;
};

// 获取 TEE API URL
export const getTeeApiUrl = () => {
  return getConfig().teeApiUrl;
};

// 获取 Fast API URL
export const getFastApiUrl = () => {
  return getConfig().fastApiUrl;
};

// 获取健康检查URL
export const getHealthCheckUrl = () => {
  return getConfig().healthCheckUrl;
};

// 获取 pRuntime 信息URL
export const getPruntimeInfoUrl = () => {
  return getConfig().pruntimeInfoUrl;
};





