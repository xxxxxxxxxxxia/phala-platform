// src/app/tools/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import MainLayout from "@/components/layout/MainLayout";
import AuthGuard from "@/components/AuthGuard";
import { Row, Col, Typography, Button, message, Card, Space, Divider, Alert, Descriptions, Statistic, Tag, Spin } from 'antd';
import {
  CodeOutlined, CopyOutlined, DatabaseOutlined, SettingOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  CloudServerOutlined, ReloadOutlined, ThunderboltOutlined
} from '@ant-design/icons';
import { getNodeUrl, getPruntimeUrl, getApiUrl, getHealthCheckUrl, getPruntimeInfoUrl, getTeeApiUrl } from '@/lib/config';

const { Title, Paragraph, Text } = Typography;

interface ServiceStatus {
  name: string;
  url: string;
  status: 'online' | 'offline' | 'checking';
  responseTime?: number;
  lastCheck?: Date;
  error?: string;
}

const ToolsPage = () => {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: '区块链节点',
      url: getNodeUrl(),
      status: 'checking'
    },
    {
      name: '中继器服务',
      url: getPruntimeUrl(),
      status: 'checking'
    },
    {
      name: '前端服务',
      url: 'http://8.147.107.221:3000',
      status: 'checking'
    },
  ]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板!');
  };

  const checkService = async (service: ServiceStatus): Promise<ServiceStatus> => {
    const startTime = Date.now();
    try {
      let response;

      if (service.name === '区块链节点') {
        // 使用代理检查节点健康状态
        response = await fetch('/api/node-health?endpoint=health', {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
      } else if (service.name === '中继器服务') {
        // 检查 pRuntime 状态，需要传递 target 参数
        const targetUrl = encodeURIComponent(service.url);
        response = await fetch(`/api/pruntime-proxy?target=${targetUrl}&endpoint=prpc/PhactoryAPI.GetInfo`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
      } else {
        // 其他服务直接检查
        response = await fetch(service.url, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
      }

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          ...service,
          status: 'online',
          responseTime,
          lastCheck: new Date(),
          error: undefined
        };
      } else {
        return {
          ...service,
          status: 'offline',
          responseTime,
          lastCheck: new Date(),
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        ...service,
        status: 'offline',
        responseTime,
        lastCheck: new Date(),
        error: error.message
      };
    }
  };

  const checkAllServices = async () => {
    setLoading(true);
    const promises = services.map(service => checkService(service));
    const results = await Promise.all(promises);
    setServices(results);
    setLastUpdate(new Date());
    setLoading(false);
  };


  useEffect(() => {
    checkAllServices();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'offline':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <Spin size="small" />;
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'online':
        return <Tag color="success">在线</Tag>;
      case 'offline':
        return <Tag color="error">离线</Tag>;
      default:
        return <Tag color="processing">检查中</Tag>;
    }
  };

  const onlineCount = services.filter(s => s.status === 'online').length;
  const totalCount = services.length;

  return (
    <AuthGuard>
      <MainLayout>
        <Title level={2} style={{ fontSize: '18pt' }}>开发接口</Title>
        <Paragraph type="secondary">
          区块链平台的开发工具和API接口，用于与TEE设备、隐私合约和激励机制进行交互。
        </Paragraph>
        <Divider />

        {/* 服务状态监控 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="服务状态"
                value={onlineCount}
                suffix={`/ ${totalCount}`}
                valueStyle={{ color: onlineCount === totalCount ? '#3f8600' : '#cf1322' }}
                prefix={onlineCount === totalCount ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="在线率"
                value={Math.round((onlineCount / totalCount) * 100)}
                suffix="%"
                valueStyle={{ color: onlineCount === totalCount ? '#3f8600' : '#cf1322' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="最后更新"
                value={lastUpdate ? lastUpdate.toLocaleTimeString() : '未检查'}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={checkAllServices}
                style={{ width: '100%' }}
              >
                刷新状态
              </Button>
            </Card>
          </Col>
        </Row>

        {/* 服务状态详情 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {services.map((service, index) => (
            <Col xs={24} lg={12} key={index}>
              <Card
                title={
                  <Space>
                    {getStatusIcon(service.status)}
                    {service.name}
                  </Space>
                }
                extra={getStatusTag(service.status)}
              >
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="服务地址">
                    <Text code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                      {service.url}
                    </Text>
                  </Descriptions.Item>
                  {service.responseTime && (
                    <Descriptions.Item label="响应时间">
                      <Text>{service.responseTime}ms</Text>
                    </Descriptions.Item>
                  )}
                  {service.lastCheck && (
                    <Descriptions.Item label="最后检查">
                      <Text>{service.lastCheck.toLocaleString()}</Text>
                    </Descriptions.Item>
                  )}
                  {service.error && (
                    <Descriptions.Item label="错误信息">
                      <Text type="danger" style={{ fontSize: '12px' }}>
                        {service.error}
                      </Text>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            </Col>
          ))}
        </Row>

        {onlineCount < totalCount && (
          <Alert
            message="部分服务离线"
            description={`有 ${totalCount - onlineCount} 个服务当前不可用，请检查服务状态。`}
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {onlineCount === totalCount && (
          <Alert
            message="所有服务正常"
            description="所有服务都在线运行，系统状态良好。"
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Row gutter={[24, 24]}>

          {/* 区块链 API接口 */}
          <Col span={24}>
            <Card title="链计算API接口" extra={<DatabaseOutlined />}>
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <Card size="small" title="节点健康检查">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text code>GET /api/node-health?endpoint=health</Text>
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopy('GET /api/node-health?endpoint=health')}
                          style={{ marginLeft: '8px' }}
                        />
                      </div>
                      <Text type="secondary">检查区块链节点健康状态</Text>
                    </Space>
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card size="small" title="中继器状态">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text code>GET /api/pruntime-proxy?endpoint=prpc/PhactoryAPI.GetInfo</Text>
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopy('GET /api/pruntime-proxy?endpoint=prpc/PhactoryAPI.GetInfo')}
                          style={{ marginLeft: '8px' }}
                        />
                      </div>
                      <Text type="secondary">获取中继器服务状态</Text>
                    </Space>
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card size="small" title="密钥管理接口">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text code>GET /api/key-rotation?action=status</Text>
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopy('GET /api/key-rotation?action=status')}
                          style={{ marginLeft: '8px' }}
                        />
                      </div>
                      <Text type="secondary">获取密钥轮换状态</Text>
                    </Space>
                  </Card>
                </Col>

                <Col xs={24} lg={12}>
                  <Card size="small" title="响应监控接口">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text code>GET /api/monitoring?action=status</Text>
                        <Button
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopy('GET /api/monitoring?action=status')}
                          style={{ marginLeft: '8px' }}
                        />
                      </div>
                      <Text type="secondary">获取系统监控状态</Text>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* 系统配置 */}
          <Col span={24}>
            <Card title="系统配置" extra={<SettingOutlined />}>
              <style dangerouslySetInnerHTML={{
                __html: `
                  .config-descriptions table {
                    table-layout: fixed;
                    width: 100%;
                  }
                  .config-descriptions .ant-descriptions-item-label {
                    width: 140px !important;
                  }
                  .config-descriptions .ant-descriptions-item-content {
                    word-break: keep-all;
                  }
                  .config-descriptions tbody tr td:nth-child(1) {
                    width: 75% !important;
                  }
                  .config-descriptions tbody tr td:nth-child(2) {
                    width: 25% !important;
                  }
                `
              }} />
              <div className="config-descriptions">
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="区块链节点地址" span={1}>
                    <Text code style={{ whiteSpace: 'nowrap' }}>{getNodeUrl()}</Text>
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopy(getNodeUrl())}
                      style={{ marginLeft: '8px' }}
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="备注" span={1}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Substrate区块链网络的WebSocket连接地址，用于前端应用与区块链节点建立实时连接，支持查询链上数据、提交交易、监听区块事件等操作。
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="中继器地址" span={1}>
                    <Text code style={{ whiteSpace: 'nowrap' }}>{getPruntimeUrl()}</Text>
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopy(getPruntimeUrl())}
                      style={{ marginLeft: '8px' }}
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="备注" span={1}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      pRuntime（隐私运行时）中继服务地址，作为区块链与TEE（可信执行环境）设备之间的通信桥梁。负责转发隐私计算任务到TEE Worker节点，处理加密数据交互，并确保TEE设备与链上合约之间的安全通信。
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="前端服务地址" span={1}>
                    <Text code style={{ whiteSpace: 'nowrap' }}>http://8.147.107.221:3000</Text>
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopy('http://8.147.107.221:3000')}
                      style={{ marginLeft: '8px' }}
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="备注" span={1}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Web管理界面的HTTP访问地址，提供链计算平台的用户交互界面。用户可通过该地址访问系统管理、资源监控、合约部署、密钥管理等功能的可视化操作界面，该服务集成了前端应用和后端API代理。
                    </Text>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </Card>
          </Col>

          {/* 开发工具 */}
          <Col span={24}>
            <Card title="开发工具" extra={<CodeOutlined />}>
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={8}>
                  <Card size="small" title="区块链 CLI">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text code>cargo install phala-cli</Text>
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy('cargo install phala-cli')}
                      />
                      <Text type="secondary">区块链命令行工具</Text>
                    </Space>
                  </Card>
                </Col>

                <Col xs={24} lg={8}>
                  <Card size="small" title="隐私合约开发">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text code>cargo install pink-cli</Text>
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy('cargo install pink-cli')}
                      />
                      <Text type="secondary">隐私合约开发工具</Text>
                    </Space>
                  </Card>
                </Col>

                <Col xs={24} lg={8}>
                  <Card size="small" title="Substrate连接">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text code>npm install @polkadot/api</Text>
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy('npm install @polkadot/api')}
                      />
                      <Text type="secondary">Polkadot API客户端</Text>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </MainLayout>
    </AuthGuard>
  );
};

export default ToolsPage;