// src/lib/AntdRegistry.tsx
// 优化：使用SSR提取样式，但通过优化组件使用来减少样式数量
'use client';

import React from 'react';
import { createCache, extractStyle, StyleProvider } from '@ant-design/cssinjs';
import { useServerInsertedHTML } from 'next/navigation';

const AntdRegistry = ({ children }: { children: React.ReactNode }) => {
  const cache = createCache();
  
  // Ant Design CSS-in-JS会内联样式，这是正常行为
  // 要减少HTML大小，需要：
  // 1. 使用按需加载（babel-plugin-import）
  // 2. 减少使用的组件数量
  // 3. 延迟加载非关键组件
  useServerInsertedHTML(() => {
    const styleText = extractStyle(cache, true);
    return (
      <style id="antd" dangerouslySetInnerHTML={{ __html: styleText }} />
    );
  });
  
  return <StyleProvider cache={cache}>{children}</StyleProvider>;
};

export default AntdRegistry;