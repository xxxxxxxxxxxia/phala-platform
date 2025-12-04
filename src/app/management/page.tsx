'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Space, Alert, Spin, Button } from 'antd';
import { DesktopOutlined, GlobalOutlined, SafetyCertificateOutlined, TrophyOutlined, ThunderboltOutlined, FileProtectOutlined } from '@ant-design/icons';
import MainLayout from '../../components/layout/MainLayout';
import AuthGuard from '../../components/AuthGuard';
import DataCard from '../../components/DataCard';
import { NetworkStats } from '../../lib/phalaApi';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function Dashboard() {
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [avgBlockTime, setAvgBlockTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [externalOfflineCount, setExternalOfflineCount] = useState(0);

  useEffect(() => {
    const fetchNetworkStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // 使用和响应监控页面相同的数据源：dashboard/summary API
        const response = await fetch('/api/dashboard/summary', {
          headers: { 'cache-control': 'no-store' }
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        if (result.success && result.data) {
          const data = result.data;
          // 转换为 NetworkStats 格式
          setNetworkStats({
            totalWorkers: data.workers?.total || 0, // 和响应监控页面的总worker数一样
            onlineWorkers: data.workers?.online || 0, // 和响应监控页面的在线worker数一样
            offlineWorkers: data.workers?.offline || 0,
            unresponsiveWorkers: data.workers?.unresponsive || 0,
            totalSessions: data.workers?.totalSessions || 0,
            activeSessions: data.workers?.activeSessions || 0,
            averageScore: data.incentives?.averageScore || 0,
            lastBlockNumber: data.blockchain?.blockNumber || 0,
          });
          setAvgBlockTime(data.blockchain?.avgBlockTime || null);
        } else {
          throw new Error('API返回数据格式错误');
        }
      } catch (err: unknown) {
        console.error('获取网络统计失败:', err);
        setError(err instanceof Error ? err.message : '未知错误');
        // 设置默认值，确保页面能正常显示
        setNetworkStats({
          totalWorkers: 0,
          onlineWorkers: 0,
          offlineWorkers: 0,
          unresponsiveWorkers: 0,
          totalSessions: 0,
          activeSessions: 0,
          averageScore: 0,
          lastBlockNumber: 0,
        });
        setAvgBlockTime(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNetworkStats();
  }, []);

  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px' }}>正在连接链计算节点...</div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              如果长时间无响应，请检查链下组件服务是否启动
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div>
          <Text type="secondary" style={{ fontSize: '16px', marginBottom: '24px', display: 'block' }}>区块链+链下组件+中间件的分布式计算平台</Text>

          {error && (
            <Alert
              message="连接警告"
              description={`数据获取失败: ${error}`}
              type="warning"
              showIcon
              style={{ marginBottom: '24px' }}
            />
          )}

          <Row gutter={[24, 24]}>
            {/* 顶部四大指标 */}
            <Col xs={24} sm={12} lg={6}>
              <DataCard title="总注册计算节点">
                <Statistic
                  value={networkStats?.totalWorkers || 0}
                  prefix={<DesktopOutlined />}
                />
              </DataCard>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <DataCard title="在线计算节点">
                <Statistic
                  value={networkStats?.onlineWorkers || 0}
                  prefix={<GlobalOutlined />}
                />
              </DataCard>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <DataCard title="活跃 Session 数">
                <Statistic
                  value={networkStats?.activeSessions || 0}
                  prefix={<SafetyCertificateOutlined />}
                />
              </DataCard>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <DataCard title="平均节点评分">
                <Statistic
                  value={networkStats?.averageScore || 0}
                  precision={2}
                  prefix={<TrophyOutlined />}
                />
              </DataCard>
            </Col>

            {/* 系统状态区块，始终保持 DataCard/Card 包裹（恢复丢失UI），内部四指标 */}
            <Col span={24}>
              <DataCard title="系统状态">
                <Row gutter={[24, 24]}>
                  <Col xs={24} sm={12} md={6}>
                    <Statistic
                      title="当前区块高度"
                      value={networkStats?.blockNumber || networkStats?.lastBlockNumber || 0}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Statistic
                      title="平均出块时间"
                      value={avgBlockTime ? Number(avgBlockTime.toFixed(2)) : 0}
                      suffix="秒"
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Statistic
                      title="节点可用性"
                      value={''}
                      valueStyle={{ color: '#52c41a' }}
                      formatter={() => (
                        <div div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                          <span style={{ color: '#52c41a', fontWeight: 600, fontSize: 16 }}>高可用</span>
                        </div>
                      )}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Statistic
                      title="系统正常运行"
                      value={''}
                      valueStyle={{ color: '#52c41a' }}
                      formatter={() => <span style={{ color: '#52c41a', fontWeight: 600, fontSize: 16 }}>正常</span>}
                    />
                  </Col>
                </Row>
              </DataCard>
            </Col>

            {/* 功能模块导航 */}
            <Col span={24}>
              <DataCard title="核心功能模块">
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} md={6}>
                    <Link href="/management/tee-verification">
                      <Card
                        size="small"
                        style={{
                          textAlign: 'center',
                          height: '140px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          border: '1px solid rgba(159, 44, 255, 0.3)'
                        }}
                        hoverable
                      >
                        <SafetyCertificateOutlined style={{ fontSize: '36px', color: '#52c41a', marginBottom: '12px' }} />
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>可信验证</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>基于TEE的可信验证协议</div>
                      </Card>
                    </Link>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Link href="/management/scheduling">
                      <Card
                        size="small"
                        style={{
                          textAlign: 'center',
                          height: '140px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          border: '1px solid rgba(159, 44, 255, 0.3)'
                        }}
                        hoverable
                      >
                        <ThunderboltOutlined style={{ fontSize: '36px', color: '#1890ff', marginBottom: '12px' }} />
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>安全调度</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>计算资源安全调度</div>
                      </Card>
                    </Link>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Link href="/management/incentives">
                      <Card
                        size="small"
                        style={{
                          textAlign: 'center',
                          height: '140px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          border: '1px solid rgba(159, 44, 255, 0.3)'
                        }}
                        hoverable
                      >
                        <TrophyOutlined style={{ fontSize: '36px', color: '#faad14', marginBottom: '12px' }} />
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>激励机制</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>激励与奖励机制</div>
                      </Card>
                    </Link>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Link href="/management/contracts">
                      <Card
                        size="small"
                        style={{
                          textAlign: 'center',
                          height: '140px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          border: '1px solid rgba(159, 44, 255, 0.3)'
                        }}
                        hoverable
                      >
                        <FileProtectOutlined style={{ fontSize: '36px', color: '#722ed1', marginBottom: '12px' }} />
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>隐私合约</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>隐私保护智能合约</div>
                      </Card>
                    </Link>
                  </Col>
                </Row>
              </DataCard>
            </Col>
          </Row>
        </div>
      </MainLayout>
    </AuthGuard>
  );
}
