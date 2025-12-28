'use client';

// 完全禁用服务端渲染和预渲染，强制纯客户端渲染
// 这样可以避免Next.js在构建时或SSR时尝试fetch
export const dynamic = 'force-static';
export const fetchCache = 'force-no-store';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Button, Table, Tag, Typography, Space, Divider,
  Modal, Descriptions, Badge, Tooltip, Input, Select, Switch, Spin, InputNumber, message
} from 'antd';
import {
  MonitorOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ReloadOutlined, EyeOutlined, InfoCircleOutlined,
  SettingOutlined, CheckOutlined, DatabaseOutlined, ApiOutlined
} from '@ant-design/icons';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { decodeAddress } from '@polkadot/util-crypto';
import { getNodeUrl } from '@/lib/config';
import MainLayout from '@/components/layout/MainLayout';
import AuthGuard from '@/components/AuthGuard';
import { getWorkersInfo } from '@/lib/phalaApi';
import { HygonDeviceInfo, HygonCvmInfo } from '@/types/hygon';
import { getOfflineThreshold, setOfflineThreshold, isOnline as checkIsOnline } from '@/lib/offlineThreshold';

const { Title, Text } = Typography;

// 简化的Worker接口，只保留链上真实数据
interface WorkerMonitor {
  id: string;
  publicKey: string;
  teeType: string;
  status: 'online' | 'offline' | 'registered';
  sessionId?: string;
  initialScore?: number;
  responseStatus?: 'responding' | 'not-responding';
  responseDetails?: {
    initialized: boolean;
    registered: boolean;
    version: string;
    score: number;
    blocknum: number;
    memoryUsage?: any;
  };
}

// 注释掉CSV虚拟机状态接口
// interface CSVVMInfo {
//   name: string;
//   status: string;
//   tee_type: string;
//   host: string;
//   port: number;
//   vm_ip: string;
//   pid: string;
//   last_checked: string;
// }

// interface CSVVMResponse {
//   message: string;
//   vm_info: CSVVMInfo;
//   timestamp: string;
// }

// 简化的监控状态
interface MonitoringState {
  workers: WorkerMonitor[];
  totalWorkers: number;
  onlineWorkers: number;
  offlineWorkers: number;
  lastUpdate: number;
  hygonDeviceCount: number;
  // csvVMInfo?: CSVVMInfo; // 注释掉CSV虚拟机信息
}

const HIGHLIGHT_CVM_ID = '45R2pfjQUW2s9PQRHU48HQKLKHVMaDja7N3wpBtmF28UYDs2';

// CSV Worker 映射：公钥 -> 账户地址
const CSV_WORKER_MAPPING: Record<string, string> = {
  '0x42ccb38c3ed84007abed3e5b14de0dc766d1cb6f3ed6b91fe2cb0944616f155c': '428NizHpx2EKS4v3GhY2rk6nhJwPRZrK2LWPQ7P3xnu1MvrY',
  '0x16ce45340f940e602bc1cb53a20d13e049120739bad1100dd579104daac96c1d': '418h5pUzNJhNezRTfVGvJCo5bJRkKReFEsmY5QDTPWmyR7Gj',
};

const formatTimestamp = (value?: number) =>
  value ? new Date(value * 1000).toLocaleString() : '—';

const formatMemoryLabel = (value: number) =>
  `${value.toLocaleString()} MB`;

export default function MonitoringPage() {
  const [loading, setLoading] = useState(false);
  const [monitoringState, setMonitoringState] = useState<MonitoringState>({
    workers: [],
    totalWorkers: 0,
    onlineWorkers: 0,
    offlineWorkers: 0,
    lastUpdate: Date.now(),
    hygonDeviceCount: 0,
  });
  const [selectedWorker, setSelectedWorker] = useState<WorkerMonitor | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teeTypeFilter, setTeeTypeFilter] = useState<string>('all');

  const [hygonDevices, setHygonDevices] = useState<HygonDeviceInfo[]>([]);
  const [hygonLoading, setHygonLoading] = useState(false);
  const [hygonError, setHygonError] = useState<string | null>(null);

  // 离线判断阈值（单位：分钟），从localStorage读取，默认1分钟
  const [offlineThresholdMinutes, setOfflineThresholdMinutes] = useState<number>(() => {
    return getOfflineThreshold();
  });
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [tempThreshold, setTempThreshold] = useState<number>(1);

  // 判断是否在线：使用共享工具函数
  const isOnline = (lastHeartbeat?: number): boolean => {
    return checkIsOnline(lastHeartbeat, offlineThresholdMinutes);
  };

  // 打开设置弹窗
  const handleOpenSettings = () => {
    setTempThreshold(offlineThresholdMinutes);
    setSettingsModalVisible(true);
  };

  // 保存设置
  const handleSaveSettings = () => {
    if (tempThreshold < 0.1 || tempThreshold > 60) {
      message.error('阈值必须在0.1到60分钟之间');
      return;
    }
    setOfflineThresholdMinutes(tempThreshold);
    setOfflineThreshold(tempThreshold); // 保存到共享的localStorage
    message.success(`离线判断阈值已设置为 ${tempThreshold} 分钟，已应用到所有相关页面`);
    setSettingsModalVisible(false);
  };

  const fetchHygonDevices = async (): Promise<HygonDeviceInfo[]> => {
    setHygonLoading(true);
    try {
      const response = await fetch('/api/hygon-devices');
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || '无法获取Hygon设备数据');
      }
      const devices: HygonDeviceInfo[] = Array.isArray(payload.data?.devices)
        ? payload.data.devices
        : [];
      setHygonDevices(devices);
      setHygonError(null);
      return devices;
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取 Hygon 设备失败';
      setHygonError(message);
      setHygonDevices([]);
      console.error('[HygonDevices] 获取失败:', message);
      return [];
    } finally {
      setHygonLoading(false);
    }
  };

  // 获取已知worker地址的响应状态
  const fetchWorkerResponses = async (): Promise<Map<string, any>> => {
    const workerResponses = new Map<string, any>();

    // 两个已知的worker地址
    const workerUrls = [
      'http://8.147.107.221:18000',
      'http://8.147.106.136:8000'
    ];

    console.log('[fetchWorkerResponses] 开始检查已知worker地址...');

    await Promise.all(workerUrls.map(async (url) => {
      try {
        const apiUrl = `/api/worker-response?target=${encodeURIComponent(url)}&endpoint=/prpc/PhactoryAPI.GetInfo`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.public_key) {
            console.log(`[fetchWorkerResponses] ${url} 的public_key: ${data.public_key}`);
            workerResponses.set(data.public_key.toLowerCase(), {
              status: 'responding',
              details: {
                initialized: data.initialized || false,
                registered: data.registered || false,
                version: data.version,
                score: data.score || 0,
                blocknum: data.blocknum || 0,
                memoryUsage: data.memory_usage
              }
            });
          }
        }
      } catch (error) {
        console.error(`[fetchWorkerResponses] 检查${url}失败:`, error);
      }
    }));

    console.log(`[fetchWorkerResponses] 找到 ${workerResponses.size} 个有响应的worker`);
    return workerResponses;
  };

  // 注释掉CSV虚拟机状态获取函数
  // const fetchCSVVMStatus = async (): Promise<CSVVMInfo | null> => {
  //   try {
  //     // 使用相对路径，通过Next.js代理转发到后端
  //     const response = await fetch('/api/vm/status');
  //     if (!response.ok) {
  //       throw new Error(`HTTP error! status: ${response.status}`);
  //     }
  //     const data: CSVVMResponse = await response.json();
  //     return data.vm_info;
  //   } catch (error) {
  //     console.error('Error fetching CSV VM status:', error);
  //     return null;
  //   }
  // };

  // 查询 hygonTeeDevices 的辅助函数
  const queryHygonTeeDevices = async (): Promise<Set<string>> => {
    try {
      const wsUrl = getNodeUrl();
      const provider = new WsProvider(wsUrl);
      const apiPromise = ApiPromise.create({ provider, noInitWarn: true });
      const api = await apiPromise;

      if (api.query.phalaComputation?.hygonTeeDevices) {
        const hygonDevicesData = await api.query.phalaComputation.hygonTeeDevices.entries();
        const deviceAccounts = new Set<string>();
        hygonDevicesData.forEach(([key]: [any, any]) => {
          const accountId = key.args[0].toString();
          deviceAccounts.add(accountId);
        });
        await api.disconnect();
        return deviceAccounts;
      }
      await api.disconnect();
      return new Set();
    } catch (e) {
      console.warn('⚠️ [Monitoring] 查询 Hygon TEE Devices 失败:', e);
      return new Set();
    }
  };

  // 加载监控状态 - 基于真实Worker数据
  // 3. 【关键修改】重写 loadMonitoringState
  const loadMonitoringState = async () => {
    setLoading(true);
    try {
      const [workers, hygonTeeDevices] = await Promise.all([
        getWorkersInfo(),
        queryHygonTeeDevices()
      ]);
      console.log("--- [响应监控] 获取到真实Worker数据:", workers);

      console.log("--- [响应监控] 开始检查已知worker地址的响应状态 ---");
      const workerResponses = await fetchWorkerResponses();

      console.log("--- [响应监控] 开始匹配链上worker与响应状态 ---");
      const workerMonitors: WorkerMonitor[] = workers.map((worker, index) => {
        const publicKeyHex = worker.publicKey.replace('0x', '').toLowerCase();
        const responseInfo = workerResponses.get(publicKeyHex);

        console.log(`[Worker ${index + 1}] publicKey: ${publicKeyHex}, 响应状态: ${responseInfo ? '有响应' : '无响应'}`);

        return {
          id: `worker-${index + 1}`,
          publicKey: worker.publicKey,
          teeType: worker.teeType,
          status: worker.status.toLowerCase() as 'online' | 'offline' | 'registered',
          sessionId: worker.sessionId || undefined,
          initialScore: worker.initialScore || undefined,
          responseStatus: responseInfo ? responseInfo.status : 'not-responding',
          responseDetails: responseInfo?.details,
        };
      });

      console.log("--- [响应监控] Worker响应状态检查完成 ---");
      console.log("--- [响应监控] Worker详情:", workerMonitors);

      // 构建公钥到账户地址的映射（用于判断 CSV Worker）
      const pubkeyToAccountMap = new Map<string, string>();

      // 1. 从 CSV_WORKER_MAPPING 添加已知映射
      Object.entries(CSV_WORKER_MAPPING).forEach(([pubkey, account]) => {
        pubkeyToAccountMap.set(pubkey, account);
      });

      // 2. 从 hygonTeeDevices 构建映射
      hygonTeeDevices.forEach(accountAddress => {
        // 先检查 CSV_WORKER_MAPPING 中是否已有
        const knownPubkey = Object.keys(CSV_WORKER_MAPPING).find(
          pk => CSV_WORKER_MAPPING[pk] === accountAddress
        );

        if (!knownPubkey) {
          // 使用 decodeAddress 将账户地址转换为公钥
          try {
            const decoded = decodeAddress(accountAddress, false, 30); // ss58Format: 30 for Phala Network
            // 将 Uint8Array 转换为十六进制字符串
            const pubkey = '0x' + Array.from(decoded).map(b => b.toString(16).padStart(2, '0')).join('');
            pubkeyToAccountMap.set(pubkey, accountAddress);
          } catch (e) {
            // 如果解码失败，跳过这个账户
            console.warn(`Failed to decode address ${accountAddress}:`, e);
          }
        }
      });

      // 过滤掉 CSV Worker（公钥对应的账户在 hygonTeeDevices 中）
      const sgxWorkers = workerMonitors.filter(worker => {
        const workerPubkey = worker.publicKey;
        return !pubkeyToAccountMap.has(workerPubkey);
      });

      const onlineWorkers = sgxWorkers.filter(w => w.status === 'online').length;
      const offlineWorkers = sgxWorkers.filter(w => w.status === 'offline').length;

      const hygonDeviceList = await fetchHygonDevices();

      // 计算 Worker 数量（包括 hygonTeeDevices 中未注册的）
      const baseCount = sgxWorkers.length;
      const registeredPubkeys = new Set(sgxWorkers.map(w => w.publicKey));
      let additionalCount = 0;
      const processedPubkeys = new Set<string>(); // 用于去重

      hygonTeeDevices.forEach(accountAddress => {
        let pubkey: string | null = null;

        // 先检查 CSV_WORKER_MAPPING 中是否有已知映射
        const knownPubkey = Object.keys(CSV_WORKER_MAPPING).find(
          pk => CSV_WORKER_MAPPING[pk] === accountAddress
        );

        if (knownPubkey) {
          pubkey = knownPubkey;
        } else {
          // 使用 decodeAddress 将账户地址转换为公钥
          try {
            const decoded = decodeAddress(accountAddress, false, 30);
            pubkey = '0x' + Array.from(decoded).map(b => b.toString(16).padStart(2, '0')).join('');
          } catch (e) {
            console.warn(`Failed to decode address ${accountAddress}:`, e);
            return;
          }
        }

        // 检查该公钥是否已注册，且未处理过（去重）
        if (pubkey && !registeredPubkeys.has(pubkey) && !processedPubkeys.has(pubkey)) {
          additionalCount++;
          processedPubkeys.add(pubkey);
        }
      });

      const totalWorkers = baseCount + additionalCount;

      const newState: MonitoringState = {
        workers: sgxWorkers, // 只包含 SGX Workers
        totalWorkers,
        onlineWorkers,
        offlineWorkers,
        lastUpdate: Date.now(),
        hygonDeviceCount: hygonDeviceList.length,
      };

      setMonitoringState(newState);
    } catch (error) {
      console.error('Error loading monitoring state:', error);
    } finally {
      setLoading(false);
    }
  };

  // Worker监控区块刷新逻辑
  const [workersLoading, setWorkersLoading] = useState(false);
  const loadWorkers = async () => {
    setWorkersLoading(true);
    try {
      const [workers, hygonTeeDevices] = await Promise.all([
        getWorkersInfo(),
        queryHygonTeeDevices()
      ]);
      const workerResponses = await fetchWorkerResponses();
      const updatedWorkers = workers.map((worker, index) => {
        const publicKeyHex = worker.publicKey.replace('0x', '').toLowerCase();
        const responseInfo = workerResponses.get(publicKeyHex);
        return {
          id: `worker-${index + 1}`,
          publicKey: worker.publicKey,
          teeType: worker.teeType,
          status: worker.status.toLowerCase() as 'online' | 'offline' | 'registered',
          sessionId: worker.sessionId || undefined,
          initialScore: worker.initialScore || undefined,
          responseStatus: responseInfo ? responseInfo.status : 'not-responding',
          responseDetails: responseInfo?.details
        };
      });

      // 构建公钥到账户地址的映射（用于判断 CSV Worker）
      const pubkeyToAccountMap = new Map<string, string>();

      // 1. 从 CSV_WORKER_MAPPING 添加已知映射
      Object.entries(CSV_WORKER_MAPPING).forEach(([pubkey, account]) => {
        pubkeyToAccountMap.set(pubkey, account);
      });

      // 2. 从 hygonTeeDevices 构建映射
      hygonTeeDevices.forEach(accountAddress => {
        const knownPubkey = Object.keys(CSV_WORKER_MAPPING).find(
          pk => CSV_WORKER_MAPPING[pk] === accountAddress
        );

        if (!knownPubkey) {
          try {
            const decoded = decodeAddress(accountAddress, false, 30);
            const pubkey = '0x' + Array.from(decoded).map(b => b.toString(16).padStart(2, '0')).join('');
            pubkeyToAccountMap.set(pubkey, accountAddress);
          } catch (e) {
            console.warn(`Failed to decode address ${accountAddress}:`, e);
          }
        }
      });

      // 过滤掉 CSV Worker
      const sgxWorkers = updatedWorkers.filter(worker => {
        const workerPubkey = worker.publicKey;
        return !pubkeyToAccountMap.has(workerPubkey);
      });

      const hygonDeviceList = await fetchHygonDevices();

      // 计算 Worker 数量（包括 hygonTeeDevices 中未注册的）
      const baseCount = sgxWorkers.length;
      const registeredPubkeys = new Set(sgxWorkers.map(w => w.publicKey));
      let additionalCount = 0;
      const processedPubkeys = new Set<string>();

      hygonTeeDevices.forEach(accountAddress => {
        let pubkey: string | null = null;

        const knownPubkey = Object.keys(CSV_WORKER_MAPPING).find(
          pk => CSV_WORKER_MAPPING[pk] === accountAddress
        );

        if (knownPubkey) {
          pubkey = knownPubkey;
        } else {
          try {
            const decoded = decodeAddress(accountAddress, false, 30);
            pubkey = '0x' + Array.from(decoded).map(b => b.toString(16).padStart(2, '0')).join('');
          } catch (e) {
            console.warn(`Failed to decode address ${accountAddress}:`, e);
            return;
          }
        }

        if (pubkey && !registeredPubkeys.has(pubkey) && !processedPubkeys.has(pubkey)) {
          additionalCount++;
          processedPubkeys.add(pubkey);
        }
      });

      const totalWorkers = baseCount + additionalCount;

      setMonitoringState((prev) => ({
        ...prev,
        workers: sgxWorkers, // 只包含 SGX Workers
        totalWorkers,
        hygonDeviceCount: hygonDeviceList.length,
      }));
    } catch (e) {
      console.error('刷新Worker数据失败', e);
    }
    setWorkersLoading(false);
  };

  // 注释掉CSV虚拟机刷新逻辑
  // const [vmLoading, setVMLoading] = useState(false);
  // const loadVM = async () => {
  //   setVMLoading(true);
  //   try {
  //     const csvVMInfo = await fetchCSVVMStatus();
  //     setMonitoringState((prev) => ({ ...prev, csvVMInfo }));
  //   } catch (e) {
  //     console.error('刷新虚拟机状态失败', e);
  //   }
  //   setVMLoading(false);
  // };

  // 页面加载时刷新一次
  useEffect(() => {
    loadMonitoringState();
  }, []);

  // 处理自动刷新
  useEffect(() => {
    // 清除之前的定时器
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }

    // 如果开启自动刷新，设置新的定时器
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadMonitoringState();
      }, 60000); // 每60秒刷新一次
      setRefreshInterval(interval);
    }

    // 清理函数
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);

  // 筛选后的Worker数据
  const filteredWorkers = useMemo(() => {
    return monitoringState.workers.filter(worker => {
      const matchesSearch = searchText === '' ||
        worker.id.toLowerCase().includes(searchText.toLowerCase()) ||
        worker.publicKey.toLowerCase().includes(searchText.toLowerCase());

      // 【简化】不再需要特殊处理 'offline' 筛选
      const matchesStatus = statusFilter === 'all' || worker.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [monitoringState.workers, searchText, statusFilter]);

  const totalHygonCvms = useMemo(() => {
    return hygonDevices.reduce((acc, device) => acc + (device.cvms?.length || 0), 0);
  }, [hygonDevices]);

  // 简化的Worker表格列定义，只显示真实数据
  const workerColumns = useMemo(() => [
    {
      title: 'Worker ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (text: string) => (
        <Text code style={{ fontSize: '11px' }}>{text.substring(0, 8)}...</Text>
      )
    },
    {
      title: '公钥',
      dataIndex: 'publicKey',
      key: 'publicKey',
      width: 120,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text code style={{ fontSize: '10px' }}>
            {`${text.substring(0, 8)}...${text.substring(text.length - 6)}`}
          </Text>
        </Tooltip>
      )
    },
    {
      title: 'TEE类型',
      dataIndex: 'teeType',
      key: 'teeType',
      width: 80,
      render: (teeType: string) => {
        const colors = { 'Intel': 'cyan', 'AMD': 'orange', 'Unknown': 'blue' };
        const color = colors[teeType as keyof typeof colors];
        return <Tag color={color || 'default'}>{teeType || 'Unknown'}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const statusConfig = {
          online: { color: 'green', text: '在线' },
          offline: { color: 'red', text: '离线' },
          registered: { color: 'blue', text: '已注册' },
          unresponsive: { color: 'orange', text: '无响应' } // 添加无响应状态
        };
        const config = statusConfig[status as keyof typeof statusConfig];
        // 如果状态不在配置中，默认显示为离线（可能是已移除的 Worker）
        return config ? (
          <Tag color={config.color}>{config.text}</Tag>
        ) : (
          <Tag color="red">离线</Tag>
        );
      }
    },
    {
      title: '响应状态',
      dataIndex: 'responseStatus',
      key: 'responseStatus',
      width: 100,
      render: (responseStatus: string, record: WorkerMonitor) => {
        const config = {
          'responding': { color: 'green', text: '有响应' },
          'not-responding': { color: 'red', text: '无响应' }
        };
        const responseConfig = config[responseStatus as keyof typeof config];
        return responseConfig ? (
          <Tooltip title={
            record.responseDetails ?
              `版本: ${record.responseDetails.version}\n已初始化: ${record.responseDetails.initialized}\n已注册: ${record.responseDetails.registered}\n评分: ${record.responseDetails.score}\n区块数: ${record.responseDetails.blocknum}` :
              '无详细信息'
          }>
            <Tag color={responseConfig.color}>{responseConfig.text}</Tag>
          </Tooltip>
        ) : (
          <Tag color="default">未知</Tag>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: WorkerMonitor) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setSelectedWorker(record)}
        >
          详情
        </Button>
      )
    }
  ], []);

  const hygonColumns = useMemo(() => [
    {
      title: '设备ID',
      dataIndex: 'deviceId',
      key: 'deviceId',
      width: 200,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text code style={{ fontSize: '11px' }}>
            {`${text.substring(0, 10)}...${text.substring(text.length - 6)}`}
          </Text>
        </Tooltip>
      )
    },
    {
      title: 'CPU核心',
      dataIndex: 'cpuCount',
      key: 'cpuCount',
      width: 90,
      render: (value: number) => `${value} cores`
    },
    {
      title: '内存',
      dataIndex: 'memoryMb',
      key: 'memoryMb',
      width: 120,
      render: (value: number) => formatMemoryLabel(value)
    },
    {
      title: '最后心跳',
      dataIndex: 'lastHeartbeat',
      key: 'lastHeartbeat',
      width: 180,
      render: (value: number) => formatTimestamp(value)
    },
    {
      title: '心跳次数',
      dataIndex: 'heartbeatCount',
      key: 'heartbeatCount',
      width: 120,
    },
    {
      title: '奖励总量',
      dataIndex: 'totalRewards',
      key: 'totalRewards',
      width: 180,
      render: (value: string) => (
        <Text code style={{ fontSize: '11px' }} ellipsis>
          {value}
        </Text>
      )
    },
    {
      title: '是否在线',
      dataIndex: 'lastHeartbeat',
      key: 'isOnline',
      width: 100,
      render: (_: any, record: HygonDeviceInfo) => {
        const online = isOnline(record.lastHeartbeat);
        return (
          <Tag color={online ? 'green' : 'red'}>
            {online ? '在线' : '离线'}
          </Tag>
        );
      }
    },
  ], []);

  return (
    <AuthGuard>
      <MainLayout>
        <div style={{ marginBottom: '24px' }}>
          <Title level={2} style={{ fontSize: '18pt', marginBottom: '8px' }}>响应监控协议</Title>
          <Text type="secondary">
            监控TEE设备状态，管理计算节点，确保高质量的计算服务。
          </Text>
        </div>

        {/* 简化的统计卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="总Worker数"
                value={monitoringState?.totalWorkers || 0}
                prefix={<MonitorOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card>
              <Statistic
                title="在线Worker"
                value={monitoringState?.onlineWorkers || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Worker监控列表 */}
        <Card
          title={
            <Space>
              <DatabaseOutlined />
              <span>国产海光 TEE worker 监控</span>
            </Space>
          }
          extra={
            <Button
              icon={<SettingOutlined />}
              onClick={handleOpenSettings}
              size="small"
              type="default"
            >
              离线判断设置
            </Button>
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col>
              <Statistic
                title="链上 Hygon 设备"
                value={monitoringState.hygonDeviceCount}
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
            <Col>
              <Statistic
                title="关联 CVM 数"
                value={totalHygonCvms}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
          </Row>

          {hygonError && (
            <div style={{ marginBottom: 12 }}>
              <Text type="danger">{hygonError}</Text>
            </div>
          )}

          <Spin spinning={hygonLoading}>
            {hygonDevices.length > 0 ? (
              <Table
                rowKey="deviceId"
                columns={hygonColumns}
                dataSource={hygonDevices}
                pagination={{
                  pageSize: 5,
                  showSizeChanger: true,
                  showTotal: (total) => `设备总数: ${total}台`,
                }}
                size="small"
                style={{ margin: 0 }}
                scroll={{ x: 900 }}
              />
            ) : (
              !hygonLoading && (
                <div style={{ textAlign: 'center', padding: '32px' }}>
                  <Text type="secondary">链上暂未检测到 Hygon 设备，请稍候刷新。</Text>
                </div>
              )
            )}
          </Spin>
        </Card>

        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
              <span>国际 Intel SGX worker 监控</span>
              <Space size="large" style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                <Input
                  placeholder="搜索Worker ID或公钥"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                  style={{ width: '200px' }}
                  size="small"
                />
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: '150px' }}
                  size="small"
                  options={[
                    { value: 'all', label: '全部状态' },
                    { value: 'online', label: '在线' },
                    { value: 'registered', label: '已注册' }
                  ]}
                />
              </Space>
            </div>
          }
          extra={
            <div style={{ marginLeft: '16px' }}>
              <Button loading={workersLoading} icon={<ReloadOutlined />} size="small" onClick={loadWorkers}>刷新</Button>
            </div>
          }
          style={{ marginBottom: 16 }}
        >
          <Spin spinning={loading}><Table
            columns={workerColumns}
            dataSource={filteredWorkers}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
            }}
            scroll={{ x: 800 }}
            size="small"
          /></Spin>
        </Card>

        {/* 注释掉CSV虚拟机监控 */}
        {/* <Card
          title="国产CSV虚拟机监控"
          style={{ marginTop: '24px' }}
          extra={
            <Space>
              <Button loading={vmLoading} icon={<ReloadOutlined />} size="small" onClick={loadVM}>
                刷新
              </Button>
              <Badge
                status={monitoringState?.csvVMInfo?.status === 'running' ? 'success' : 'error'}
                text={monitoringState?.csvVMInfo?.status === 'running' ? '运行中' : '离线'}
              />
            </Space>
          }
        >
          {monitoringState?.csvVMInfo ? (
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="虚拟机名称"
                    value={monitoringState.csvVMInfo.name}
                    prefix={<MonitorOutlined />}
                    valueStyle={{ color: '#1890ff', fontSize: '14px' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="运行状态"
                    value={monitoringState.csvVMInfo.status}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{
                      color: monitoringState.csvVMInfo.status === 'running' ? '#52c41a' : '#ff4d4f',
                      fontSize: '14px'
                    }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="TEE类型"
                    value={monitoringState.csvVMInfo.tee_type}
                    prefix={<DatabaseOutlined />}
                    valueStyle={{ color: '#722ed1', fontSize: '14px' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="进程数量"
                    value={monitoringState.csvVMInfo.pid ? monitoringState.csvVMInfo.pid.split('\n').length : 0}
                    prefix={<ApiOutlined />}
                    valueStyle={{
                      color: '#1890ff',
                      fontSize: '14px'
                    }}
                    suffix="个"
                  />
                </Card>
              </Col>
            </Row>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Text type="secondary">CSV虚拟机状态获取中...</Text>
            </div>
          )}

          {monitoringState?.csvVMInfo && (
            <div style={{ marginTop: '16px' }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Card size="small" title="网络信息">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text strong>主机地址: </Text>
                        <Text code>{monitoringState.csvVMInfo.host}:{monitoringState.csvVMInfo.port}</Text>
                      </div>
                      <div>
                        <Text strong>虚拟机IP: </Text>
                        <Text code>{monitoringState.csvVMInfo.vm_ip}</Text>
                      </div>
                      <div>
                        <Text strong>最后检查: </Text>
                        <Text>{new Date(monitoringState.csvVMInfo.last_checked).toLocaleString()}</Text>
                      </div>
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} sm={12}>
                  <Card size="small" title="进程信息">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text strong>进程ID列表: </Text>
                        <div style={{ marginTop: '8px' }}>
                          {monitoringState.csvVMInfo.pid ? monitoringState.csvVMInfo.pid.split('\n').map((pid, index) => (
                            <Tag key={index} color="blue" style={{ marginBottom: '4px' }}>
                              {pid.trim()}
                            </Tag>
                          )) : []}
                        </div>
                      </div>
                      <div>
                        <Text strong>总进程数: </Text>
                        <Text code>{monitoringState.csvVMInfo.pid ? monitoringState.csvVMInfo.pid.split('\n').length : 0} 个</Text>
                      </div>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </div>
          )}
        </Card> */}

        {/* 离线判断设置 */}
        <Card
          title={
            <Space>
              <SettingOutlined />
              <span>离线判断设置</span>
            </Space>
          }
          style={{ marginTop: '24px', marginBottom: '24px' }}
          extra={
            <Button
              icon={<SettingOutlined />}
              onClick={handleOpenSettings}
              size="small"
            >
              修改设置
            </Button>
          }
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Statistic
                title="当前离线判断阈值"
                value={offlineThresholdMinutes}
                suffix="分钟"
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={24} sm={12} md={16}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text type="secondary">
                  说明：如果设备的最后心跳时间与当前时间的差值超过此阈值，将被判定为离线。
                </Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  当前设置：{offlineThresholdMinutes} 分钟（{offlineThresholdMinutes * 60} 秒）
                </Text>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 模块说明 - 深色主题 */}
        <Row gutter={[16, 16]} style={{ marginTop: '24px' }}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <CheckOutlined style={{ color: '#52c41a' }} />
                  <span>响应监控协议说明</span>
                </Space>
              }
              style={{ background: '#1f1f1f', border: '1px solid #434343' }}
              headStyle={{ background: '#1f1f1f', borderBottom: '1px solid #434343' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div style={{
                  background: '#2a2a2a',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid #434343'
                }}>
                  <Space>
                    <InfoCircleOutlined style={{ color: '#52c41a', fontSize: '18px' }} />
                    <Text strong style={{ color: '#ffffff', fontSize: '16px' }}>监控目标</Text>
                  </Space>
                  <br />
                  <Text style={{ color: '#d9d9d9', marginTop: '8px', display: 'block' }}>
                    实时监控TEE设备的运行状态，包括在线状态、TEE类型等关键指标，确保计算节点的高可用性。
                  </Text>
                </div>

                <div style={{
                  background: '#2a2a2a',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid #434343'
                }}>
                  <Space>
                    <SettingOutlined style={{ color: '#52c41a', fontSize: '18px' }} />
                    <Text strong style={{ color: '#ffffff', fontSize: '16px' }}>监控指标</Text>
                  </Space>
                  <br />
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <Tag color="green" style={{ marginRight: '8px' }}>在线状态</Tag>
                      <Text style={{ color: '#d9d9d9' }}>Worker是否与区块链节点保持连接</Text>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <Tag color="green" style={{ marginRight: '8px' }}>TEE类型</Tag>
                      <Text style={{ color: '#d9d9d9' }}>Intel SGX、AMD SEV等硬件类型识别</Text>
                    </div>
                    <div>
                      <Tag color="green" style={{ marginRight: '8px' }}>Session状态</Tag>
                      <Text style={{ color: '#d9d9d9' }}>Worker与区块链的Session绑定状态</Text>
                    </div>
                  </div>
                </div>
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title={
                <Space>
                  <DatabaseOutlined style={{ color: '#52c41a' }} />
                  <span>系统架构说明</span>
                </Space>
              }
              style={{ background: '#1f1f1f', border: '1px solid #434343' }}
              headStyle={{ background: '#1f1f1f', borderBottom: '1px solid #434343' }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div style={{
                  background: '#2a2a2a',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid #434343'
                }}>
                  <Space>
                    <ApiOutlined style={{ color: '#52c41a', fontSize: '18px' }} />
                    <Text strong style={{ color: '#ffffff', fontSize: '16px' }}>监控架构</Text>
                  </Space>
                  <br />
                  <Text style={{ color: '#d9d9d9', marginTop: '8px', display: 'block' }}>
                    通过区块链节点查询Worker注册信息，实时获取TEE设备状态和性能数据，构建完整的监控体系。
                  </Text>
                </div>

                <div style={{
                  background: '#2a2a2a',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid #434343'
                }}>
                  <Space>
                    <MonitorOutlined style={{ color: '#52c41a', fontSize: '18px' }} />
                    <Text strong style={{ color: '#ffffff', fontSize: '16px' }}>数据来源</Text>
                  </Space>
                  <br />
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <Tag color="green" style={{ marginRight: '8px' }}>区块链查询</Tag>
                      <Text style={{ color: '#d9d9d9' }}>从链上获取Worker注册信息</Text>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <Tag color="green" style={{ marginRight: '8px' }}>状态监控</Tag>
                      <Text style={{ color: '#d9d9d9' }}>实时检查Worker在线状态</Text>
                    </div>
                    <div>
                      <Tag color="green" style={{ marginRight: '8px' }}>类型识别</Tag>
                      <Text style={{ color: '#d9d9d9' }}>自动识别TEE硬件类型</Text>
                    </div>
                  </div>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Worker详情Modal */}
        <Modal
          title="Worker详情"
          open={selectedWorker !== null}
          onCancel={() => setSelectedWorker(null)}
          footer={null}
          width={600}
        >
          {selectedWorker && (
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Worker ID">
                <Text code>{selectedWorker.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="公钥">
                <Text code style={{ fontSize: '12px' }}>{selectedWorker.publicKey}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="TEE类型">
                <Tag color={selectedWorker.teeType === 'Intel' ? 'cyan' : selectedWorker.teeType === 'AMD' ? 'orange' : 'blue'}>
                  {selectedWorker.teeType}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={
                  selectedWorker.status === 'online' ? 'green' :
                    selectedWorker.status === 'offline' ? 'red' : 'blue'
                }>
                  {selectedWorker.status === 'online' ? '在线' :
                    selectedWorker.status === 'offline' ? '离线' : '已注册'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Session ID">
                {selectedWorker.sessionId ? (
                  <Text code style={{ fontSize: '12px' }}>{selectedWorker.sessionId}</Text>
                ) : (
                  <Tag color="default">未绑定</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="初始评分">
                {selectedWorker.initialScore ? selectedWorker.initialScore.toFixed(2) : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="响应状态">
                {selectedWorker.responseStatus === 'responding' ? (
                  <Tag color="green">有响应</Tag>
                ) : selectedWorker.responseStatus === 'not-responding' ? (
                  <Tag color="red">无响应</Tag>
                ) : (
                  <Tag color="default">未知</Tag>
                )}
              </Descriptions.Item>
              {selectedWorker.responseDetails && (
                <>
                  <Descriptions.Item label="Worker版本">
                    <Text code>{selectedWorker.responseDetails.version}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="已初始化">
                    <Tag color={selectedWorker.responseDetails.initialized ? 'green' : 'red'}>
                      {selectedWorker.responseDetails.initialized ? '是' : '否'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="已注册">
                    <Tag color={selectedWorker.responseDetails.registered ? 'green' : 'red'}>
                      {selectedWorker.responseDetails.registered ? '是' : '否'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="当前评分">
                    {selectedWorker.responseDetails.score}
                  </Descriptions.Item>
                  <Descriptions.Item label="区块高度">
                    {selectedWorker.responseDetails.blocknum}
                  </Descriptions.Item>
                  {selectedWorker.responseDetails.memoryUsage && (
                    <Descriptions.Item label="内存使用">
                      <Text type="secondary">
                        Rust: {(selectedWorker.responseDetails.memoryUsage.rust_used / 1024 / 1024).toFixed(2)} MB
                      </Text>
                    </Descriptions.Item>
                  )}
                </>
              )}
            </Descriptions>
          )}
        </Modal>

        {/* 设置弹窗 */}
        <Modal
          title="离线判断设置"
          open={settingsModalVisible}
          onOk={handleSaveSettings}
          onCancel={() => {
            setSettingsModalVisible(false);
            setTempThreshold(offlineThresholdMinutes);
          }}
          okText="保存"
          cancelText="取消"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Text strong>离线判断阈值（分钟）</Text>
              <div style={{ marginTop: 8 }}>
                <InputNumber
                  min={0.1}
                  max={60}
                  step={0.1}
                  value={tempThreshold}
                  onChange={(value) => setTempThreshold(value || 1)}
                  style={{ width: '100%' }}
                  addonAfter="分钟"
                />
              </div>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 8 }}>
                范围：0.1 - 60 分钟（6 秒 - 3600 秒）
              </Text>
            </div>
            <div
              style={{
                backgroundColor: '#1f1f1f',
                background: '#1f1f1f',
                padding: '12px',
                borderRadius: '4px',
                border: '1px solid #434343'
              } as React.CSSProperties}
            >
              <Text type="secondary" style={{ fontSize: '12px', color: '#d9d9d9' }}>
                <strong style={{ color: '#ffffff' }}>说明：</strong>如果设备的最后心跳时间与当前时间的差值超过此阈值，将被判定为离线。
                <br />
                当前设置：{tempThreshold} 分钟 = {tempThreshold * 60} 秒
              </Text>
            </div>
          </Space>
        </Modal>
      </MainLayout>
    </AuthGuard>
  );
}