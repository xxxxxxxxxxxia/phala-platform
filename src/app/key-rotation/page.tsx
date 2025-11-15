'use client';

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Progress, Alert, Spin, Typography, Space, Divider, Badge, Switch, Button, Modal, Input, Form, TimePicker, Flex, Collapse } from 'antd';
import { KeyOutlined, LockOutlined, SecurityScanOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, SettingOutlined, HistoryOutlined, RotateLeftOutlined, DatabaseOutlined, FileTextOutlined } from '@ant-design/icons';
import MainLayout from '../../components/layout/MainLayout';
import AuthGuard from '../../components/AuthGuard';

const { Title, Text } = Typography;

interface KeyRotation {
  id: string;
  keyId: string;
  keyType: 'ECDSA' | 'Ed25519' | 'SR25519' | 'BLS';
  status: 'active' | 'rotating' | 'expired' | 'revoked';
  owner: string;
  algorithm: string;
  keySize: number; // bits
  // 只保留真实可获取的数据
  publicKey?: string; // 真实的公钥
  registered?: boolean; // 注册状态
}

interface RotationState {
  keys: KeyRotation[];
  totalKeys: number;
  activeKeys: number;
  rotatingKeys: number;
  expiredKeys: number;
  lastUpdate: number;
}

interface RotationConfig {
  interval: number;
  autoRotation: boolean;
  lastRotation: number | null;
  nextRotation: number | null;
}

interface RotationHistory {
  id: string;
  type: string;
  status: string;
  startTime: number;
  endTime: number | null;
  txHash: string | null;
  error: string | null;
  account: string | null;
}

interface ClusterInfo {
  clusterId: string;
  systemContract: string;
  owner: string | {
    hex: string;
    ss58: string;
    name: string | null;
  };
  permission: string;
  clusterKey: string | null;
  hasClusterKey: boolean;
  contracts: ContractInfo[];
  contractCount: number;
}

interface ContractInfo {
  contractId: string;
  contractKey: string | null;
  contractInfo: any;
  hasKey: boolean;
}

const initialRotationState: RotationState = {
  keys: [],
  totalKeys: 0,
  activeKeys: 0,
  rotatingKeys: 0,
  expiredKeys: 0,
  lastUpdate: 0,
};

export default function KeyRotationPage() {
  const [rotationState, setRotationState] = useState<RotationState>(initialRotationState);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [rotationConfig, setRotationConfig] = useState<RotationConfig | null>(null);
  const [rotationHistory, setRotationHistory] = useState<RotationHistory[]>([]);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [rotateModalVisible, setRotateModalVisible] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [form] = Form.useForm();
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo[]>([]);
  const [clusterLoading, setClusterLoading] = useState(false);

  // 通知队列管理
  let notificationCount = 0;
  
  // 自定义通知组件
  const showCustomNotification = (message: string, type: 'success' | 'error' | 'info' | 'loading' = 'info', duration: number = 3000) => {
    const notification = document.createElement('div');
    const colors = {
      success: '#52c41a',
      error: '#ff4d4f',
      info: '#1890ff',
      loading: '#722ed1'
    };
    
    // 计算垂直位置，每个通知间隔60px
    const topPosition = 20 + (notificationCount * 60);
    notificationCount++;
    
    notification.style.cssText = `
      position: fixed;
      top: ${topPosition}px;
      right: 20px;
      z-index: 9999;
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      background-color: ${colors[type]};
      border: 1px solid ${colors[type]};
      max-width: 300px;
      word-wrap: break-word;
      animation: slideIn 0.3s ease-out;
    `;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
            notificationCount--; // 移除时减少计数
          }
        }, 300);
      }
    }, duration);
  };

  useEffect(() => {
    loadRotationState();
    loadRotationConfig();
    loadClusterKeys();
    
    // 启动定时轮询，检测自动轮换
    const pollInterval = setInterval(() => {
      loadRotationState(false); // 刷新密钥状态，不显示加载状态
      loadRotationConfig(); // 刷新历史记录
      loadClusterKeys(false); // 刷新集群密钥，不显示加载状态
    }, 10000); // 每10秒检查一次
    
    // 清理定时器
    return () => clearInterval(pollInterval);
  }, []);

  const loadRotationState = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch('/api/key-rotation?action=status');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: RotationState = await response.json();
      setRotationState(data);
    } catch (error) {
      console.error('Failed to load rotation state:', error);
      setRotationState(initialRotationState);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadRotationConfig = async () => {
    try {
      const response = await fetch('/api/key-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-rotation-config' })
      });
      if (response.ok) {
        const data = await response.json();
        setRotationConfig(data.config);
        setRotationHistory(data.history);
      }
    } catch (error) {
      console.error('Failed to load rotation config:', error);
    }
  };

  const loadClusterKeys = async (showLoading = true) => {
    if (showLoading) setClusterLoading(true);
    try {
      const response = await fetch('/api/key-rotation?action=cluster-keys');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setClusterInfo(data.clusters || []);
        }
      }
    } catch (error) {
      console.error('Failed to load cluster keys:', error);
    } finally {
      if (showLoading) setClusterLoading(false);
    }
  };

  const handleMasterKeyRotation = async () => {
    if (isRotating) return; // 防止重复点击
    
    try {
      console.log('开始主密钥轮换...');
      setIsRotating(true);
      
      // 显示加载提示
      showCustomNotification('正在执行主密钥轮换，请稍候...', 'loading', 2000);
      
      const response = await fetch('/api/key-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'rotate-master-key'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log('主密钥轮换成功');
        
        // 显示成功提示
        showCustomNotification('✅ 主密钥轮换成功完成', 'success', 4000);
        
        // 重新加载密钥状态，确保显示最新的密钥信息
        await loadRotationState();
        // 重新加载配置和历史
        await loadRotationConfig();
      } else {
        console.log('主密钥轮换失败');
        showCustomNotification(`❌ 轮换失败: ${data.error || '未知错误'}`, 'error', 5000);
      }
    } catch (error) {
      console.error('轮换请求失败:', error);
      showCustomNotification(`❌ 轮换请求失败: ${error.message}`, 'error', 5000);
    } finally {
      setIsRotating(false);
    }
  };

  const handleSetRotationInterval = async (intervalMinutes: number) => {
    try {
      // 将分钟转换为毫秒
      const intervalMs = intervalMinutes * 60 * 1000;
      
      const response = await fetch('/api/key-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'set-rotation-interval',
          interval: intervalMs 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showCustomNotification('轮换间隔已更新', 'success', 3000);
        setConfigModalVisible(false);
        loadRotationConfig();
      } else {
        showCustomNotification(data.error || '设置失败', 'error', 4000);
      }
    } catch (error) {
      showCustomNotification('设置请求失败', 'error', 4000);
      console.error('Set interval error:', error);
    }
  };

  const handleToggleAutoRotation = async (enabled: boolean) => {
    try {
      console.log('切换自动轮换状态:', enabled);
      console.log('当前rotationConfig:', rotationConfig);
      
      const response = await fetch('/api/key-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'toggle-auto-rotation',
          enabled: enabled
        })
      });
      
      const data = await response.json();
      console.log('API响应:', data);
      
      if (data.success) {
        const intervalMinutes = Math.round(rotationConfig?.interval / (60 * 1000)) || 1440;
        if (enabled) {
          showCustomNotification(`✅ 自动轮换已启用\n轮换间隔: ${intervalMinutes}分钟`, 'success', 4000);
        } else {
          showCustomNotification('❌ 自动轮换已禁用\n现在可以手动轮换', 'info', 4000);
        }
        loadRotationConfig();
      } else {
        showCustomNotification(data.error || '设置失败', 'error', 4000);
      }
    } catch (error) {
      showCustomNotification('设置请求失败', 'error', 4000);
      console.error('Toggle auto rotation error:', error);
    }
  };

  // 更新单个密钥的详细信息
  const updateSingleKey = (keyId: string, updates: Partial<KeyRotation>) => {
    setRotationState(prev => ({
      ...prev,
      keys: prev.keys.map(k =>
        k.id === keyId
          ? { ...k, ...updates }
          : k
      )
    }));
  };






  const columns = [
    {
      title: '密钥ID',
      dataIndex: 'keyId',
      key: 'keyId',
      width: 120,
      render: (text: string) => <Text copyable style={{ fontSize: '11px' }}>{text.substring(0, 12)}...</Text>,
    },
    {
      title: '密钥类型',
      dataIndex: 'keyType',
      key: 'keyType',
      width: 100,
      render: (type: string, record: any) => {
        const colors = { 'ECDSA': 'blue', 'Ed25519': 'green', 'SR25519': 'purple', 'BLS': 'orange' };
        // 主密钥特殊显示
        if (record.keyId && record.keyId.startsWith('GK_')) {
          return <Tag color="red" style={{ fontWeight: 'bold' }}>主密钥</Tag>;
        }
        return <Tag color={colors[type as keyof typeof colors]}>{type}</Tag>;
      },
    },
    {
      title: '所有者',
      dataIndex: 'owner',
      key: 'owner',
      width: 120,
      render: (owner: string, record: any) => {
        if (owner === 'System') return <Tag color="blue">系统</Tag>;
        if (owner === 'Gatekeeper') return <Tag color="red">Gatekeeper</Tag>;
        // 主密钥的所有者特殊显示
        if (record.keyId && record.keyId.startsWith('GK_')) {
          return <Tag color="red" style={{ fontWeight: 'bold' }}>{owner.substring(0, 15)}...</Tag>;
        }
        return <Text style={{ fontSize: '11px' }}>{owner.substring(0, 15)}...</Text>;
      },
    },
    {
      title: '算法',
      dataIndex: 'algorithm',
      key: 'algorithm',
      width: 100,
      render: (algorithm: string) => <Text style={{ fontSize: '11px' }}>{algorithm}</Text>,
    },
    {
      title: '密钥长度',
      dataIndex: 'keySize',
      key: 'keySize',
      width: 80,
      render: (size: number) => <Text style={{ fontSize: '11px' }}>{size}位</Text>,
    },
  ];

  return (
    <AuthGuard>
      <MainLayout>
        <Title level={2} style={{ fontSize: '18pt' }}>密钥轮换协议</Title>
        <Text type="secondary">
          管理隐私合约的密钥轮换，保证链上合约数据的前向隐私安全。
        </Text>
        <Divider />



        {/* 密钥详细信息展示 */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card title="系统密钥详情" extra={<LockOutlined />}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>系统主密钥 (SR25519)</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    基于Pruntime的public_key生成，用于系统核心加密操作
                  </Text>
                  <br />
                  <Tag color="blue">算法: Sr25519</Tag>
                  <Tag color="purple">长度: 256位</Tag>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <Text strong>ECDH交换密钥 (ECDSA)</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    基于Pruntime的ecdh_public_key，用于密钥交换和协商
                  </Text>
                  <br />
                  <Tag color="blue">算法: secp256k1</Tag>
                  <Tag color="purple">长度: 256位</Tag>
                </div>
              </Space>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Gatekeeper密钥详情" extra={<SecurityScanOutlined />}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>Gatekeeper主密钥 (SR25519)</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    基于Gatekeeper的master_public_key，负责TEE设备认证和密钥管理
                  </Text>
                  <br />
                  <Tag color="blue">算法: Sr25519</Tag>
                  <Tag color="purple">长度: 256位</Tag>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <Text strong>密钥功能说明</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    • ECDH密钥：处理密钥交换协议<br />
                    • Gatekeeper密钥：管理TEE设备认证<br />
                    • Worker密钥：计算节点通信加密
                  </Text>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 密钥轮换说明 */}
        <Card title="密钥轮换机制说明" style={{ marginBottom: '24px' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <div style={{ textAlign: 'center' }}>
                <SyncOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                <Title level={5} style={{ marginTop: '8px' }}>自动轮换</Title>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  系统根据密钥使用频率和安全性要求自动触发密钥轮换
                </Text>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ textAlign: 'center' }}>
                <SecurityScanOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                <Title level={5} style={{ marginTop: '8px' }}>前向安全</Title>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  新密钥生成后，旧密钥立即失效，确保历史数据的前向隐私安全
                </Text>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ textAlign: 'center' }}>
                <LockOutlined style={{ fontSize: '24px', color: '#faad14' }} />
                <Title level={5} style={{ marginTop: '8px' }}>安全备份</Title>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  所有密钥都有安全备份机制，防止密钥丢失导致的数据不可访问
                </Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* 主密钥轮换控制面板 */}
        <Flex 
          justify="space-between" 
          align="middle"
          style={{ 
            marginTop: '24px', 
            marginBottom: '16px',
            padding: '16px 24px',
            background: '#001529',
            borderRadius: '8px',
            border: '1px solid #434343',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          <Space>
            <RotateLeftOutlined style={{ color: 'white' }} />
            <Text style={{ color: 'white' }}>主密钥轮换控制</Text>
            <Divider type="vertical" style={{ borderColor: '#666' }} />
            <Text type="secondary" style={{ color: '#ccc' }}>
              轮换间隔: 
              <Text style={{ color: '#1890ff', fontWeight: 'bold' }}>
                {rotationConfig ? Math.round(rotationConfig.interval / (60 * 1000)) : 1440}分钟
              </Text>
            </Text>
          </Space>
          <Space>
            <Switch
              checked={rotationConfig?.autoRotation === true}
              onChange={(checked) => {
                console.log('Switch被点击，新状态:', checked);
                handleToggleAutoRotation(checked);
              }}
              checkedChildren="自动"
              unCheckedChildren="手动"
              style={{ backgroundColor: rotationConfig?.autoRotation ? '#52c41a' : '#d9d9d9' }}
              disabled={!rotationConfig}
            />
            <Button 
              icon={<SettingOutlined />} 
              onClick={() => setConfigModalVisible(true)}
            >
              设置
            </Button>
            <Button 
              icon={<HistoryOutlined />} 
              onClick={() => setHistoryModalVisible(true)}
            >
              历史
            </Button>
            <Button 
              type="primary" 
              icon={<RotateLeftOutlined />}
              onClick={handleMasterKeyRotation}
              loading={isRotating}
              disabled={isRotating || rotationConfig?.autoRotation === true}
            >
              {isRotating ? '轮换中...' : rotationConfig?.autoRotation ? '自动模式' : '立即轮换'}
            </Button>
          </Space>
        </Flex>

        {/* 密钥列表 */}
        <Card 
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>密钥管理列表</span>
              <Text style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)' }}>
                密钥总数: {rotationState.totalKeys}
              </Text>
            </div>
          }
          style={{ marginBottom: '24px' }}
        >
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={rotationState.keys}
              rowKey="id"
              pagination={{ pageSize: 10, showSizeChanger: true, showQuickJumper: true }}
              scroll={{ x: 1400 }}
              size="small"
            />
          </Spin>
        </Card>

        {/* 集群和合约密钥展示 */}
        <Card 
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><DatabaseOutlined /> 集群和合约密钥</span>
              <Text style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)' }}>
                集群总数: {clusterInfo.length}
              </Text>
            </div>
          }
        >
          <Spin spinning={clusterLoading}>
            {clusterInfo.length === 0 ? (
              <Alert
                message="暂无集群信息"
                description="当前没有找到任何集群，请确保集群已部署。"
                type="info"
                showIcon
              />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                {clusterInfo.map((cluster, index) => (
                  <Card
                    key={index}
                    size="small"
                    title={
                      <Space>
                        <DatabaseOutlined />
                        <Text strong>集群 {index + 1}</Text>
                        <Tag color={cluster.hasClusterKey ? 'green' : 'orange'}>
                          {cluster.hasClusterKey ? '集群密钥已就绪' : '集群密钥未就绪'}
                        </Tag>
                      </Space>
                    }
                    extra={
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        合约数: {cluster.contractCount}
                      </Text>
                    }
                  >
                    <Row gutter={[16, 16]}>
                      {/* 集群ID */}
                      <Col xs={24} sm={12} md={8}>
                        <div>
                          <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                            集群ID
                          </Text>
                          <Text copyable={{ text: cluster.clusterId }} style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                            {cluster.clusterId.substring(0, 12)}...
                          </Text>
                        </div>
                      </Col>
                      {/* 集群密钥 */}
                      <Col xs={24} sm={12} md={8}>
                        <div>
                          <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                            集群密钥
                          </Text>
                          {cluster.hasClusterKey ? (
                            <Text copyable={{ text: cluster.clusterKey || '' }} style={{ fontSize: '11px', fontFamily: 'monospace', color: '#52c41a' }}>
                              {cluster.clusterKey?.substring(0, 12)}...
                            </Text>
                          ) : (
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              等待生成中...
                            </Text>
                          )}
                        </div>
                      </Col>
                    </Row>

                    {/* 合约列表 - 使用表格形式，和上边的管理列表风格一致 */}
                    {cluster.contracts.length > 0 && (
                      <>
                        <Divider style={{ margin: '16px 0' }} />
                        <div>
                          <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: '12px' }}>
                            <FileTextOutlined style={{ marginRight: '4px' }} />
                            合约密钥列表 ({cluster.contracts.length})
                          </Text>
                          <Table
                            dataSource={cluster.contracts}
                            rowKey={(record, idx) => `contract-${idx}`}
                            pagination={false}
                            size="small"
                            columns={[
                              {
                                title: '序号',
                                key: 'index',
                                width: 60,
                                render: (_: any, __: any, index: number) => (
                                  <Text style={{ fontSize: '11px' }}>#{index + 1}</Text>
                                ),
                              },
                              {
                                title: '状态',
                                key: 'status',
                                width: 80,
                                render: (_: any, record: any) => (
                                  <Tag color={record.hasKey ? 'green' : 'orange'} style={{ fontSize: '11px' }}>
                                    {record.hasKey ? '密钥已就绪' : '密钥未就绪'}
                                  </Tag>
                                ),
                              },
                              {
                                title: '合约地址',
                                dataIndex: 'contractId',
                                key: 'contractId',
                                render: (text: string) => (
                                  <Text copyable={{ text }} style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                                    {text.substring(0, 12)}...
                                  </Text>
                                ),
                              },
                              {
                                title: '合约密钥',
                                dataIndex: 'contractKey',
                                key: 'contractKey',
                                render: (text: string | null, record: any) => {
                                  if (!record.hasKey || !text) {
                                    return <Text type="secondary" style={{ fontSize: '11px' }}>未生成</Text>;
                                  }
                                  return (
                                    <Text copyable={{ text }} style={{ fontSize: '11px', fontFamily: 'monospace', color: '#52c41a' }}>
                                      {text.substring(0, 12)}...
                                    </Text>
                                  );
                                },
                              },
                            ]}
                          />
                        </div>
                      </>
                    )}
                  </Card>
                ))}
              </Space>
            )}
          </Spin>
        </Card>

        {/* 轮换设置模态框 */}
        <Modal
          title="轮换设置"
          open={configModalVisible}
          onCancel={() => setConfigModalVisible(false)}
          footer={[
            <Button key="cancel" onClick={() => setConfigModalVisible(false)}>
              取消
            </Button>,
            <Button 
              key="confirm" 
              type="primary" 
              onClick={() => {
                form.validateFields().then(values => {
                  handleSetRotationInterval(values.interval); // 直接传递分钟数
                });
              }}
            >
              确认
            </Button>
          ]}
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="interval"
              label="轮换间隔（分钟）"
              rules={[{ required: true, message: '请输入轮换间隔' }]}
              initialValue={rotationConfig ? Math.round(rotationConfig.interval / (60 * 1000)) : 1440}
            >
              <Input type="number" min={1} max={525600} />
            </Form.Item>
          </Form>
        </Modal>

        {/* 轮换历史模态框 */}
        <Modal
          title="轮换历史"
          open={historyModalVisible}
          onCancel={() => setHistoryModalVisible(false)}
          footer={null}
          width={800}
        >
          <Table
            dataSource={rotationHistory}
            columns={[
              {
                title: '类型',
                dataIndex: 'type',
                key: 'type',
                width: 100,
                render: (type: string) => (
                  <Tag color={type === 'master_key' ? 'blue' : 'green'}>
                    {type === 'master_key' ? '主密钥' : type}
                  </Tag>
                )
              },
              {
                title: '旧密钥',
                dataIndex: 'oldKey',
                key: 'oldKey',
                width: 150,
                render: (key: string | null) => {
                  if (!key || key === 'unknown') return '-';
                  return <Text style={{ fontSize: '11px' }}>{key.substring(0, 12)}...</Text>;
                }
              },
              {
                title: '新密钥',
                dataIndex: 'newKey',
                key: 'newKey',
                width: 150,
                render: (key: string | null) => {
                  if (!key || key === 'unknown') return '-';
                  return <Text style={{ fontSize: '11px' }}>{key.substring(0, 12)}...</Text>;
                }
              },
              {
                title: '开始时间',
                dataIndex: 'startTime',
                key: 'startTime',
                width: 150,
                render: (time: number) => new Date(time).toLocaleString()
              },
              {
                title: '结束时间',
                dataIndex: 'endTime',
                key: 'endTime',
                width: 150,
                render: (time: number | null) => time ? new Date(time).toLocaleString() : '-'
              },
              {
                title: '交易哈希',
                dataIndex: 'txHash',
                key: 'txHash',
                width: 120,
                render: (hash: string | null) => hash ? <Text style={{ fontSize: '11px' }}>{hash.substring(0, 8)}...</Text> : '-'
              }
            ]}
            pagination={{ pageSize: 5 }}
            size="small"
          />
        </Modal>


      </MainLayout>
    </AuthGuard>
  );
}