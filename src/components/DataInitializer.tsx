'use client';

import { useEffect, useState } from 'react';
import { startAllAutoRefresh, stopAllAutoRefresh } from '../services/dataService';

export default function DataInitializer() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // 暂时禁用自动刷新，避免频繁API调用
    console.log('[DataInitializer] 数据服务已初始化（自动刷新已禁用）');
    setIsInitialized(true);
    
    // 组件卸载时清理
    return () => {
      if (isInitialized) {
        stopAllAutoRefresh();
      }
    };
  }, [isInitialized]);

  return null; // 这个组件不渲染任何内容
}



