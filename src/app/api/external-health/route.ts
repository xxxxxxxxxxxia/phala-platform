// 文件路径: src/app/api/external-health/route.ts
import { NextResponse } from 'next/server';
import { getWorkersInfo } from '@/lib/phalaApi';

/**
 * ! 重要：配置你要监控的端点
 */
const ENDPOINTS_TO_CHECK = [
  { url: 'http://8.147.107.221:18000', expectedWorkers: 1 },
  { url: 'http://8.147.106.136:8000', expectedWorkers: 1 },
];

// 辅助函数：带超时的 fetch
async function fetchWithTimeout(resource: string, options: { timeout: number } & RequestInit) {
  const { timeout } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      method: 'HEAD', // 使用 HEAD 请求
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;

  } catch (error) {
    clearTimeout(id);
    throw error; 
  }
}

/**
 * App Router 的 GET 请求处理器
 */
export async function GET(request: Request) {
  let totalOfflineWorkers = 0;
  const results = await Promise.allSettled(
    ENDPOINTS_TO_CHECK.map(endpoint => 
      fetchWithTimeout(endpoint.url, { timeout: 3000 }) // 3秒超时
    )
  );

  results.forEach((result, index) => {
    // 'rejected' 意味着 fetch 失败 (超时, DNS错误, 拒绝连接等)
    if (result.status === 'rejected') {
      const endpoint = ENDPOINTS_TO_CHECK[index];
      totalOfflineWorkers += endpoint.expectedWorkers;
      console.warn(`[External Health] 端点 ${endpoint.url} 无法访问。增加 ${endpoint.expectedWorkers} 个离线节点。`);
    }
  });

  // 使用 NextResponse.json 返回数据
  return NextResponse.json({ success: true, offlineCount: totalOfflineWorkers });
}