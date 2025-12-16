'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Progress, Alert, Spin, Typography, Space, Divider, Badge, Switch, Button, Modal, Input, Form, TimePicker, Flex, Collapse, Tooltip, message } from 'antd';
import { KeyOutlined, LockOutlined, SecurityScanOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, SettingOutlined, HistoryOutlined, RotateLeftOutlined, DatabaseOutlined, FileTextOutlined, InfoCircleOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
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


interface VMData {
  id: string;
  name: string;
  status: string;
  uptime?: string;
  app_id?: string;
  instance_id?: string;
  configuration?: any;
  appCompose?: any;
  boot_progress?: string;
  shutdown_progress?: boolean;
  image_version?: string;
  app_url?: string;
}

interface VMListResponse {
  vms: VMData[];
  total?: number;
  port_mapping_enabled?: boolean;
}

type VMListItem = VMData & { displayName?: string };

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

  const [kmsRotating, setKmsRotating] = useState(false);
  const [kmsRotationConfig, setKmsRotationConfig] = useState<KmsRotationConfig>(defaultKmsRotationConfig);
  const [rootKeyHistoryRaw, setRootKeyHistoryRaw] = useState<RootKeyHistoryResponse[]>([]);
  const [rootKeyHistory, setRootKeyHistory] = useState<RootKeyHistoryEntry[]>([]);
  const [kmsConfigModalVisible, setKmsConfigModalVisible] = useState(false);
  const [kmsHistoryModalVisible, setKmsHistoryModalVisible] = useState(false);
  const [kmsForm] = Form.useForm();
  const [queryModalVisible, setQueryModalVisible] = useState(false);
  const [queryContractId, setQueryContractId] = useState('');
  const [queryResult, setQueryResult] = useState<{ 
    contractKey?: string | null; 
    hasKey: boolean; 
    error?: string; 
    data?: any; 
    k256Pubkey?: string; 
    caCert?: string;
    current_key?: string | null;
    currentKey?: string | null;
    next_key?: string | null;
    nextKey?: string | null;
    currentVersion?: number;
    nextVersion?: number;
    activeVersion?: number;
  } | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  // 系统密钥查询状态（独立的）
  const [systemKeyModalVisible, setSystemKeyModalVisible] = useState(false);
  const [systemKeyAppId, setSystemKeyAppId] = useState('');
  const [systemKeyResult, setSystemKeyResult] = useState<{ 
    contractKey?: string | null; 
    hasKey: boolean; 
    error?: string; 
    data?: any; 
    k256Pubkey?: string; 
    caCert?: string;
    current_key?: string | null;
    currentKey?: string | null;
    next_key?: string | null;
    nextKey?: string | null;
    currentVersion?: number;
    nextVersion?: number;
    activeVersion?: number;
  } | null>(null);
  const [systemKeyLoading, setSystemKeyLoading] = useState(false);
  const [rotatingContractId, setRotatingContractId] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedContractDetail, setSelectedContractDetail] = useState<{ contractId: string; clusterId: string; clusterKey: string | null } | null>(null);
  const [showWorkerKeys, setShowWorkerKeys] = useState(false);
  // 合约密钥轮换相关状态
  const [contractAutoRotation, setContractAutoRotation] = useState(false);
  const [contractRotationInterval, setContractRotationInterval] = useState(1440); // 默认1440分钟（24小时）
  const [contractRotationIntervalModalVisible, setContractRotationIntervalModalVisible] = useState(false);
  const [contractRotationHistoryModalVisible, setContractRotationHistoryModalVisible] = useState(false);
  const [contractRotationHistory, setContractRotationHistory] = useState<any[]>([]);
  const [contractRotationTimer, setContractRotationTimer] = useState<NodeJS.Timeout | null>(null);
  
  // VM 列表相关状态
  const [vms, setVms] = useState<VMListItem[]>([]);
  const [totalVMs, setTotalVMs] = useState(0);
  const [vmLoading, setVmLoading] = useState(false);
  const [bestHostIp, setBestHostIp] = useState<string>('');
  
  // VM 详情弹窗状态
  const [vmDetailModalVisible, setVmDetailModalVisible] = useState(false);
  const [selectedVM, setSelectedVM] = useState<VMListItem | null>(null);



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

  // 加载合约密钥轮换历史
  const loadContractRotationHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/key-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-contract-rotation-history'
        })
      });
      const data = await response.json();
      if (data.success && Array.isArray(data.history)) {
        setContractRotationHistory(data.history);
      }
    } catch (error) {
      console.error('Failed to load contract rotation history:', error);
    }
  }, []);

  useEffect(() => {
    loadRotationState();
    loadRotationConfig();
    loadClusterKeys();
    loadKmsLocalData();
    loadRootKeyHistory();
    loadContractRotationHistory();

    // 启动定时轮询，检测自动轮换
    const pollInterval = setInterval(() => {
      loadRotationState(false); // 刷新密钥状态，不显示加载状态
      loadRotationConfig(); // 刷新历史记录
      loadClusterKeys(false); // 刷新集群密钥，不显示加载状态
      loadRootKeyHistory(); // 刷新根密钥历史
      loadContractRotationHistory(); // 刷新合约轮换历史
    }, 60000); // 每60秒检查一次

    // 清理定时器
    return () => clearInterval(pollInterval);
  }, [loadRootKeyHistory, loadContractRotationHistory]);

  // 自动轮换逻辑
  useEffect(() => {
    // 清除旧的定时器
    if (contractRotationTimer) {
      clearInterval(contractRotationTimer);
      setContractRotationTimer(null);
    }

    // 如果开启了自动轮换
    if (contractAutoRotation && clusterInfo.length > 0) {
      // 获取所有合约
      const allContracts = clusterInfo.flatMap(cluster => cluster.contracts);
      
      if (allContracts.length > 0) {
        // 创建定时器，按间隔轮换根密钥（所有合约）
        const intervalMs = contractRotationInterval * 60 * 1000; // 转换为毫秒
        const timer = setInterval(async () => {
          // 使用批量轮换函数，自动轮换时不显示提示
          try {
            await handleRotateAllContracts(false); // 自动轮换时不显示提示
          } catch (error) {
            console.error('Failed to auto-rotate all contracts:', error);
          }
        }, intervalMs);
        
        setContractRotationTimer(timer);
      }
    }

    // 清理函数
    return () => {
      if (contractRotationTimer) {
        clearInterval(contractRotationTimer);
      }
    };
    // 使用 clusterInfo.length 而不是 clusterInfo 本身，避免数组引用变化导致的无限循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAutoRotation, contractRotationInterval, clusterInfo.length]);

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

  // 查询合约密钥 - 调用KMS.GetKeyVersion接口
  const handleQueryContractKey = async (contractId: string) => {
    if (!contractId || !contractId.trim()) {
      showCustomNotification('合约地址不能为空', 'warning', 3000);
      return;
    }

    setQueryLoading(true);
    setQueryResult(null);
    try {
      const response = await fetch('/api/key-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'query-contract-key',
          contractId: contractId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // 返回当前密钥和下一次轮换后的密钥
        setQueryResult({
          contractKey: data.current_key || data.currentKey || data.contractKey || data.k256Pubkey || null,
          hasKey: data.hasKey || !!data.current_key,
          k256Pubkey: data.current_key || data.k256Pubkey,
          caCert: data.caCert,
          data: data.data,
          // 当前使用的密钥（基于 active_version - 1）
          current_key: data.current_key || data.currentKey || null,
          currentKey: data.current_key || data.currentKey || null,
          // 下一次轮换后的密钥（基于 active_version）
          next_key: data.next_key || data.nextKey || null,
          nextKey: data.next_key || data.nextKey || null,
          // 版本信息
          currentVersion: data.currentVersion,
          nextVersion: data.nextVersion,
          activeVersion: data.activeVersion
        });
        if (data.hasKey || data.current_key) {
          showCustomNotification('查询成功', 'success', 3000);
        } else {
          showCustomNotification(data.message || '未找到密钥信息', 'warning', 3000);
        }
      } else {
        setQueryResult({
          contractKey: null,
          hasKey: false,
          error: data.error || '查询失败'
        });
        showCustomNotification(`查询失败: ${data.error || '未知错误'}`, 'error', 4000);
      }
    } catch (error: any) {
      setQueryResult({
        contractKey: null,
        hasKey: false,
        error: error.message || '查询请求失败'
      });
      showCustomNotification(`查询异常: ${error.message}`, 'error', 4000);
    } finally {
      setQueryLoading(false);
    }
  };

  // 轮换所有密钥（系统密钥 + 合约密钥）
  const handleRotateAllKeys = async (showNotification: boolean = true) => {
    if (rotatingContractId) {
      return; // 防止重复点击
    }

    setRotatingContractId('all-keys'); // 使用特殊标识
    const operationStartTime = new Date().toISOString();
    
    try {
      if (showNotification) {
        showCustomNotification('正在轮换所有密钥（系统密钥 + 合约密钥）...', 'loading', 3000);
      }

      // 1. 收集所有需要轮换的密钥
      const allContracts = clusterInfo.flatMap(cluster => cluster.contracts);
      const allSystemKeys = vms.filter(vm => vm.app_id).map(vm => vm.app_id!);
      
      // 2. 获取所有旧密钥
      const oldContractKeysMap = new Map<string, string>();
      const oldSystemKeysMap = new Map<string, string>();
      
      // 获取合约旧密钥
      for (const contract of allContracts) {
        if (contract.contractId) {
          try {
            const queryResponse = await fetch('/api/key-rotation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'query-contract-key',
                contractId: contract.contractId
              })
            });
            const queryData = await queryResponse.json();
            if (queryData.success && queryData.k256Pubkey) {
              oldContractKeysMap.set(contract.contractId, queryData.k256Pubkey);
            }
          } catch (e) {
            console.warn(`Failed to get old key for contract ${contract.contractId}:`, e);
          }
        }
      }
      
      // 获取系统密钥旧密钥
      for (const appId of allSystemKeys) {
        try {
          const queryResponse = await fetch('/api/key-rotation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'query-contract-key',
              contractId: appId
            })
          });
          const queryData = await queryResponse.json();
          if (queryData.success && queryData.k256Pubkey) {
            oldSystemKeysMap.set(appId, queryData.k256Pubkey);
          }
        } catch (e) {
          console.warn(`Failed to get old key for system ${appId}:`, e);
        }
      }

      // 3. 轮换根密钥（这会影响所有派生密钥）
      const firstContractId = allContracts[0]?.contractId || allSystemKeys[0];
      if (!firstContractId) {
        throw new Error('No keys found to rotate');
      }

      const response = await fetch('/api/key-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rotate-kms-root-key',
          contractId: firstContractId
        })
      });

      const data = await response.json();
      // 成功时间：轮换成功完成的时间，作为新密钥的开始时间
      const successTime = new Date().toISOString();
      
      if (data.success) {
        const historyRecords: any[] = [];
        
        // 4. 获取所有合约的新密钥并保存历史
        for (const contract of allContracts) {
          if (contract.contractId) {
            try {
              const queryResponse = await fetch('/api/key-rotation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'query-contract-key',
                  contractId: contract.contractId
                })
              });
              const queryData = await queryResponse.json();
              
              if (queryData.success && queryData.k256Pubkey) {
                const oldKey = oldContractKeysMap.get(contract.contractId) || '';
                const newKey = queryData.k256Pubkey;
                
                // 只保存一条历史记录
                historyRecords.push({
                  contractId: contract.contractId,
                  oldKey: oldKey,
                  newKey: newKey,
                  startTime: successTime,
                  endTime: null, // 新密钥的结束时间为 null，显示为 "-"
                  keyType: 'contract'
                });
              }
            } catch (e) {
              console.error(`Failed to get new key for contract ${contract.contractId}:`, e);
            }
          }
        }
        
        // 5. 获取所有系统密钥的新密钥并保存历史
        for (const appId of allSystemKeys) {
          try {
            const queryResponse = await fetch('/api/key-rotation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'query-contract-key',
                contractId: appId
              })
            });
            const queryData = await queryResponse.json();
            
            if (queryData.success && queryData.k256Pubkey) {
              const oldKey = oldSystemKeysMap.get(appId) || '';
              const newKey = queryData.k256Pubkey;
              
              // 只保存一条历史记录
              historyRecords.push({
                contractId: appId,
                oldKey: oldKey,
                newKey: newKey,
                startTime: successTime,
                endTime: null, // 新密钥的结束时间为 null，显示为 "-"
                keyType: 'system'
              });
            }
          } catch (e) {
            console.error(`Failed to get new key for system ${appId}:`, e);
          }
        }

        // 6. 批量保存历史记录
        if (historyRecords.length > 0) {
          try {
            await fetch('/api/key-rotation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'save-batch-contract-rotation-history',
                records: historyRecords
              })
            });
            await loadContractRotationHistory();
          } catch (e) {
            console.error('Failed to save rotation history:', e);
          }
        }

        if (showNotification) {
          const contractCount = allContracts.length;
          const systemCount = allSystemKeys.length;
          showCustomNotification(
            `✅ 密钥轮换成功！\n合约密钥: ${contractCount}个\n系统密钥: ${systemCount}个`, 
            'success', 
            5000
          );
        }
        
        // 刷新数据
        await loadClusterKeys(false);
        await loadVMList();
      } else {
        if (showNotification) {
          showCustomNotification(`❌ 轮换失败: ${data.error || '未知错误'}`, 'error', 5000);
        }
      }
    } catch (error: any) {
      if (showNotification) {
        showCustomNotification(`❌ 轮换异常: ${error.message}`, 'error', 5000);
      }
    } finally {
      setRotatingContractId(null);
    }
  };

  // 轮换所有合约的密钥（轮换根密钥）
  const handleRotateAllContracts = async (showNotification: boolean = true) => {
    if (rotatingContractId) {
      return; // 防止重复点击
    }

    // 获取所有合约
    const allContracts = clusterInfo.flatMap(cluster => cluster.contracts);
    if (allContracts.length === 0) {
      if (showNotification) {
        showCustomNotification('没有可轮换的合约', 'warning', 3000);
      }
      return;
    }

    setRotatingContractId('all'); // 使用特殊标识表示正在轮换所有合约
    const operationStartTime = new Date().toISOString();
    
    try {
      if (showNotification) {
        showCustomNotification('正在轮换根密钥，所有合约密钥将更新...', 'loading', 2000);
      }
      
      // 先获取所有合约的旧密钥
      const oldKeysMap = new Map<string, string>();
      for (const contract of allContracts) {
        if (contract.contractId) {
          try {
            const queryResponse = await fetch('/api/key-rotation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'query-contract-key',
                contractId: contract.contractId
              })
            });
            const queryData = await queryResponse.json();
            if (queryData.success && queryData.k256Pubkey) {
              oldKeysMap.set(contract.contractId, queryData.k256Pubkey);
            }
          } catch (e) {
            console.warn(`Failed to get old key for contract ${contract.contractId}:`, e);
          }
        }
      }

      // 轮换根密钥（使用第一个合约的ID，实际上会轮换根密钥）
      const firstContractId = allContracts[0]?.contractId;
      if (!firstContractId) {
        throw new Error('No contract found');
      }

      const response = await fetch('/api/key-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rotate-kms-root-key',
          contractId: firstContractId
        })
      });

      const data = await response.json();
      const successTime = new Date().toISOString();
      
      if (data.success) {
        // 为每个合约获取新密钥并保存历史
        const historyRecords: any[] = [];
        
        for (const contract of allContracts) {
          if (contract.contractId) {
            try {
              // 获取新密钥
              const queryResponse = await fetch('/api/key-rotation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'query-contract-key',
                  contractId: contract.contractId
                })
              });
              const queryData = await queryResponse.json();
              
              if (queryData.success && queryData.k256Pubkey) {
                const oldKey = oldKeysMap.get(contract.contractId) || '';
                const newKey = queryData.k256Pubkey;
                
                // 只保存一条历史记录
                historyRecords.push({
                  contractId: contract.contractId,
                  oldKey: oldKey,
                  newKey: newKey,
                  startTime: successTime,
                  endTime: null, // 新密钥的结束时间为 null，显示为 "-"
                  keyType: 'contract' // 标记为合约密钥
                });
              }
            } catch (e) {
              console.error(`Failed to get new key for contract ${contract.contractId}:`, e);
            }
          }
        }

        // 批量保存历史记录
        if (historyRecords.length > 0) {
          try {
            await fetch('/api/key-rotation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'save-batch-contract-rotation-history',
                records: historyRecords
              })
            });
            // 刷新历史记录
            await loadContractRotationHistory();
          } catch (e) {
            console.error('Failed to save rotation history:', e);
          }
        }

        if (showNotification) {
          showCustomNotification(`✅ 根密钥轮换成功，${historyRecords.length}个合约密钥已更新`, 'success', 4000);
        }
        
        // 刷新集群密钥信息
        await loadClusterKeys(false);
      } else {
        if (showNotification) {
          showCustomNotification(`❌ 轮换失败: ${data.error || '未知错误'}`, 'error', 5000);
        }
      }
    } catch (error: any) {
      if (showNotification) {
        showCustomNotification(`❌ 轮换异常: ${error.message}`, 'error', 5000);
      }
    } finally {
      setRotatingContractId(null);
    }
  };

  // 轮换合约的密钥（保留用于自动轮换，但不再在UI中显示）
  const handleRotateContractKmsKey = async (contractId: string, showNotification: boolean = true) => {
    if (rotatingContractId) {
      return; // 防止重复点击
    }

    setRotatingContractId(contractId);
    const operationStartTime = new Date().toISOString();
    let oldKey = '';
    
    try {
      // 先查询当前密钥作为旧密钥
      try {
        const queryResponse = await fetch('/api/key-rotation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'query-contract-key',
            contractId: contractId
          })
        });
        const queryData = await queryResponse.json();
        if (queryData.success && queryData.k256Pubkey) {
          oldKey = queryData.k256Pubkey;
        }
      } catch (e) {
        console.warn('Failed to get old key before rotation:', e);
      }

      if (showNotification) {
        showCustomNotification('正在轮换密钥...', 'loading', 2000);
      }
      
      const response = await fetch('/api/key-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rotate-kms-root-key',
          contractId: contractId
        })
      });

      const data = await response.json();
      const successTime = new Date().toISOString();
      
      if (data.success) {
        const newKey = data.k256Pubkey || '';
        
        // 保存轮换历史
        try {
          // 只保存一条历史记录
          await fetch('/api/key-rotation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save-contract-rotation-history',
              record: {
                contractId: contractId,
                oldKey: oldKey,
                newKey: newKey,
                startTime: successTime,
                endTime: null, // 新密钥的结束时间为 null，显示为 "-"
                keyType: 'contract' // 标记为合约密钥
              }
            })
          });
          // 刷新历史记录
          await loadContractRotationHistory();
        } catch (e) {
          console.error('Failed to save rotation history:', e);
        }

        if (showNotification) {
          showCustomNotification('✅ 密钥轮换成功', 'success', 4000);
        }
        // 轮换成功后，自动刷新查询结果（如果查询窗口已打开）
        if (queryModalVisible && queryContractId === contractId) {
          await handleQueryContractKey(contractId);
        }
      } else {
        if (showNotification) {
          showCustomNotification(`❌ 轮换失败: ${data.error || '未知错误'}`, 'error', 5000);
        }
      }
    } catch (error: any) {
      if (showNotification) {
        showCustomNotification(`❌ 轮换异常: ${error.message}`, 'error', 5000);
      }
    } finally {
      setRotatingContractId(null);
    }
  };

  // 打开查询Modal并自动查询（合约密钥）
  const openQueryModal = (contractId: string) => {
    setQueryContractId(contractId);
    setQueryResult(null);
    setQueryModalVisible(true);
    // 自动执行查询
    handleQueryContractKey(contractId);
  };

  // 为应用ID打开查询Modal并自动查询（系统密钥）
  const openQueryModalForApp = async (appId: string) => {
    setSystemKeyAppId(appId);
    setSystemKeyResult(null);
    setSystemKeyModalVisible(true);
    // 自动执行查询
    setSystemKeyLoading(true);
    try {
      const response = await fetch('/api/key-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'query-contract-key',
          contractId: appId
        })
      });
      const data = await response.json();
      
      if (data.success) {
        setSystemKeyResult({
          contractKey: data.current_key || data.currentKey || data.contractKey || data.k256Pubkey || null,
          hasKey: data.hasKey || !!data.current_key,
          k256Pubkey: data.current_key || data.k256Pubkey,
          caCert: data.caCert,
          data: data.data,
          current_key: data.current_key || data.currentKey || null,
          currentKey: data.current_key || data.currentKey || null,
          next_key: data.next_key || data.nextKey || null,
          nextKey: data.next_key || data.nextKey || null,
          currentVersion: data.currentVersion,
          nextVersion: data.nextVersion,
          activeVersion: data.activeVersion
        });
        if (data.hasKey || data.current_key) {
          showCustomNotification('查询成功', 'success', 3000);
        } else {
          showCustomNotification(data.message || '未找到密钥信息', 'warning', 3000);
        }
      } else {
        setSystemKeyResult({
          contractKey: null,
          hasKey: false,
          error: data.error || '查询失败'
        });
        showCustomNotification(`查询失败: ${data.error || '未知错误'}`, 'error', 4000);
      }
    } catch (error: any) {
      setSystemKeyResult({
        contractKey: null,
        hasKey: false,
        error: error.message || '查询异常'
      });
      showCustomNotification(`查询异常: ${error.message}`, 'error', 4000);
    } finally {
      setSystemKeyLoading(false);
    }
  };

  // 轮换系统密钥（应用密钥）
  const handleRotateSystemKey = async (appId: string, showNotification: boolean = true) => {
    if (rotatingContractId) {
      return; // 防止重复点击
    }

    setRotatingContractId(appId);
    const operationStartTime = new Date().toISOString();
    
    try {
      // 先获取旧密钥
      let oldKey = '';
      try {
        const queryResponse = await fetch('/api/key-rotation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'query-contract-key',
            contractId: appId
          })
        });
        const queryData = await queryResponse.json();
        if (queryData.success && queryData.k256Pubkey) {
          oldKey = queryData.k256Pubkey;
        }
      } catch (e) {
        console.warn('Failed to get old key before rotation:', e);
      }

      if (showNotification) {
        showCustomNotification('正在轮换系统密钥...', 'loading', 2000);
      }
      
      const response = await fetch('/api/key-rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rotate-kms-root-key',
          contractId: appId
        })
      });

      const data = await response.json();
      const successTime = new Date().toISOString();
      
      if (data.success) {
        const newKey = data.k256Pubkey || '';
        
        // 保存系统密钥轮换历史
        try {
          // 只保存一条历史记录
          await fetch('/api/key-rotation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save-contract-rotation-history',
              record: {
                contractId: appId,
                oldKey: oldKey,
                newKey: newKey,
                startTime: successTime,
                endTime: null, // 新密钥的结束时间为 null，显示为 "-"
                keyType: 'system' // 标记为系统密钥
              }
            })
          });
          // 刷新历史记录
          await loadContractRotationHistory();
        } catch (e) {
          console.error('Failed to save system key rotation history:', e);
        }

        if (showNotification) {
          showCustomNotification('✅ 系统密钥轮换成功', 'success', 4000);
        }
        // 轮换成功后，自动刷新查询结果
        if (systemKeyModalVisible && systemKeyAppId === appId) {
          await openQueryModalForApp(appId);
        }
      } else {
        if (showNotification) {
          showCustomNotification(`❌ 轮换失败: ${data.error || '未知错误'}`, 'error', 5000);
        }
      }
    } catch (error: any) {
      if (showNotification) {
        showCustomNotification(`❌ 轮换异常: ${error.message}`, 'error', 5000);
      }
    } finally {
      setRotatingContractId(null);
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


  const formatKeyPreview = (key: string | undefined) => {
    if (!key) return '-';
    if (key.length <= 32) return key;
    return `${key.slice(0, 16)}...${key.slice(-8)}`;
  };

  // 加载 VM 列表
  const loadVMList = useCallback(async () => {
    if (!bestHostIp) {
      console.log('没有 bestHostIp，跳过加载 VM 列表');
      return;
    }
    
    console.log('开始加载 VM 列表，bestHostIp:', bestHostIp);
    setVmLoading(true);
    try {
      const port = "9210";
      const proxyUrl = `/api/vm-rpc?host=${encodeURIComponent(
        bestHostIp
      )}&method=${encodeURIComponent('Status')}&port=${encodeURIComponent(port)}`;

      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brief: false,
          keyword: "",
          page: 1,
          page_size: 50,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const data: VMListResponse = await response.json();
      console.log('获取到 VM 数据:', data);
      
      const enrichedVms =
        data.vms?.map((vm) => {
          // 获取 Compose 显示名称
          let displayName = vm.name;
          const composeSource = vm.configuration?.compose_file;
          if (composeSource) {
            try {
              if (typeof composeSource === "string") {
                const parsed = JSON.parse(composeSource);
                displayName = parsed?.name || vm.name;
              } else if (typeof composeSource === "object") {
                displayName = (composeSource as any)?.name || vm.name;
              }
            } catch (error) {
              console.error("Failed to parse compose_file for VM:", vm.id, error);
            }
          }
          
          return {
            ...vm,
            displayName,
          };
        }) || [];
      
      setVms(enrichedVms);
      setTotalVMs(data.total || data.vms?.length || 0);
      console.log('设置 VM 数据成功，总数:', data.total || data.vms?.length || 0);
    } catch (error) {
      console.error("Error loading VM list:", error);
    } finally {
      setVmLoading(false);
    }
  }, [bestHostIp]);



  // 从 localStorage 读取 bestHostIp
  useEffect(() => {
    const storedBestHostIp = localStorage.getItem("bestHostIp");
    if (storedBestHostIp) {
      setBestHostIp(storedBestHostIp);
    }
  }, []);

  // 当 bestHostIp 变化时，加载 VM 列表
  useEffect(() => {
    if (bestHostIp) {
      loadVMList(); // 只要有 bestHostIp 就自动加载
    }
  }, [bestHostIp, loadVMList]);

  // 获取 VM 状态
  const getVMStatus = (vm: VMData): string => {
    const status = vm.status?.toLowerCase() || "";
    if (status !== "running") {
      return status;
    }
    if (vm.shutdown_progress) {
      return "shutting down";
    }
    if (vm.boot_progress === "running") {
      return "running";
    }
    if (vm.boot_progress && vm.boot_progress !== "done") {
      return "booting";
    }
    return "running";
  };

  // 获取状态标签颜色
  const getStatusTagColor = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case "running":
        return "success";
      case "booting":
        return "processing";
      case "shutting down":
        return "warning";
      case "stopped":
      case "exited":
        return "default";
      default:
        return "default";
    }
  };

  // 打开 VM 详情弹窗
  const showVMDetail = (vm: VMListItem) => {
    setSelectedVM(vm);
    setVmDetailModalVisible(true);
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
                  <Text strong>身份密钥</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    pruntime启动时生成，用于系统核心加密操作
                  </Text>
                  <br />
                  <Tag color="blue">算法: Sr25519</Tag>
                  <Tag color="purple">长度: 256位</Tag>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div>
                  <Text strong>ECDH交换密钥</Text>
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
                  <Text strong>Gatekeeper密钥</Text>
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
                  <Text strong>合约密钥</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    由根密钥派生，为隐私合约生成对称密钥、加密状态或证书
                  </Text>
                  <br />
                  <Tag color="blue">算法: secp256k1</Tag>
                  <Tag color="purple">长度: 256位</Tag>
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
                  当达到配置的时间间隔或手动触发时，会轮换根密钥，然后为每个合约或系统重新派生密钥
                </Text>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ textAlign: 'center' }}>
                <SecurityScanOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                <Title level={5} style={{ marginTop: '8px' }}>迁移保护</Title>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  新的派生密钥激活后，旧密钥有30天的宽限期，使用户有充足的时间完成数据迁移
                </Text>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ textAlign: 'center' }}>
                <LockOutlined style={{ fontSize: '24px', color: '#faad14' }} />
                <Title level={5} style={{ marginTop: '8px' }}>安全备份</Title>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  保留密钥轮换历史，可查看曾使用的公钥，避免密钥丢失导致的状态无法恢复
                </Text>
              </div>
            </Col>
          </Row>
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
            <Text style={{ color: 'white', fontSize: '16px' }}>密钥轮换</Text>
            <Divider type="vertical" style={{ borderColor: '#666' }} />
            {/* <Text type="secondary" style={{ color: '#ccc' }}>
              轮换间隔:
              <Text style={{ color: '#1890ff', fontWeight: 'bold' }}>
                {Math.round(kmsRotationConfig.interval / (60 * 1000))}分钟
              </Text>
            </Text> */}
            <Text type="secondary" style={{ fontSize: '14px' }}>
              轮换间隔: <Text strong style={{ color: '#1890ff' }}>{contractRotationInterval}分钟</Text>
            </Text>
          </Space>
          <Space>
            <Switch
              checked={contractAutoRotation}
              onChange={(checked) => setContractAutoRotation(checked)}
              checkedChildren="自动"
              unCheckedChildren="手动"
            />
            <Button
              type="default"
              icon={<SettingOutlined />}
              onClick={() => setContractRotationIntervalModalVisible(true)}
            >
              设置
            </Button>
            <Button
              type="default"
              icon={<HistoryOutlined />}
              onClick={async () => {
                await loadContractRotationHistory();
                setContractRotationHistoryModalVisible(true);
              }}
            >
              历史
            </Button>
            <Button
              type="primary"
              icon={<RotateLeftOutlined />}
              onClick={() => handleRotateAllKeys(true)}
              loading={rotatingContractId !== null}
              disabled={rotatingContractId !== null || contractAutoRotation}
            >
              立即轮换
            </Button>
            {/* <Switch
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
            </Button> */}
          </Space>
        </Flex>

        {/* 海光CSV密钥展示 */}
        <Card
          style={{ marginTop: '24px', marginBottom: '24px' }}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>国产海光 CSV-密钥管理列表</span>
            </div>
          }
          extra={
            <Space size="middle">
              <Button 
                type="link" 
                icon={<SyncOutlined />}
                onClick={loadVMList}
                loading={vmLoading}
                style={{ padding: 0 }}
              >
                刷新
              </Button>
            </Space>
          }
        >
          <Spin spinning={vmLoading}>
            {
              // VM 列表
              vms.length > 0 ? (
                <>
                  <Table
                    dataSource={vms}
                    rowKey="id"
                    pagination={{ 
                      pageSize: 10, 
                      showSizeChanger: true,
                      showTotal: (total) => `总计 ${total} 条`,
                    }}
                    size="small"
                    columns={[
                      {
                        title: '序号',
                        key: 'index',
                        width: 60,
                        // align: 'center',
                        render: (text: string, record: VMListItem, index: number) => (
                          <Text strong style={{ fontSize: '12px', color: '#dadbdd' }}>
                            #{index + 1}
                          </Text>
                        ),
                      },
                      {
                        title: '应用名称',
                        dataIndex: 'displayName',
                        key: 'displayName',
                        width: 180,
                        render: (text: string, record: VMListItem) => (
                          <Text strong style={{ fontSize: '12px' }}>
                            {text || record.name || '虚拟机'}
                          </Text>
                        ),
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        key: 'status',
                        width: 120,
                        render: (text: string, record: VMListItem) => {
                          const status = getVMStatus(record);
                          return (
                            <Tag color={getStatusTagColor(status)} style={{ fontSize: '11px' }}>
                              {status.toUpperCase()}
                            </Tag>
                          );
                        },
                      },
                      {
                        title: '虚拟机 ID',
                        dataIndex: 'id',
                        key: 'id',
                        width: 200,
                        render: (text: string) => (
                          <Text 
                            copyable={{ text }}
                            ellipsis={{ tooltip: text }}
                            style={{ fontSize: '11px', fontFamily: 'monospace' }}
                          >
                            {text}
                          </Text>
                        ),
                      },
                      {
                        title: '应用 ID',
                        dataIndex: 'app_id',
                        key: 'app_id',
                        width: 180,
                        render: (text: string) => (
                          text ? (
                            <Text 
                              copyable={{ text }}
                              ellipsis={{ tooltip: text }}
                              style={{ fontSize: '11px', fontFamily: 'monospace' }}
                            >
                              {text}
                            </Text>
                          ) : (
                            <Text type="secondary" style={{ fontSize: '11px' }}>-</Text>
                          )
                        ),
                      },
                      {
                        title: '系统密钥',
                        key: 'system_key',
                        width: 200,
                        align: 'center',
                        render: (text: string, record: VMListItem) => (
                          <Space size="small">
                            {record.app_id ? (
                              <Button 
                                type="link" 
                                size="small"
                                icon={<EyeOutlined />}
                                onClick={() => openQueryModalForApp(record.app_id!)}
                                style={{ fontSize: '13px' }}
                              >
                                查看密钥
                              </Button>
                            ) : (
                              <Text type="secondary" style={{ fontSize: '11px' }}>无应用ID</Text>
                            )}
                          </Space>
                        ),
                      },
                      {
                        title: '更多信息',
                        key: 'more_info',
                        width: 100,
                        align: 'center',
                        render: (text: string, record: VMListItem) => (
                          <Button 
                            type="link" 
                            size="small"
                            icon={<InfoCircleOutlined />}
                            onClick={() => showVMDetail(record)}
                            style={{ fontSize: '13px' }}
                          >
                            详情
                          </Button>
                        ),
                      },
                    ]}
                  />
                </>
              ) : (
                <Alert
                  message="暂无可信应用数据"
                  description={bestHostIp ? '当前没有找到可信应用实例。' : '请先设置最佳主机 IP（从 localStorage 读取 bestHostIp）。'}
                  type="info"
                  showIcon
                />
              )
            }
          </Spin>
        </Card>

        {/* VM 详情弹窗 */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '20px' }} />
              <span style={{ fontSize: '16px', fontWeight: 600 }}>详细信息</span>
            </div>
          }
          open={vmDetailModalVisible}
          onCancel={() => setVmDetailModalVisible(false)}
          footer={[
            <Button 
              key="close" 
              type="primary" 
              onClick={() => setVmDetailModalVisible(false)}
              style={{ borderRadius: '6px' }}
            >
              关闭
            </Button>,
          ]}
          width={800}
          style={{ top: 40 }}
          bodyStyle={{ padding: '24px' }}
        >
          {selectedVM && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 基本信息卡片 */}
              <div style={{ 
                background: '#1d3557', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 4px 12px rgba(29, 53, 87, 0.3)'
              }}>
                <div style={{ 
                  fontSize: '13px', 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  marginBottom: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.5px'
                }}>
                  基本信息
                </div>
                <Row gutter={[24, 16]}>
                  <Col span={12}>
                    <div style={{ 
                      background: 'rgba(255, 255, 255, 0.15)', 
                      backdropFilter: 'blur(10px)',
                      padding: '12px 16px', 
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', marginBottom: '6px' }}>
                        应用名称
                      </div>
                      <div style={{ fontSize: '15px', color: '#fff', fontWeight: 600 }}>
                        {selectedVM.displayName || selectedVM.name || '虚拟机'}
                      </div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ 
                      background: 'rgba(255, 255, 255, 0.15)', 
                      backdropFilter: 'blur(10px)',
                      padding: '12px 16px', 
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', marginBottom: '6px' }}>
                        状态
                      </div>
                      <Tag 
                        color={getStatusTagColor(getVMStatus(selectedVM))} 
                        style={{ 
                          fontSize: '12px',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          fontWeight: 600
                        }}
                      >
                        {getVMStatus(selectedVM).toUpperCase()}
                      </Tag>
                    </div>
                  </Col>
                </Row>
              </div>
              
              {/* 识别信息卡片 */}
              <div style={{ 
                background: '#1a1f2e', 
                borderRadius: '12px', 
                padding: '20px',
                border: '1px solid #2d3748'
              }}>
                <div style={{ 
                  fontSize: '13px', 
                  color: '#e0e7ff', 
                  marginBottom: '16px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ 
                    width: '4px', 
                    height: '14px', 
                    background: '#457b9d',
                    borderRadius: '2px'
                  }} />
                  识别信息
                </div>
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <div style={{ 
                    background: '#2d3748',
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: '1px solid #4a5568',
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '8px', fontWeight: 500 }}>
                      VM ID
                    </div>
                    <Text 
                      copyable={{ 
                        text: selectedVM.id,
                        tooltips: ['复制', '已复制!'],
                      }}
                      style={{ 
                        fontSize: '13px', 
                        fontFamily: 'Monaco, Consolas, monospace', 
                        color: '#e2e8f0',
                        wordBreak: 'break-all',
                        lineHeight: '1.6'
                      }}
                    >
                      {selectedVM.id}
                    </Text>
                  </div>
                  
                  {selectedVM.app_id && (
                    <div style={{ 
                      background: '#2d3748',
                      padding: '14px 16px',
                      borderRadius: '8px',
                      border: '1px solid #4a5568',
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '8px', fontWeight: 500 }}>
                        App ID
                      </div>
                      <Text 
                        copyable={{ 
                          text: selectedVM.app_id,
                          tooltips: ['复制', '已复制!'],
                        }}
                        style={{ 
                          fontSize: '13px', 
                          fontFamily: 'Monaco, Consolas, monospace', 
                          color: '#e2e8f0',
                          wordBreak: 'break-all',
                          lineHeight: '1.6'
                        }}
                      >
                        {selectedVM.app_id}
                      </Text>
                    </div>
                  )}
                  
                  {selectedVM.instance_id && (
                    <div style={{ 
                      background: '#2d3748',
                      padding: '14px 16px',
                      borderRadius: '8px',
                      border: '1px solid #4a5568',
                      transition: 'all 0.3s ease'
                    }}>
                      <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '8px', fontWeight: 500 }}>
                        Instance ID
                      </div>
                      <Text 
                        copyable={{ 
                          text: selectedVM.instance_id,
                          tooltips: ['复制', '已复制!'],
                        }}
                        style={{ 
                          fontSize: '13px', 
                          fontFamily: 'Monaco, Consolas, monospace', 
                          color: '#e2e8f0',
                          wordBreak: 'break-all',
                          lineHeight: '1.6'
                        }}
                      >
                        {selectedVM.instance_id}
                      </Text>
                    </div>
                  )}
                </Space>
              </div>
              
              {/* 运行信息卡片 */}
              <div style={{ 
                background: '#2f4f4f', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 4px 12px rgba(47, 79, 79, 0.3)'
              }}>
                <div style={{ 
                  fontSize: '13px', 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  marginBottom: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.5px'
                }}>
                  运行信息
                </div>
                <Row gutter={[24, 16]}>
                  <Col span={12}>
                    <div style={{ 
                      background: 'rgba(255, 255, 255, 0.15)', 
                      backdropFilter: 'blur(10px)',
                      padding: '12px 16px', 
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', marginBottom: '6px' }}>
                        运行时长
                      </div>
                      <div style={{ fontSize: '15px', color: '#fff', fontWeight: 600 }}>
                        {selectedVM.uptime || '-'}
                      </div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ 
                      background: 'rgba(255, 255, 255, 0.15)', 
                      backdropFilter: 'blur(10px)',
                      padding: '12px 16px', 
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', marginBottom: '6px' }}>
                        镜像版本
                      </div>
                      <div style={{ fontSize: '15px', color: '#fff', fontWeight: 600 }}>
                        {selectedVM.image_version || '-'}
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>
              
              {/* 访问地址卡片 */}
              {selectedVM.app_url && (
                <div style={{ 
                  background: '#1a1f2e', 
                  borderRadius: '12px', 
                  padding: '20px',
                  border: '1px solid #2d3748'
                }}>
                  <div style={{ 
                    fontSize: '13px', 
                    color: '#e0e7ff', 
                    marginBottom: '12px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ 
                      width: '4px', 
                      height: '14px', 
                      background: '#457b9d',
                      borderRadius: '2px'
                    }} />
                    访问地址
                  </div>
                  <div style={{ 
                    background: '#2d3748',
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: '1px solid #4a5568'
                  }}>
                    <div style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '8px', fontWeight: 500 }}>
                      Dashboard URL
                    </div>
                    <a 
                      href={selectedVM.app_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#60a5fa', 
                        fontSize: '13px',
                        textDecoration: 'none',
                        wordBreak: 'break-all',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#93c5fd';
                        e.currentTarget.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#60a5fa';
                        e.currentTarget.style.textDecoration = 'none';
                      }}
                    >
                      {selectedVM.app_url}
                      <span style={{ fontSize: '12px' }}>↗</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* 密钥列表 - Worker密钥（可隐藏） */}
        {showWorkerKeys && (
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>国际 Intel SGX-密钥管理列表</span>
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
                pagination={{ pageSize: 10, showSizeChanger: true }}
                scroll={{ x: 1400 }}
                size="small"
              />
            </Spin>
          </Card>
        )}

        {/* 密钥管理列表 */}
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>国际 Intel SGX-密钥管理列表</span>
              <Space size="middle">
                {/* <Text type="secondary" style={{ fontSize: '14px' }}>
                  轮换间隔: <Text strong style={{ color: '#1890ff' }}>{contractRotationInterval}分钟</Text>
                </Text>
                <Switch
                  checked={contractAutoRotation}
                  onChange={(checked) => setContractAutoRotation(checked)}
                  checkedChildren="自动"
                  unCheckedChildren="手动"
                />
                <Button
                  type="default"
                  icon={<SettingOutlined />}
                  onClick={() => setContractRotationIntervalModalVisible(true)}
                  size="small"
                >
                  设置
                </Button>
                <Button
                  type="default"
                  icon={<HistoryOutlined />}
                  onClick={async () => {
                    await loadContractRotationHistory();
                    setContractRotationHistoryModalVisible(true);
                  }}
                  size="small"
                >
                  历史
                </Button>
                <Button
                  type="primary"
                  icon={<RotateLeftOutlined />}
                  onClick={() => handleRotateAllContracts(true)}
                  loading={rotatingContractId !== null}
                  disabled={rotatingContractId !== null || contractAutoRotation}
                  size="small"
                >
                  立即轮换
                </Button> */}
                <Tooltip title={showWorkerKeys ? '隐藏Worker密钥' : '显示Worker密钥'}>
                  <Button
                    type="text"
                    icon={showWorkerKeys ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowWorkerKeys(!showWorkerKeys)}
                    style={{ 
                      color: 'rgba(255, 255, 255, 0.65)',
                      fontSize: '14px'
                    }}
                  >
                    {showWorkerKeys ? '隐藏Worker密钥' : '显示Worker密钥'}
                  </Button>
                </Tooltip>
              </Space>
            </div>
          }
        >
          <Spin spinning={clusterLoading}>
            {(() => {
              // 合并所有集群的合约到一个数组中，并添加集群信息
              const allContracts = clusterInfo.flatMap((cluster, clusterIndex) => 
                cluster.contracts.map((contract, contractIndex) => ({
                  ...contract,
                  clusterId: cluster.clusterId,
                  clusterKey: cluster.clusterKey,
                  hasClusterKey: cluster.hasClusterKey,
                  globalIndex: clusterInfo.slice(0, clusterIndex).reduce((sum, c) => sum + c.contracts.length, 0) + contractIndex + 1
                }))
              );

              if (allContracts.length === 0) {
                return (
                  <Alert
                    message="暂无合约信息"
                    description="当前没有找到任何合约，请确保合约已部署。"
                    type="info"
                    showIcon
                  />
                );
              }

              return (
                <Table
                  dataSource={allContracts}
                  rowKey={(record, idx) => `contract-${record.clusterId}-${record.contractId}-${idx}`}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  size="small"
                  columns={[
                    {
                      title: '序号',
                      key: 'index',
                      width: 80,
                      render: (_: any, record: any) => (
                        <Text style={{ fontSize: '11px' }}>#{record.globalIndex}</Text>
                      ),
                    },
                    {
                      title: '状态',
                      key: 'status',
                      width: 120,
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
                      width: 200,
                      render: (text: string) => (
                        <Text copyable={{ text }} style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                          {text.substring(0, 12)}...
                        </Text>
                      ),
                    },
                    {
                      title: '合约密钥',
                      key: 'contractKey',
                      width: 150,
                      render: (_: any, record: any) => {
                        return (
                          <Button
                            type="link"
                            size="small"
                            icon={<KeyOutlined />}
                            onClick={() => openQueryModal(record.contractId)}
                            style={{ padding: 0, fontSize: '13px' }}
                          >
                            查询密钥
                          </Button>
                        );
                      },
                    },
                    {
                      title: '更多信息',
                      key: 'moreInfo',
                      width: 120,
                      render: (_: any, record: any) => {
                        return (
                          <Button
                            type="link"
                            size="small"
                            icon={<InfoCircleOutlined />}
                            onClick={() => {
                              setSelectedContractDetail({
                                contractId: record.contractId,
                                clusterId: record.clusterId,
                                clusterKey: record.clusterKey
                              });
                              setDetailModalVisible(true);
                            }}
                            style={{ padding: 0, fontSize: '13px' }}
                          >
                            更多信息
                          </Button>
                        );
                      },
                    },
                  ]}
                />
              );
            })()}
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
                  return (
                    <Tooltip title={key} placement="top">
                      <Text style={{ fontSize: '11px', cursor: 'pointer' }}>{key.substring(0, 12)}...</Text>
                    </Tooltip>
                  );
                }
              },
              {
                title: '新密钥',
                dataIndex: 'newKey',
                key: 'newKey',
                width: 150,
                render: (key: string | null) => {
                  if (!key || key === 'unknown') return '-';
                  return (
                    <Tooltip title={key} placement="top">
                      <Text style={{ fontSize: '11px', cursor: 'pointer' }}>{key.substring(0, 12)}...</Text>
                    </Tooltip>
                  );
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

        {/* 查询合约密钥模态框 */}
        <Modal
          title="查询结果 - 合约密钥"
          open={queryModalVisible}
          onCancel={() => {
            setQueryModalVisible(false);
            setQueryContractId('');
            setQueryResult(null);
          }}
          footer={null}
          width={600}
        >
          {queryLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px', color: 'rgba(255, 255, 255, 0.65)' }}>正在查询...</div>
            </div>
          ) : queryResult ? (
            <div style={{ 
              padding: '16px', 
              background: '#0a1929',
              borderRadius: '6px',
              border: '1px solid #1e3a5f'
            }}>
              {queryResult.error ? (
                <Alert
                  message="查询失败"
                  description={queryResult.error}
                  type="error"
                  showIcon
                />
              ) : queryResult.hasKey && (queryResult.current_key || queryResult.contractKey) ? (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div>
                    <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
                      合约地址
                    </Text>
                    <Text 
                      copyable={{ text: queryContractId }} 
                      style={{ 
                        fontSize: '13px', 
                        fontFamily: 'monospace', 
                        color: 'rgba(255, 255, 255, 0.9)',
                        wordBreak: 'break-all'
                      }}
                    >
                      {queryContractId}
                    </Text>
                  </div>

                  {/* 当前合约公钥 */}
                  <div>
                    <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
                      当前合约公钥
                    </Text>
                    <Text 
                      copyable={{ text: queryResult.current_key || queryResult.currentKey || queryResult.contractKey || queryResult.k256Pubkey || '' }} 
                      style={{ 
                        fontSize: '13px', 
                        fontFamily: 'monospace', 
                        color: '#52c41a',
                        wordBreak: 'break-all',
                        display: 'block',
                        padding: '10px 14px',
                        background: 'rgba(82, 196, 26, 0.08)',
                        borderRadius: '6px',
                        border: '1px solid rgba(82, 196, 26, 0.25)',
                        lineHeight: '1.6'
                      }}
                    >
                      {queryResult.current_key || queryResult.currentKey || queryResult.contractKey || queryResult.k256Pubkey || '未找到'}
                    </Text>
                  </div>

                  {/* 下一次轮换的合约公钥 */}
                  <div>
                    <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
                      下一次轮换的合约公钥
                    </Text>
                    {queryResult.next_key || queryResult.nextKey ? (
                      <Text 
                        copyable={{ text: queryResult.next_key || queryResult.nextKey || '' }} 
                        style={{ 
                          fontSize: '13px', 
                          fontFamily: 'monospace', 
                          color: '#1890ff',
                          wordBreak: 'break-all',
                          display: 'block',
                          padding: '10px 14px',
                          background: 'rgba(24, 144, 255, 0.08)',
                          borderRadius: '6px',
                          border: '1px solid rgba(24, 144, 255, 0.25)',
                          lineHeight: '1.6'
                        }}
                      >
                        {queryResult.next_key || queryResult.nextKey || ''}
                      </Text>
                    ) : (
                      <Alert
                        message="未生成"
                        description="下一次轮换后的密钥尚未生成"
                        type="info"
                        showIcon
                        style={{ fontSize: '12px' }}
                      />
                    )}
                  </div>
                </Space>
              ) : (
                <Alert
                  message="未找到密钥"
                  description="该合约地址对应的密钥尚未生成或不存在"
                  type="warning"
                  showIcon
                />
              )}
            </div>
          ) : null}
        </Modal>

        {/* 查询系统密钥模态框 */}
        <Modal
          title="查询结果 - 系统密钥"
          open={systemKeyModalVisible}
          onCancel={() => {
            setSystemKeyModalVisible(false);
            setSystemKeyAppId('');
            setSystemKeyResult(null);
          }}
          footer={[
            <Button
              key="close"
              onClick={() => {
                setSystemKeyModalVisible(false);
                setSystemKeyAppId('');
                setSystemKeyResult(null);
              }}
            >
              关闭
            </Button>
          ]}
          width={600}
        >
          {systemKeyLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px', color: 'rgba(255, 255, 255, 0.65)' }}>正在查询...</div>
            </div>
          ) : systemKeyResult ? (
            <div style={{ 
              padding: '16px', 
              background: '#0a1929',
              borderRadius: '6px',
              border: '1px solid #1e3a5f'
            }}>
              {systemKeyResult.error ? (
                <Alert
                  message="查询失败"
                  description={systemKeyResult.error}
                  type="error"
                  showIcon
                />
              ) : systemKeyResult.hasKey && (systemKeyResult.current_key || systemKeyResult.contractKey) ? (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div>
                    <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
                      应用ID
                    </Text>
                    <Text 
                      copyable={{ text: systemKeyAppId }} 
                      style={{ 
                        fontSize: '13px', 
                        fontFamily: 'monospace', 
                        color: 'rgba(255, 255, 255, 0.9)',
                        wordBreak: 'break-all'
                      }}
                    >
                      {systemKeyAppId}
                    </Text>
                  </div>

                  {/* 当前系统公钥 */}
                  <div>
                    <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
                      当前系统公钥
                    </Text>
                    <Text 
                      copyable={{ text: systemKeyResult.current_key || systemKeyResult.currentKey || systemKeyResult.contractKey || systemKeyResult.k256Pubkey || '' }} 
                      style={{ 
                        fontSize: '13px', 
                        fontFamily: 'monospace', 
                        color: '#52c41a',
                        wordBreak: 'break-all',
                        display: 'block',
                        padding: '10px 14px',
                        background: 'rgba(82, 196, 26, 0.08)',
                        borderRadius: '6px',
                        border: '1px solid rgba(82, 196, 26, 0.25)',
                        lineHeight: '1.6'
                      }}
                    >
                      {systemKeyResult.current_key || systemKeyResult.currentKey || systemKeyResult.contractKey || systemKeyResult.k256Pubkey || '未找到'}
                    </Text>
                  </div>

                  {/* 下一次轮换的系统公钥 */}
                  <div>
                    <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '8px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
                      下一次轮换的系统公钥
                    </Text>
                    {systemKeyResult.next_key || systemKeyResult.nextKey ? (
                      <Text 
                        copyable={{ text: systemKeyResult.next_key || systemKeyResult.nextKey || '' }} 
                        style={{ 
                          fontSize: '13px', 
                          fontFamily: 'monospace', 
                          color: '#1890ff',
                          wordBreak: 'break-all',
                          display: 'block',
                          padding: '10px 14px',
                          background: 'rgba(24, 144, 255, 0.08)',
                          borderRadius: '6px',
                          border: '1px solid rgba(24, 144, 255, 0.25)',
                          lineHeight: '1.6'
                        }}
                      >
                        {systemKeyResult.next_key || systemKeyResult.nextKey || ''}
                      </Text>
                    ) : (
                      <Alert
                        message="未生成"
                        description="下一次轮换后的密钥尚未生成"
                        type="info"
                        showIcon
                        style={{ fontSize: '12px' }}
                      />
                    )}
                  </div>
                </Space>
              ) : (
                <Alert
                  message="未找到密钥"
                  description="该应用ID对应的密钥尚未生成或不存在"
                  type="warning"
                  showIcon
                />
              )}
            </div>
          ) : null}
        </Modal>

        {/* 轮换间隔设置Modal */}
        <Modal
          title="设置轮换间隔"
          open={contractRotationIntervalModalVisible}
          onCancel={() => setContractRotationIntervalModalVisible(false)}
          footer={null}
          width={500}
        >
          <Form
            layout="vertical"
            initialValues={{ interval: contractRotationInterval }}
            onFinish={(values) => {
              const interval = Number(values.interval);
              if (interval > 0) {
                setContractRotationInterval(interval);
                setContractRotationIntervalModalVisible(false);
                showCustomNotification('✅ 轮换间隔设置成功', 'success', 3000);
              }
            }}
          >
            <Form.Item
              label="轮换间隔（分钟）"
              name="interval"
              rules={[
                { required: true, message: '请输入轮换间隔' },
                { 
                  validator: (_, value) => {
                    const num = Number(value);
                    if (!value || isNaN(num) || num <= 0) {
                      return Promise.reject(new Error('间隔必须大于0'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input
                type="number"
                placeholder="请输入轮换间隔（分钟）"
                min={1}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  保存
                </Button>
                <Button onClick={() => setContractRotationIntervalModalVisible(false)}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* 合约轮换历史Modal */}
        <Modal
          title="密钥轮换历史"
          open={contractRotationHistoryModalVisible}
          onCancel={() => setContractRotationHistoryModalVisible(false)}
          footer={null}
          width={1200}
        >
          <Table
            dataSource={contractRotationHistory}
            rowKey={(record) => `history-${record.contractId}-${record.startTime || Date.now()}`}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            size="small"
            columns={[
              {
                title: '密钥类型',
                dataIndex: 'keyType',
                key: 'keyType',
                width: 100,
                render: (type: string) => {
                  // 如果没有类型字段，默认为合约密钥（兼容旧数据）
                  const isSystemKey = type === 'system';
                  const isUnknown = !type;
                  return (
                    <Tag color={isSystemKey ? 'blue' : isUnknown ? 'default' : 'green'} style={{ fontSize: '11px' }}>
                      {isSystemKey ? '系统密钥' : isUnknown ? '合约密钥' : '合约密钥'}
                    </Tag>
                  );
                },
              },
              {
                title: '合约地址/应用ID',
                dataIndex: 'contractId',
                key: 'contractId',
                width: 200,
                render: (text: string) => {
                  if (!text) return <Text type="secondary">-</Text>;
                  return (
                    <Text copyable={{ text }} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {text.substring(0, 12)}...
                    </Text>
                  );
                },
              },
              {
                title: '旧密钥',
                dataIndex: 'oldKey',
                key: 'oldKey',
                width: 200,
                render: (text: string) => (
                  <Tooltip title={text || '无'}>
                    <Text copyable={{ text: text || '' }} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {text ? `${text.substring(0, 12)}...` : '-'}
                    </Text>
                  </Tooltip>
                ),
              },
              {
                title: '新密钥',
                dataIndex: 'newKey',
                key: 'newKey',
                width: 200,
                render: (text: string) => (
                  <Tooltip title={text || '无'}>
                    <Text copyable={{ text: text || '' }} style={{ fontFamily: 'monospace', fontSize: '12px', color: '#52c41a' }}>
                      {text ? `${text.substring(0, 12)}...` : '-'}
                    </Text>
                  </Tooltip>
                ),
              },
              {
                title: '开始时间',
                dataIndex: 'startTime',
                key: 'startTime',
                width: 180,
                render: (time: string) => (
                  <Text style={{ fontSize: '12px' }}>
                    {time ? new Date(time).toLocaleString('zh-CN') : '-'}
                  </Text>
                ),
              },
              {
                title: '结束时间',
                dataIndex: 'endTime',
                key: 'endTime',
                width: 180,
                render: (time: string | null, record: any) => {
                  // 如果 endTime 为 null，表示是新密钥，显示 "-"
                  if (!time) {
                    return <Text style={{ fontSize: '12px' }}>-</Text>;
                  }
                  // 如果有 endTime，显示该时间
                  return (
                    <Text style={{ fontSize: '12px' }}>
                      {new Date(time).toLocaleString('zh-CN')}
                    </Text>
                  );
                },
              },
            ]}
          />
        </Modal>

        {/* 合约更多信息模态框 */}
        <Modal
          title="合约详细信息"
          open={detailModalVisible}
          onCancel={() => {
            setDetailModalVisible(false);
            setSelectedContractDetail(null);
          }}
          footer={null}
          width={600}
        >
          {selectedContractDetail && (
            <div style={{ 
              padding: '20px', 
              background: '#001529',
              borderRadius: '8px',
              border: '1px solid #434343',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '6px', color: 'rgba(255, 255, 255, 0.45)' }}>
                    合约地址
                  </Text>
                  <Text copyable={{ text: selectedContractDetail.contractId }} style={{ fontSize: '12px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.85)' }}>
                    {selectedContractDetail.contractId}
                  </Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '6px', color: 'rgba(255, 255, 255, 0.45)' }}>
                    所属集群ID
                  </Text>
                  <Text copyable={{ text: selectedContractDetail.clusterId }} style={{ fontSize: '12px', fontFamily: 'monospace', color: 'rgba(255, 255, 255, 0.85)' }}>
                    {selectedContractDetail.clusterId}
                  </Text>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '6px', color: 'rgba(255, 255, 255, 0.45)' }}>
                    集群密钥
                  </Text>
                  {selectedContractDetail.clusterKey ? (
                    <Text copyable={{ text: selectedContractDetail.clusterKey }} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#52c41a', wordBreak: 'break-all' }}>
                      {selectedContractDetail.clusterKey}
                    </Text>
                  ) : (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      集群密钥未生成
                    </Text>
                  )}
                </div>
              </Space>
            </div>
          )}
        </Modal>

      </MainLayout>
    </AuthGuard>
  );
}