'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Progress, Alert, Spin, Typography, Space, Divider, Badge, Switch, Button, Modal, Input, Form, TimePicker, Flex, Collapse, Tooltip } from 'antd';
import { KeyOutlined, LockOutlined, SecurityScanOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, SettingOutlined, HistoryOutlined, RotateLeftOutlined, DatabaseOutlined, FileTextOutlined } from '@ant-design/icons';
import MainLayout from '../../../components/layout/MainLayout';
import AuthGuard from '../../../components/AuthGuard';

const { Title, Text } = Typography;
const KMS_API_BASE_URL = 'http://8.147.106.136:8888';

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

interface KmsRotationConfig extends RotationConfig {}

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

interface RootKeyInfo {
  ca_pubkey: string;
  k256_pubkey: string;
  quote?: string;
  eventlog?: string;
}

interface RootKeyHistoryResponse {
  oldKey: RootKeyInfo;
  newKey: RootKeyInfo;
  updateTime: string;
  ip: string;
  port: number;
}

interface RootKeyHistoryEntry {
  id: string;
  type: string;
  oldKey: RootKeyInfo | null;
  newKey: RootKeyInfo | null;
  startTime: number;
  endTime: number;
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

interface KmsMetaInfo {
  ip: string;
  port: number;
  caPubkey: string;
  k256Pubkey: string;
}

const initialRotationState: RotationState = {
  keys: [],
  totalKeys: 0,
  activeKeys: 0,
  rotatingKeys: 0,
  expiredKeys: 0,
  lastUpdate: 0,
};

const defaultKmsRotationConfig: KmsRotationConfig = {
  interval: 24 * 60 * 60 * 1000,
  autoRotation: false,
  lastRotation: null,
  nextRotation: null,
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
  const [kmsMeta, setKmsMeta] = useState<KmsMetaInfo | null>(null);
  const [kmsMetaLoading, setKmsMetaLoading] = useState(false);
  const [kmsRotating, setKmsRotating] = useState(false);
  const [kmsRotationConfig, setKmsRotationConfig] = useState<KmsRotationConfig>(defaultKmsRotationConfig);
  const [rootKeyHistoryRaw, setRootKeyHistoryRaw] = useState<RootKeyHistoryResponse[]>([]);
  const [rootKeyHistory, setRootKeyHistory] = useState<RootKeyHistoryEntry[]>([]);
  const [kmsConfigModalVisible, setKmsConfigModalVisible] = useState(false);
  const [kmsHistoryModalVisible, setKmsHistoryModalVisible] = useState(false);
  const [kmsForm] = Form.useForm();

  const kmsAddress = kmsMeta ? `${kmsMeta.ip}:${kmsMeta.port}` : '';
  const kmsKeyRows = kmsMeta
    ? [
        {
          key: 'ca_pubkey',
          name: 'CA Root',
          value: kmsMeta.caPubkey,
          keyType: '主密钥',
          owner: kmsAddress,
          algorithm: 'ECDSA P-256',
        },
        {
          key: 'k256_pubkey',
          name: 'K256 Root',
          value: kmsMeta.k256Pubkey,
          keyType: '主密钥',
          owner: kmsAddress,
          algorithm: 'secp256k1',
        },
      ]
    : [];

  // 通知队列管理
  let notificationCount = 0;

  // 自定义通知组件
  const showCustomNotification = (message: string, type: 'success' | 'error' | 'info' | 'loading' | 'warning' = 'info', duration: number = 3000) => {
    const notification = document.createElement('div');
    const colors = {
      success: '#52c41a',
      error: '#ff4d4f',
      info: '#1890ff',
      loading: '#722ed1',
      warning: '#faad14',
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
    if (kmsConfigModalVisible) {
      kmsForm.setFieldsValue({
        interval: Math.round(kmsRotationConfig.interval / (60 * 1000))
      });
    }
  }, [kmsConfigModalVisible, kmsRotationConfig, kmsForm]);

  const loadKmsLocalData = () => {
    if (typeof window === 'undefined') return;
    try {
      const storedConfig = window.localStorage.getItem('phala_kms_rotation_config');
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig);
        setKmsRotationConfig({
          ...defaultKmsRotationConfig,
          ...parsed
        });
      }
    } catch (error) {
      console.error('Failed to load KMS rotation data:', error);
    }
  };

  const persistKmsConfig = (config: KmsRotationConfig) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('phala_kms_rotation_config', JSON.stringify(config));
  };

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

  const loadKmsMeta = async (showLoading = true) => {
    if (showLoading) setKmsMetaLoading(true);
    try {
      const response = await fetch(`${KMS_API_BASE_URL}/api/kms/get-meta`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        setKmsMeta({
          ip: result.ip,
          port: result.port,
          caPubkey: result.data?.ca_pubkey || '',
          k256Pubkey: result.data?.k256_pubkey || '',
        });
      } else {
        setKmsMeta(null);
      }
    } catch (error) {
      console.error('Failed to load KMS meta info:', error);
      setKmsMeta(null);
    } finally {
      if (showLoading) setKmsMetaLoading(false);
    }
  };

  const formatRootKeyHistory = useCallback((rawData: RootKeyHistoryResponse[]) => {
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return [];
    }

    const intervalMs = kmsRotationConfig.interval || defaultKmsRotationConfig.interval;
    const sortedAsc = [...rawData].sort(
      (a, b) => new Date(a.updateTime).getTime() - new Date(b.updateTime).getTime()
    );

    const computed = sortedAsc.map((entry, index) => {
      const currentUpdate = new Date(entry.updateTime).getTime();
      const previousUpdate =
        index > 0
          ? new Date(sortedAsc[index - 1].updateTime).getTime()
          : currentUpdate - intervalMs;

      return {
        id: `${entry.updateTime}-${entry.ip}-${entry.port}-${index}`,
        type: `${entry.ip}:${entry.port}`,
        oldKey: entry.oldKey || null,
        newKey: entry.newKey || null,
        startTime: Math.max(previousUpdate, 0),
        endTime: currentUpdate,
      };
    });

    return computed.sort((a, b) => b.endTime - a.endTime);
  }, [kmsRotationConfig.interval]);

  const loadRootKeyHistory = useCallback(async () => {
    try {
      const response = await fetch(`${KMS_API_BASE_URL}/api/rootkey/history`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setRootKeyHistoryRaw(result.data);
        setRootKeyHistory(formatRootKeyHistory(result.data));
      } else {
        setRootKeyHistory([]);
      }
    } catch (error) {
      console.error('Failed to load root key history:', error);
      setRootKeyHistory([]);
    }
  }, [formatRootKeyHistory]);

  useEffect(() => {
    if (rootKeyHistoryRaw.length > 0) {
      setRootKeyHistory(formatRootKeyHistory(rootKeyHistoryRaw));
    }
  }, [formatRootKeyHistory, rootKeyHistoryRaw]);

  useEffect(() => {
    loadRotationState();
    loadRotationConfig();
    loadClusterKeys();
    loadKmsMeta();
    loadKmsLocalData();
    loadRootKeyHistory();

    // 启动定时轮询，检测自动轮换
    const pollInterval = setInterval(() => {
      loadRotationState(false); // 刷新密钥状态，不显示加载状态
      loadRotationConfig(); // 刷新历史记录
      loadClusterKeys(false); // 刷新集群密钥，不显示加载状态
      loadKmsMeta(false); // 刷新KMS元信息
      loadRootKeyHistory(); // 刷新根密钥历史
    }, 60000); // 每60秒检查一次

    // 清理定时器
    return () => clearInterval(pollInterval);
  }, [loadRootKeyHistory]);

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
        await loadRootKeyHistory();
      } else {
        console.log('主密钥轮换失败');
        showCustomNotification(`❌ 轮换失败: ${data.error || '未知错误'}`, 'error', 5000);
        await loadRootKeyHistory();
      }
    } catch (error) {
      console.error('轮换请求失败:', error);
      showCustomNotification(`❌ 轮换请求失败: ${error.message}`, 'error', 5000);
      await loadRootKeyHistory();
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

  const handleRotateKmsRootKey = async () => {
    if (kmsRotating) return;
    setKmsRotating(true);
    try {
      showCustomNotification('正在轮换海光CSV主密钥...', 'loading', 2000);
      const response = await fetch(`${KMS_API_BASE_URL}/api/rotate/rootkey?ip=43.132.154.142&port=9210`);
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.success !== false) {
        showCustomNotification('✅ 海光CSV主密钥轮换成功', 'success', 4000);
        await loadKmsMeta();
        const now = Date.now();
        const updatedConfig = {
          ...kmsRotationConfig,
          lastRotation: now,
          nextRotation: now + kmsRotationConfig.interval,
        };
        setKmsRotationConfig(updatedConfig);
        persistKmsConfig(updatedConfig);
        await loadRootKeyHistory();
      } else {
        const message = result.error || `请求失败，状态码 ${response.status}`;
        showCustomNotification(`❌ 密钥轮换失败: ${message}`, 'error', 5000);
        await loadRootKeyHistory();
      }
    } catch (error: any) {
      showCustomNotification(`❌ 密钥轮换异常: ${error.message}`, 'error', 5000);
      await loadRootKeyHistory();
    } finally {
      setKmsRotating(false);
    }
  };

  const handleToggleKmsAutoRotation = (enabled: boolean) => {
    const updatedConfig = {
      ...kmsRotationConfig,
      autoRotation: enabled,
    };
    setKmsRotationConfig(updatedConfig);
    persistKmsConfig(updatedConfig);
    const intervalMinutes = Math.round(updatedConfig.interval / (60 * 1000));
    if (enabled) {
      showCustomNotification(`✅ 海光CSV自动轮换已启用\n轮换间隔: ${intervalMinutes}分钟`, 'success', 4000);
    } else {
      showCustomNotification('❌ 海光CSV自动轮换已禁用', 'info', 4000);
    }
  };

  const handleSetKmsRotationInterval = (intervalMinutes: number) => {
    if (intervalMinutes < 60) {
      showCustomNotification('轮换间隔必须不小于 60 分钟', 'warning', 3000);
      return;
    }
    const intervalMs = intervalMinutes * 60 * 1000;
    const updatedConfig = {
      ...kmsRotationConfig,
      interval: intervalMs,
      nextRotation: kmsRotationConfig.lastRotation ? kmsRotationConfig.lastRotation + intervalMs : null
    };
    setKmsRotationConfig(updatedConfig);
    persistKmsConfig(updatedConfig);
    setKmsConfigModalVisible(false);
    showCustomNotification('海光CSV轮换间隔已更新', 'success', 3000);
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


  const formatKeyPreview = (key: string | undefined) => {
    if (!key) return '-';
    if (key.length <= 32) return key;
    return `${key.slice(0, 16)}...${key.slice(-8)}`;
  };

  const renderKeyDetails = (keyData: RootKeyInfo | null) => {
    if (!keyData) return '-';
    return (
      <Space direction="vertical" size={4}>
        <Space size={8}>
          <Text type="secondary" style={{ width: 68 }}>CA Root</Text>
          <Text copyable={{ text: keyData.ca_pubkey }} style={{ fontSize: '11px' }}>
            {formatKeyPreview(keyData.ca_pubkey)}
          </Text>
        </Space>
        <Space size={8}>
          <Text type="secondary" style={{ width: 68 }}>K256 Root</Text>
          <Text copyable={{ text: keyData.k256_pubkey }} style={{ fontSize: '11px' }}>
            {formatKeyPreview(keyData.k256_pubkey)}
          </Text>
        </Space>
      </Space>
    );
  };

  const columns = [
    {
      title: '公钥',
      dataIndex: 'keyId',
      key: 'keyId',
      width: 120,
      render: (text: string, record: KeyRotation) => {
        // 直接去掉前缀（SR25519_、ECDSA_等）
        let cleanKey = text;
        const hadEllipsis = text.endsWith('...'); // 记录原始是否有省略号
        if (text.includes('_')) {
          const parts = text.split('_');
          if (parts.length > 1) {
            // 去掉第一个部分（算法前缀），保留后面的密钥部分
            cleanKey = parts.slice(1).join('_');
          }
        }
        // 去掉末尾的省略号
        cleanKey = cleanKey.replace(/\.\.\.$/, '');
        
        // 使用完整的publicKey作为tooltip内容和复制内容，如果没有则使用处理后的cleanKey
        const fullKey = record.publicKey || cleanKey;
        
        const displayLength = 12; // 显示前12位
        // 如果密钥长度超过显示长度，或者原始数据有省略号，都显示省略号
        const shouldShowEllipsis = cleanKey.length > displayLength || hadEllipsis;
        const displayText = shouldShowEllipsis 
          ? `${cleanKey.substring(0, displayLength)}...` 
          : cleanKey;
        return (
          <Tooltip title={fullKey} placement="top">
            <Text 
              copyable={{ text: fullKey, tooltips: ['复制', '已复制'] }} 
              style={{ fontSize: '11px', cursor: 'pointer' }}
            >
              {displayText}
            </Text>
          </Tooltip>
        );
      },
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
            <Card title="密钥详情" extra={<LockOutlined />}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>主密钥 (SR25519)</Text>
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
              <span>SGX-密钥管理列表</span>
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

        {/* 海光CSV轮换控制 */}
        <Flex
          justify="space-between"
          align="middle"
          style={{
            marginTop: '24px',
            marginBottom: '16px',
            padding: '16px 24px',
            background: '#000c17',
            borderRadius: '8px',
            border: '1px solid #434343',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
        >
          <Space>
            <RotateLeftOutlined style={{ color: 'white' }} />
            <Text style={{ color: 'white' }}>海光CSV主密钥轮换</Text>
            <Divider type="vertical" style={{ borderColor: '#666' }} />
            <Text type="secondary" style={{ color: '#ccc' }}>
              轮换间隔:
              <Text style={{ color: '#1890ff', fontWeight: 'bold' }}>
                {Math.round(kmsRotationConfig.interval / (60 * 1000))}分钟
              </Text>
            </Text>
          </Space>
          <Space>
            <Switch
              checked={kmsRotationConfig.autoRotation}
              onChange={handleToggleKmsAutoRotation}
              checkedChildren="自动"
              unCheckedChildren="手动"
              style={{ backgroundColor: kmsRotationConfig.autoRotation ? '#52c41a' : '#d9d9d9' }}
            />
            <Button
              icon={<SettingOutlined />}
              onClick={() => setKmsConfigModalVisible(true)}
            >
              设置
            </Button>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => setKmsHistoryModalVisible(true)}
            >
              历史
            </Button>
            <Button
              type="primary"
              icon={<RotateLeftOutlined />}
              loading={kmsRotating}
              onClick={handleRotateKmsRootKey}
              disabled={kmsRotating || kmsRotationConfig.autoRotation}
            >
              {kmsRotating ? '轮换中...' : kmsRotationConfig.autoRotation ? '自动模式' : '立即轮换'}
            </Button>
          </Space>
        </Flex>

        {/* 海光CSV密钥展示 */}
        <Card
          style={{ marginTop: 24 }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>海光CSV-密钥管理列表 </span>
            </div>
          }
          extra={
            <Space size="middle">
              <Button type="link" onClick={() => loadKmsMeta()} style={{ padding: 0 }}>
                刷新
              </Button>
            </Space>
          }
        >
          <Spin spinning={kmsMetaLoading}>
            {kmsMeta ? (
              <Table
                dataSource={kmsKeyRows}
                rowKey="key"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '密钥名称',
                    dataIndex: 'name',
                    key: 'name',
                    width: 100,
                    render: (text: string) => <Text style={{ fontSize: '11px' }}>{text}</Text>,
                  },
                  {
                    title: '公钥',
                    dataIndex: 'value',
                    key: 'value',
                    width: 100,
                    render: (text: string) => (
                      <Text
                        copyable={{ text }}
                        ellipsis={{ tooltip: text }}
                        style={{ fontSize: '11px', fontFamily: 'monospace', display: 'inline-block', maxWidth: '100%' }}
                      >
                        {text}
                      </Text>
                    ),
                  },
                  {
                    title: '密钥类型',
                    dataIndex: 'keyType',
                    key: 'keyType',
                    width: 120,
                    render: (text: string) => <Tag color="blue" style={{ fontSize: '11px' }}>{text}</Tag>,
                  },
                  {
                    title: '所有者',
                    dataIndex: 'owner',
                    key: 'owner',
                    width: 160,
                    render: (text: string) => (
                      <Text copyable={{ text }} style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                        {text}
                      </Text>
                    ),
                  },
                  {
                    title: '算法',
                    dataIndex: 'algorithm',
                    key: 'algorithm',
                    width: 120,
                    render: (text: string) => <Text style={{ fontSize: '11px' }}>{text}</Text>,
                  },
                ]}
              />
            ) : (
              <Alert
                message="暂未获取到 KMS 元信息"
                description="请检查 KMS 服务是否可用，或稍后重试。"
                type="warning"
                showIcon
              />
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
              }
            ]}
            pagination={{ pageSize: 5 }}
            size="small"
          />
        </Modal>

        {/* 海光CSV轮换设置模态框 */}
        <Modal
          title="海光CSV轮换设置"
          open={kmsConfigModalVisible}
          onCancel={() => setKmsConfigModalVisible(false)}
          footer={[
            <Button key="kms-cancel" onClick={() => setKmsConfigModalVisible(false)}>
              取消
            </Button>,
            <Button
              key="kms-confirm"
              type="primary"
              onClick={() => {
                kmsForm.validateFields().then(values => {
                  handleSetKmsRotationInterval(values.interval);
                });
              }}
            >
              确认
            </Button>
          ]}
        >
          <Form form={kmsForm} layout="vertical">
            <Form.Item
              name="interval"
              label="轮换间隔（分钟）"
              rules={[
                { required: true, message: '请输入轮换间隔' },
                {
                  validator: (_, value) => {
                    if (value === undefined || value === null || value === '') {
                      return Promise.resolve();
                    }
                    return value >= 60
                      ? Promise.resolve()
                      : Promise.reject(new Error('轮换间隔必须不小于60分钟'));
                  }
                }
              ]}
              initialValue={Math.round(kmsRotationConfig.interval / (60 * 1000))}
            >
              <Input type="number" min={60} max={525600} />
            </Form.Item>
          </Form>
        </Modal>

        {/* 海光CSV轮换历史模态框 */}
        <Modal
          title="海光CSV轮换历史"
          open={kmsHistoryModalVisible}
          onCancel={() => setKmsHistoryModalVisible(false)}
          footer={null}
          width={800}
        >
          <Table
            dataSource={rootKeyHistory}
            rowKey="id"
            pagination={{ pageSize: 5 }}
            size="small"
            columns={[
              {
                title: '类型',
                dataIndex: 'type',
                key: 'type',
                width: 160,
                render: (value: string) => (
                  <Space direction="vertical" size={2}>
                    <Tag color="gold">海光CSV 主密钥</Tag>
                    <Text type="secondary">{value}</Text>
                  </Space>
                )
              },
              {
                title: '旧密钥',
                dataIndex: 'oldKey',
                key: 'oldKey',
                width: 260,
                render: (keyData: RootKeyInfo | null) => renderKeyDetails(keyData)
              },
              {
                title: '新密钥',
                dataIndex: 'newKey',
                key: 'newKey',
                width: 260,
                render: (keyData: RootKeyInfo | null) => renderKeyDetails(keyData)
              },
              {
                title: '开始时间',
                dataIndex: 'startTime',
                key: 'startTime',
                width: 160,
                render: (time: number) => new Date(time).toLocaleString()
              },
              {
                title: '结束时间',
                dataIndex: 'endTime',
                key: 'endTime',
                width: 160,
                render: (time: number) => new Date(time).toLocaleString()
              }
            ]}
          />
        </Modal>


      </MainLayout>
    </AuthGuard>
  );
}