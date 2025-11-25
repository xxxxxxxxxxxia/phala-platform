'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Row, Col, Statistic, Button, Table, Tag, Typography, Space, Divider,
  Modal, Descriptions, Badge, Tooltip, Input, Select, Switch, Spin
} from 'antd';
import {
  MonitorOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ReloadOutlined, EyeOutlined, InfoCircleOutlined,
  SettingOutlined, CheckOutlined, DatabaseOutlined, ApiOutlined
} from '@ant-design/icons';
import MainLayout from '@/components/layout/MainLayout';
import AuthGuard from '@/components/AuthGuard';
import { getWorkersInfo } from '@/lib/phalaApi';
import { getTeeApiUrl } from '@/lib/config';
import axios from 'axios';

const { Title, Text } = Typography;

// 后端API地址
const API_BASE_URL = "http://8.147.106.136:3001/api";

// 设备类型定义
type HOST = {
  key: string;
  name: string;
  status: "running" | "stopped";
  address: string;
  cpu: string;
  memory: string;
};

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
  // csvVMInfo?: CSVVMInfo; // 注释掉CSV虚拟机信息
}

export default function MonitoringPage() {
  const [loading, setLoading] = useState(false);
  const [monitoringState, setMonitoringState] = useState<MonitoringState>({
    workers: [],
    totalWorkers: 0,
    onlineWorkers: 0,
    offlineWorkers: 0,
    lastUpdate: Date.now(),
  });
  const [selectedWorker, setSelectedWorker] = useState<WorkerMonitor | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teeTypeFilter, setTeeTypeFilter] = useState<string>('all');

  // 设备列表状态
  const [hosts, setHosts] = useState<HOST[]>([
    {
      key: "1",
      name: "csv-vm",
      status: "running",
      address: "192.168.122.76",
      cpu: "1 cores",
      memory: "4096 MB",
    },
    {
      key: "2",
      name: "csv-vm2",
      status: "running",
      address: "192.168.122.77",
      cpu: "2 cores",
      memory: "2048 MB",
    },
    {
      key: "3",
      name: "csv-vm3",
      status: "running",
      address: "192.168.122.78",
      cpu: "2 cores",
      memory: "4096 MB",
    },
  ]);

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

  // 加载监控状态 - 基于真实Worker数据
  // 3. 【关键修改】重写 loadMonitoringState
  const loadMonitoringState = async () => {
    setLoading(true);
    try {
      const [workers] = await Promise.all([
        getWorkersInfo()
        // 注释掉CSV虚拟机状态获取
        // fetchCSVVMStatus()
      ]);
      console.log("--- [响应监控] 获取到真实Worker数据:", workers);
      // console.log("--- [响应监控] 获取到CSV虚拟机状态:", csvVMInfo);

      // 首先获取所有已知worker地址的响应状态
      console.log("--- [响应监控] 开始检查已知worker地址的响应状态 ---");
      const workerResponses = await fetchWorkerResponses();

      // 将真实Worker数据转换为监控格式，只保留链上真实数据，并匹配响应状态
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

      const onlineWorkers = workerMonitors.filter(w => w.status === 'online').length;
      const offlineWorkers = workerMonitors.filter(w => w.status === 'offline').length;

      // 计算running状态的设备数量
      const runningDevices = hosts.filter(h => h.status === 'running').length;

      // 总worker数 = worker数量 + running状态的设备数量
      const totalWorkers = workerMonitors.length + runningDevices;

      const newState: MonitoringState = {
        workers: workerMonitors,
        totalWorkers,
        onlineWorkers,
        offlineWorkers,
        lastUpdate: Date.now(),
        // csvVMInfo: csvVMInfo || undefined, // 注释掉CSV虚拟机信息
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
      const workers = await getWorkersInfo();
      const workerResponses = await fetchWorkerResponses();
      // 保持和主loadMonitoringState一致的数据处理 ...（略）
      // 计算running状态的设备数量
      const runningDevices = hosts.filter(h => h.status === 'running').length;

      // 这里只更新worker部分的monitoringState
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

      // 总worker数 = worker数量 + running状态的设备数量
      const totalWorkers = updatedWorkers.length + runningDevices;

      setMonitoringState((prev) => ({
        ...prev,
        workers: updatedWorkers,
        totalWorkers,
      }));
    } catch (e) {
      // 错误提示也可以toast
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

  // 设备列表相关定义
  const hostDataSource = hosts.filter((host) =>
    host.name.toLowerCase().includes('')
  );

  const hostColumns = [
    {
      title: "Worker 名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (s: string) => (
        <Tag color={s === "running" ? "success" : "default"}>{s}</Tag>
      ),
    },
    {
      title: "IP地址",
      dataIndex: "address",
      key: "address",
    },
    {
      title: "CPU信息",
      dataIndex: "cpu",
      key: "cpu",
    },
    {
      title: "内存信息",
      dataIndex: "memory",
      key: "memory",
    },
  ];

  // 定期获取VM状态（可选，用于更新设备状态）
  useEffect(() => {
    const fetchHostStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/vm/list`);
        const hostsData = response.data;
        const apiHosts = hostsData.vms;
        console.log(hostsData);

        // 更新VM状态
        setHosts((prevHosts) => {
          // 创建一个映射来快速查找API返回的VM
          const apiHostMap = new Map();
          // 检查apiVms是否为数组，防止apiVms.forEach不是函数的错误
          if (Array.isArray(apiHosts)) {
            apiHosts.forEach((host: HOST) => {
              apiHostMap.set(host.name, host);
            });
          }

          // 更新每个VM的状态
          const updatedHosts = prevHosts.map((host) => {
            const apiHost = apiHostMap.get(host.name);
            if (apiHost) {
              // 如果在API响应中找到该VM，保持其状态为running
              return { ...host, status: "running" as "running" | "stopped" };
            } else {
              // 如果在API响应中找不到该VM，将其标记为stopped
              return { ...host, status: "stopped" as "running" | "stopped" };
            }
          });

          // 计算running状态的设备数量，更新totalWorkers
          const runningDevices = updatedHosts.filter(h => h.status === 'running').length;
          setMonitoringState((prev) => ({
            ...prev,
            totalWorkers: prev.workers.length + runningDevices,
          }));

          return updatedHosts;
        });
      } catch (error) {
        console.error("获取HOST状态失败:", error);
      }
    };

    // 立即执行一次
    fetchHostStatus();
  }, []);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
              <span>Worker（SGX）监控</span>
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

        {/* 设备列表 - 从调度页面复制 */}
        <Card title="Worker（CSV）监控" style={{ marginBottom: 16 }}>
          <Table
            rowKey="key"
            columns={hostColumns}
            dataSource={hostDataSource}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (t) => `设备总数: ${t}台`,
            }}
            size="small"
            style={{ margin: 0 }}
          />
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
      </MainLayout>
    </AuthGuard>
  );
}