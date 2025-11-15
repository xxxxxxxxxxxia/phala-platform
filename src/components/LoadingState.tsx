'use client';

import React, { useState, useEffect } from 'react';
import { Spin, Typography, Button, Space } from 'antd';
import { ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface LoadingStateProps {
  isLoading: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  loadingText?: string;
  timeout?: number; // 超时时间（毫秒）
  children?: React.ReactNode;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  isLoading,
  hasError = false,
  errorMessage = '加载失败',
  onRetry,
  loadingText = '正在加载...',
  timeout = 30000, // 默认30秒超时
  children
}) => {
  const [showTimeout, setShowTimeout] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState(0);

  // 超时处理
  useEffect(() => {
    if (!isLoading) {
      setShowTimeout(false);
      setLoadingSteps(0);
      return;
    }

    const timeoutId = setTimeout(() => {
      setShowTimeout(true);
    }, timeout);

    return () => clearTimeout(timeoutId);
  }, [isLoading, timeout]);

  // 加载步骤动画
  useEffect(() => {
    if (!isLoading) return;

    const steps = [
      '正在连接虚拟机...',
      '正在启动服务...',
      '正在初始化环境...',
      '正在获取日志...'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      setLoadingSteps(prev => (prev + 1) % steps.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoading]);

  const loadingStepsText = [
    '正在连接虚拟机...',
    '正在启动服务...',
    '正在初始化环境...',
    '正在获取日志...'
  ];

  if (hasError) {
    return (
      <div className="py-10 text-center">
        <div className="mb-4">
          <ExclamationCircleOutlined 
            style={{ 
              fontSize: '48px', 
              color: '#ff4d4f',
              marginBottom: '16px'
            }} 
          />
        </div>
        <Text type="danger" style={{ fontSize: '16px', display: 'block', marginBottom: '16px' }}>
          {errorMessage}
        </Text>
        {onRetry && (
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={onRetry}
            className="mt-2"
          >
            重试
          </Button>
        )}
      </div>
    );
  }

  if (showTimeout) {
    return (
      <div className="py-10 text-center">
        <div className="mb-4">
          <ExclamationCircleOutlined 
            style={{ 
              fontSize: '48px', 
              color: '#faad14',
              marginBottom: '16px'
            }} 
          />
        </div>
        <Text style={{ color: '#faad14', fontSize: '16px', display: 'block', marginBottom: '16px' }}>
          加载时间较长，请检查虚拟机状态
        </Text>
        <Space direction="vertical" size="middle">
          <Text type="secondary" style={{ fontSize: '14px' }}>
            可能的原因：
          </Text>
          <ul style={{ textAlign: 'left', color: '#ccc', fontSize: '14px', margin: 0, paddingLeft: '20px' }}>
            <li>虚拟机启动时间较长</li>
            <li>网络连接问题</li>
            <li>服务暂时不可用</li>
          </ul>
          {onRetry && (
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={onRetry}
              className="mt-4"
            >
              重新尝试
            </Button>
          )}
        </Space>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-10 text-center">
        <Spin size="large" />
        <div className="mt-4">
          <Text style={{ color: '#ffffff', fontSize: '16px', display: 'block', marginBottom: '8px' }}>
            {loadingText}
          </Text>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            {loadingStepsText[loadingSteps]}
          </Text>
        </div>
        <div className="mt-6">
          <div style={{ 
            width: '200px', 
            height: '4px', 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            borderRadius: '2px',
            margin: '0 auto',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #9f2cff, #3b82f6)',
              borderRadius: '2px',
              animation: 'loading-bar 2s ease-in-out infinite'
            }} />
          </div>
        </div>
        <style jsx>{`
          @keyframes loading-bar {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  return <>{children}</>;
};

export default LoadingState;












