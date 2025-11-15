# Phala Platform 配置说明

## 概述

本项目已经实现了统一的配置管理，所有IP地址和端口都通过 `src/lib/config.ts` 文件进行管理。

## 配置文件位置

- 主配置文件：`src/lib/config.ts`
- 环境变量示例：`.env.example`

## 如何修改IP地址

### 方法1：直接修改配置文件（推荐）

编辑 `src/lib/config.ts` 文件中的配置：

```typescript
export const CONFIG = {
  development: {
    // 区块链节点配置
    nodeUrl: 'ws://你的IP:19944',
    nodeHost: '你的IP',
    nodePort: 19944,
    
    // pRuntime 配置
    pruntimeUrl: 'http://你的IP:18000',
    pruntimeHost: '你的IP',
    pruntimePort: 18000,
    
    // API 配置
    apiUrl: 'http://你的IP:3001',
    apiHost: '你的IP',
    apiPort: 3001,
    
    // 其他服务配置
    teeApiUrl: 'http://你的TEE服务器IP:3001/api',
    fastApiUrl: 'http://你的IP:3000',
    
    // 健康检查端点
    healthCheckUrl: 'http://你的IP:19944/health',
    pruntimeInfoUrl: 'http://你的IP:8000/info',
    
    hasPruntime: true
  },
  
  production: {
    // 生产环境配置...
  }
};
```

### 方法2：使用环境变量

1. 创建 `.env.local` 文件
2. 设置环境变量：

```bash
NODE_URL=ws://你的IP:19944
PRUNTIME_URL=http://你的IP:18000
API_URL=http://你的IP:3001
TEE_API_URL=http://你的TEE服务器IP:3001/api
```

## 已更新的文件

以下文件已经更新为使用统一配置：

### API 路由文件
- `src/app/api/contracts/call/route.ts`
- `src/app/api/contracts/test-method/route.ts`
- `src/app/api/contracts/upload/route.ts`
- `src/app/api/contracts/deploy-system/route.ts`
- `src/app/api/contracts/real/route.ts`
- `src/app/api/contracts/fast/route.ts`
- `src/app/api/key-rotation/route.ts`
- `src/app/api/scheduling/route.ts`
- `src/app/api/monitor/route.ts`
- `src/app/api/monitoring/route.ts`
- `src/app/api/real-data/route.ts`

### 前端页面
- `src/app/incentives/page.tsx`
- `src/app/tee-verification/page.tsx`
- `src/app/tools/page.tsx`
- `src/app/docs/page.tsx`

### 库文件
- `src/lib/phalaApi.ts`

## 配置函数

配置文件提供了以下便捷函数：

```typescript
import { 
  getNodeUrl, 
  getPruntimeUrl, 
  getApiUrl, 
  getTeeApiUrl, 
  getFastApiUrl,
  getHealthCheckUrl,
  getPruntimeInfoUrl 
} from '@/lib/config';
```

## 注意事项

1. 修改配置后需要重启应用
2. 确保所有服务都在指定的IP和端口上运行
3. 生产环境和开发环境使用不同的配置
4. 可以通过 `NODE_ENV` 环境变量切换环境

## 验证配置

可以通过以下方式验证配置是否正确：

1. 访问 `/tools` 页面查看系统配置
2. 检查浏览器控制台是否有连接错误
3. 查看API响应是否正常


