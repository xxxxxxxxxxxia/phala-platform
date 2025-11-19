// src/components/DataCard.tsx (这是最终的、正确的定义)
'use client';

import React from 'react';
import styles from './DataCard.module.css';
import '@ant-design/v5-patch-for-react-19';

interface DataCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  extra?: React.ReactNode; // 添加 extra 属性以支持右上角内容
  titleIcon?: React.ReactNode; // 添加 titleIcon 属性以支持标题图标
}

const DataCard: React.FC<DataCardProps> = ({ title, children, className, extra, titleIcon }) => {
  return (
    // 这里是最外层的 div，它会应用我们所有的自定义样式
    <div className={`${styles.card} ${className || ''}`}>

      {/* 头部区域，包含标题和右上角的额外内容 */}
      <div className={styles.header}>
        <div className={styles.title}>
          {titleIcon && <span style={{ marginRight: '8px' }}>{titleIcon}</span>}
          {title}
        </div>
        {extra && <div className={styles.extra}>{extra}</div>}
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        {children}
      </div>

    </div> // 确保这里只有一个 div，没有 antd 的 <Card>
  );
};

export default DataCard;