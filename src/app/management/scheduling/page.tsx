// app/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { ComponentType } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  ConfigProvider,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  theme as antTheme,
  Typography,
  Upload,
  message,
  Empty,
  Collapse,
  Badge,
} from "antd";
import {
  ApiOutlined,
  BarChartOutlined,
  BranchesOutlined,
  CloseCircleOutlined,
  FireOutlined,
  InboxOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
  DownOutlined,
  UpOutlined,
  MonitorOutlined,
  UploadOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
const { Title, Text } = Typography;
import dynamic from "next/dynamic";
import axios from "axios";
import { HygonDeviceInfo } from "@/types/hygon";

import MainLayout from "@/components/layout/MainLayout";
import DataCard from "@/components/DataCard";
import AuthGuard from '@/components/AuthGuard';
import { getOfflineThreshold, isOnline as checkIsOnline } from '@/lib/offlineThreshold';

// 后端服务器的地址，请确保与你的后端服务地址一致
const API_BASE_URL = "http://8.147.106.136:3002/api";
const { Dragger } = Upload;

type SERVICE = {
  key: string;
  name: string;
  version: string;
  created: string;
  status: string;
  host: string;
};

type HOST = {
  key: string;
  name: string;
  status: "running" | "stopped";
  // refreshTime: number;
  address: string;
  cpu: string;
  memory: string;
};

type DockerService = {
  containerId: string;
  name: string;
  service: string;
  version: string;
  command: string;
  created: string;
  status: string;
  ports: string;
};

type VmServiceData = {
  vmIp: string;
  success: boolean;
  services?: {
    docker: DockerService[];
  };
  error?: string;
};

type DeployResponse = {
  message: string;
  output?: string;
  error?: string;
  command?: string;
};

type MonitorData = {
  cpuUsage: string;
  memory: string;
};

interface ScenarioConfig {
  id: string;
  title: string;
  description: string;
  tag: string;
  accent: string;
  icon: ComponentType;
}

interface WorkerInsight {
  pubkey: string;
  endpoint?: string;
  online: boolean;
  latencyMs?: number;
  version?: string;
  registered: boolean;
  state: string;
  gatekeeper: boolean;
  inCluster: boolean;
  lastUpdated: number;
  score: number;
  isRecommended?: boolean;
}

interface WorkerInsightResponse {
  clusterId: string;
  fetchedAt: number;
  recommended: WorkerInsight | null;
  workers: WorkerInsight[];
}

type ScenarioResult = Record<string, any>;

const HIGHLIGHT_CVM_ID = "45R2pfjQUW2s9PQRHU48HQKLKHVMaDja7N3wpBtmF28UYDs2";

const formatTimestamp = (value?: number) =>
  value ? new Date(value * 1000).toLocaleString() : "—";

const formatMemoryLabel = (value: number) => `${value.toLocaleString()} MB`;

// 判断是否在线：使用共享工具函数，从localStorage读取阈值
const isOnline = (lastHeartbeat?: number): boolean => {
  return checkIsOnline(lastHeartbeat);
};

// 判断SGX Worker是否在线：基于lastUpdated时间，使用共享工具函数
const isWorkerOnline = (lastUpdated?: number): boolean => {
  return checkIsOnline(lastUpdated);
};

const truncateId = (value?: string, prefix = 6, suffix = 4) => {
  if (!value) return "--";
  if (value.length <= prefix + suffix) return value;
  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
};

// 合约信息类型（复用隐私合约的类型）
type PrivacyContract = {
  id: string;
  name: string;
  address: string;
  type: 'SGX' | 'ZK' | 'MPC' | 'HE' | 'SGX+SideVM';
  status: 'active' | 'inactive' | 'pending' | 'error';
  deployedAt: number;
  lastUpdate: number;
  gasUsed: number;
  storageUsed: number;
  privacyLevel: number;
  securityScore: number;
  executionCount: number;
  owner: string;
  version: string;
  isVerified: boolean;
};

const SCENARIOS: ScenarioConfig[] = [
  {
    id: "fairness",
    title: "公平调度",
    description: "多流请求同时进入，验证 SFQ 在等权场景下能否平均服务。",
    tag: "Equal Weight",
    accent: "#52c41a",
    icon: BranchesOutlined,
  },
  {
    id: "weight-distribution",
    title: "带权重调度",
    description: "设置不同权重的合约，看资源是否按比例分配、吞吐是否随权重变化。",
    tag: "Weighted",
    accent: "#9254de",
    icon: ThunderboltOutlined,
  },
  {
    id: "overload-protection",
    title: "过载保护",
    description: "模拟流量洪峰，观察服务器如何拒绝部分请求来保护核心任务。",
    tag: "Overload",
    accent: "#fa8c16",
    icon: FireOutlined,
  },
];

const LineChart = dynamic(
  () => import("@ant-design/plots").then((mod) => mod.Line),
  { ssr: false }
);
const ColumnChart = dynamic(
  () => import("@ant-design/plots").then((mod) => mod.Column),
  { ssr: false }
);

const scenarioFlowColumns = [
  {
    title: "Flow ID",
    dataIndex: "flowId",
    key: "flowId",
    render: (value: string) => <Text code>{value}</Text>,
  },
  {
    title: "权重",
    dataIndex: "weight",
    key: "weight",
    render: (value: number) => (
      <Tag color={value === 1 ? "default" : value === 3 ? "processing" : "success"}>
        {value}x
      </Tag>
    ),
  },
  { title: "总请求", dataIndex: "total", key: "total" },
  { title: "已接受", dataIndex: "accepted", key: "accepted" },
  {
    title: "期望接受",
    dataIndex: "expectedAccepted",
    key: "expectedAccepted",
    render: (value: number | undefined) => value !== undefined ? value.toFixed(1) : "--",
  },
  { title: "已拒绝", dataIndex: "rejected", key: "rejected" },
];

const sfqFlowColumns = [
  {
    title: "任务流名称",
    dataIndex: "flow",
    key: "flow",
    render: (value: string) => <Text code>{value?.replace("_", " ").toUpperCase() || "--"}</Text>,
  },
  {
    title: "优先级权重",
    dataIndex: "weight",
    key: "weight",
    render: (value: number) => (
      <Tag color={value === 1 ? "default" : value <= 3 ? "processing" : "success"}>
        {value}x
      </Tag>
    ),
  },
  {
    title: "已处理",
    dataIndex: "accepted",
    key: "accepted",
    render: (value: number, record: any) => (
      <Space>
        <Text strong style={{ color: "#52c41a" }}>{value || 0}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          / {((record.accepted || 0) + (record.rejected || 0))} 总数
        </Text>
      </Space>
    ),
  },
  {
    title: "拒绝数",
    dataIndex: "rejected",
    key: "rejected",
    render: (value: number) => (
      <Text style={{ color: value > 0 ? "#f5222d" : undefined }}>{value || 0}</Text>
    ),
  },
  {
    title: "处理进度",
    key: "progress",
    render: (_: any, record: any) => {
      const total = (record.accepted || 0) + (record.rejected || 0);
      const progress = total > 0 ? ((record.accepted || 0) / total) * 100 : 0;
      return (
        <Progress
          percent={Math.round(progress)}
          size="small"
          status={progress === 100 ? "success" : "active"}
          strokeColor="#52c41a"
        />
      );
    },
  },
];

export default function HomePage() {
  const [search] = useState("");
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  // const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [, setAllServicesModalOpen] = useState(false);
  const [currentVmIp, setCurrentVmIp] = useState<string | null>(null);
  const [vmServices, setVmServices] = useState<SERVICE[]>([]);
  const [allVmServices, setAllVmServices] = useState<VmServiceData[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingAllServices, setLoadingAllServices] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [, setResult] = useState<DeployResponse | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
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
  const [monitorData, setMonitorData] = useState<MonitorData | null>(null);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [selectedHost, setSelectedHost] = useState<HOST | null>(null);
  const [stopServiceAlert, setStopServiceAlert] = useState<{
    visible: boolean;
    message: string;
  }>({
    visible: false,
    message: "",
  });

  // 添加状态来跟踪正在删除的服务
  const [stoppingService, setStoppingService] = useState<string | null>(null);

  // 添加状态来存储调度信息
  const [scheduledInfo, setScheduledInfo] = useState<{
    ip: string;
    hostName: string;
  } | null>(null);

  // SGX 调度相关状态
  const [sgxLoading, setSgxLoading] = useState(false);
  const [sgxAutoRefresh, setSgxAutoRefresh] = useState(false); // 默认手动刷新
  const [workerInsights, setWorkerInsights] = useState<WorkerInsightResponse | null>(null);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [scenarioRunning, setScenarioRunning] = useState<string | null>(null);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [addContractAddress, setAddContractAddress] = useState<string>("");
  const [addInputs, setAddInputs] = useState({ a: 1, b: 2 });
  const [addWorkerEndpoint, setAddWorkerEndpoint] = useState<string | undefined>();
  const [addResult, setAddResult] = useState<any>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [sfqStatus, setSfqStatus] = useState<any>(null);
  const [sfqLoading, setSfqLoading] = useState(false);
  const [sfqExpanded, setSfqExpanded] = useState(false);

  // CSV Worker监控相关状态
  const [hygonDevices, setHygonDevices] = useState<HygonDeviceInfo[]>([]);
  const [hygonLoading, setHygonLoading] = useState(false);
  const [hygonError, setHygonError] = useState<string | null>(null);

  // SGX Worker监控相关状态
  const [contracts, setContracts] = useState<PrivacyContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  // 部署服务相关状态
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployForm] = Form.useForm();
  const [deployFileList, setDeployFileList] = useState<UploadFile[]>([]);

  // 上传合约相关状态
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm] = Form.useForm();

  // 终端输出相关状态
  const [terminalOutput, setTerminalOutput] = useState<string>('等待操作...');
  const [isTerminalActive, setIsTerminalActive] = useState(false);

  const {
    token: { colorBgContainer, colorText },
  } = antTheme.useToken();

  // 在组件加载时自动获取所有VM服务信息
  useEffect(() => {
    loadHygonDevices();
    loadContracts();
  }, []);

  // 获取链上 Hygon 设备信息
  const loadHygonDevices = async () => {
    setHygonLoading(true);
    try {
      const response = await fetch("/api/hygon-devices");
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "无法获取 Hygon 设备数据");
      }

      const devices: HygonDeviceInfo[] = Array.isArray(payload.data?.devices)
        ? payload.data.devices
        : [];
      setHygonDevices(devices);
      setHygonError(null);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "获取 Hygon 设备失败";
      setHygonError(messageText);
      setHygonDevices([]);
      message.error(messageText);
    } finally {
      setHygonLoading(false);
    }
  };

  // 加载合约信息
  const loadContracts = async () => {
    setContractsLoading(true);
    try {
      // 先尝试真实API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch('/api/contracts/real', {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const result = await response.json();

        if (result.success && result.data?.contracts) {
          setContracts(result.data.contracts);
          return;
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name !== 'AbortError') {
          console.log('真实API失败，回退到快速API:', error.message);
        }
      }

      // 回退到快速API
      const response = await fetch('/api/contracts/fast?action=status');
      const result = await response.json();

      if (result.success && result.data?.contracts) {
        setContracts(result.data.contracts);
      }
    } catch (error: any) {
      console.error('加载合约信息失败:', error);
    } finally {
      setContractsLoading(false);
    }
  };

  // 上传合约函数
  const handleUploadContract = async (values: any) => {
    setUploading(true);
    setIsTerminalActive(true);
    setTerminalOutput('📤 开始上传合约...\n正在处理合约文件...');

    // 立即关闭弹窗，让用户看到终端输出
    setUploadModalVisible(false);
    uploadForm.resetFields();

    try {
      const formData = new FormData();
      formData.append('description', values.description || '');
      if (values.contractFile && values.contractFile.length > 0) {
        formData.append('contractFile', values.contractFile[0].originFileObj);
      }

      setTerminalOutput(prev => prev + '\n📋 合约信息:');
      setTerminalOutput(prev => prev + '\n正在上传到链上...');
      setTerminalOutput(prev => prev + '\n⏳ 这可能需要20-30秒，请耐心等待...');

      const response = await fetch('/api/contracts/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setTerminalOutput(prev => prev + '\n✅ 合约上传成功！');
        setTerminalOutput(prev => prev + `\n📋 部署详情:`);

        const contractAddress = result.data?.address || result.data?.contractId || result.contractAddress;
        const contractId = result.data?.contractId || result.data?.address || result.contractAddress;

        if (contractId && contractId !== 'unknown') {
          setTerminalOutput(prev => prev + `\n   - 合约ID: ${contractId}`);
        }
        if (contractAddress && contractAddress !== 'unknown') {
          setTerminalOutput(prev => prev + `\n   - 合约地址: ${contractAddress}`);
        }

        if (result.warning) {
          setTerminalOutput(prev => prev + `\n⚠️ 警告: ${result.warning}`);
          message.warning(result.warning);
        } else {
          message.success('合约上传成功！');
        }

        loadContracts(); // 刷新合约列表
      } else {
        setTerminalOutput(prev => prev + '\n❌ 上传失败！');
        setTerminalOutput(prev => prev + `\n错误: ${result.error || '未知错误'}`);
        message.error(result.error || '上传失败');
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      setTerminalOutput(prev => prev + '\n❌ 上传失败！');
      setTerminalOutput(prev => prev + `\n错误: ${error.message}`);
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
      setIsTerminalActive(false);
    }
  };

  // 部署系统合约函数
  const deploySystemContract = async () => {
    setUploadModalVisible(false);
    uploadForm.resetFields();

    try {
      setUploading(true);
      setIsTerminalActive(true);
      setTerminalOutput('🚀 开始部署系统合约...\n正在连接区块链节点...');
      setTerminalOutput(prev => prev + '\n⏳ 系统合约部署需要1-2分钟，请耐心等待...');

      const response = await fetch('/api/contracts/deploy-system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setTerminalOutput(prev => prev + '\n✅ 系统合约部署成功！');
        message.success(`系统合约部署成功！`);

        if (result.output) {
          setTerminalOutput(prev => prev + '\n\n📋 部署详情:\n' + result.output);
        }

        loadContracts(); // 刷新合约列表
      } else {
        setTerminalOutput(prev => prev + '\n❌ 部署失败！');
        message.error(result.error || '部署失败');
        if (result.error) {
          setTerminalOutput(prev => prev + '\n错误: ' + result.error);
        }
      }
    } catch (error: any) {
      console.error('Deploy failed:', error);
      setTerminalOutput(prev => prev + '\n❌ 部署失败！');
      setTerminalOutput(prev => prev + `\n错误: ${error.message}`);
      message.error('部署失败，请重试');
    } finally {
      setUploading(false);
      setIsTerminalActive(false);
    }
  };

  // 下载示例合约函数
  const downloadSampleContract = () => {
    const link = document.createElement('a');
    link.href = '/sample_contracts/phat_hello.contract';
    link.download = 'phat_hello.contract';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success('示例合约下载成功！请使用 phat_hello.contract 文件上传部署。注意：只支持.contract和.wasm文件格式。');
  };

  // 下载示例部署文件函数
  const downloadSampleDeployFile = () => {
    const link = document.createElement('a');
    link.href = '/api/download-compose';
    link.download = 'docker-compose.yml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('开始下载部署示例文件');
  };

  // 定期获取VM状态
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
          return prevHosts.map((host) => {
            const apiHost = apiHostMap.get(host.name);
            if (apiHost) {
              // 如果在API响应中找到该VM，保持其状态为running
              return { ...host, status: "running" };
            } else {
              // 如果在API响应中找不到该VM，将其标记为stopped
              return { ...host, status: "stopped" };
            }
          });
        });
      } catch (error) {
        console.error("获取HOST状态失败:", error);
      }
    };

    // 立即执行一次
    fetchHostStatus();

    // 每隔10秒执行一次
    // const interval = setInterval(fetchHostStatus, 10000);

    // // 清除间隔
    // return () => clearInterval(interval);
  }, []);

  const fetchVmServices = async (vmIp: string) => {
    setLoadingServices(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/vm/docker-services`, {
        params: { vmIp },
      });
      const data = response.data;
      console.log(data);

      // 假设返回的数据结构是数组，如果没有数据则默认为空数组
      const servicesData = Array.isArray(data.services) ? data.services : [];

      // 添加 key 字段以满足 Table 组件的需求
      const servicesWithKeys = servicesData.map(
        (service: any, index: number) => ({
          ...service,
          key: index.toString(),
        })
      );

      setVmServices(servicesWithKeys);
      setCurrentVmIp(vmIp);
    } catch (error) {
      console.error("获取服务信息失败:", error);
      message.error("获取服务信息失败");
      setVmServices([]);
    } finally {
      setLoadingServices(false);
    }
  };

  const fetchAllVmServices = async () => {
    setLoadingAllServices(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/vm/all-services`);
      const data = response.data;
      console.log(data);

      setAllVmServices(data.data || []);
      setAllServicesModalOpen(true);
    } catch (error) {
      console.error("获取所有服务信息失败:", error);
      message.error("获取所有服务信息失败");
      setAllVmServices([]);
    } finally {
      setLoadingAllServices(false);
    }
  };

  const fetchMonitorData = async (vmIp: string) => {
    setLoadingMonitor(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/vm/monitor`, {
        params: { vmIp },
      });
      setMonitorData(response.data);
    } catch (error) {
      console.error("获取监控信息失败:", error);
      message.error("获取监控信息失败");
      setMonitorData(null);
    } finally {
      setLoadingMonitor(false);
    }
  };

  const handleStopService = async (record: any) => {
    // 设置正在删除的服务ID
    const serviceId = record.key || record.name;
    setStoppingService(serviceId);

    try {
      const response = await axios.post(`${API_BASE_URL}/vm/stop-service`, {
        vmIp: record.vmIp,
        serviceName: serviceId,
      });
      console.log(response.data);

      if (response.data.message) {
        // 显示banner样式警告信息
        message.success(response.data.message);
        // 设置警告横幅信息
        setStopServiceAlert({
          visible: true,
          message: response.data.message,
        });

        setAllVmServices([]);
        // 刷新服务列表
        await fetchAllVmServices();
      }
    } catch (error: any) {
      console.error("删除服务失败:", error);
      const errorMessage = error.response?.data?.message || "删除服务失败";
      message.error(errorMessage);
    } finally {
      // 无论成功或失败都清除loading状态
      setStoppingService(null);
    }
  };

  // SGX 调度逻辑
  const loadSFQStatus = useCallback(async () => {
    setSfqLoading(true);
    try {
      console.log("[前端] 开始加载SFQ状态...");
      const response = await fetch("/api/scheduling/flip?action=sfq-status");
      const data = await response.json();
      console.log("[前端] SFQ状态响应:", data);
      console.log("[前端] SFQ可用状态:", data.available);
      setSfqStatus(data);
    } catch (error) {
      console.error("[前端] 加载SFQ状态失败:", error);
      setSfqStatus({ success: false, available: false, status: "SFQ服务器未运行" });
    } finally {
      setSfqLoading(false);
    }
  }, []);

  const loadWorkerInsights = useCallback(async () => {
    setWorkerLoading(true);
    try {
      // 使用原来的API，但API内部已经使用监控页面的方式获取worker
      const res = await fetch("/api/scheduling/workers");
      const data = await res.json();
      if (data.success && data.data) {
        // 只保留有响应的worker（online: true）
        const onlineWorkers = data.data.workers?.filter((w: WorkerInsight) => w.online === true) || [];
        setWorkerInsights({
          ...data.data,
          workers: onlineWorkers,
          // 重新选择推荐worker（从在线worker中选择）
          recommended: onlineWorkers.find((w: WorkerInsight) => w.isRecommended) ||
            onlineWorkers.reduce((best: WorkerInsight | null, worker: WorkerInsight) => {
              if (!best || worker.score > best.score) return worker;
              return best;
            }, null) ||
            null,
        });
      } else {
        message.warning(data.error || "无法获取 Worker 信息");
      }
    } catch (error: any) {
      message.error(error?.message || "无法获取 Worker 信息");
    } finally {
      setWorkerLoading(false);
    }
  }, []);

  const loadSgxAll = useCallback(async () => {
    setSgxLoading(true);
    await Promise.all([loadWorkerInsights(), loadSFQStatus()]);
    setSgxLoading(false);
  }, [loadWorkerInsights, loadSFQStatus]);

  useEffect(() => {
    loadSgxAll();
  }, [loadSgxAll]);

  useEffect(() => {
    if (!sgxAutoRefresh) return;
    // 默认手动刷新，自动刷新间隔设置为120秒（2分钟）
    const timer = setInterval(() => {
      loadWorkerInsights();
      loadSFQStatus();
    }, 120000); // 120秒刷新一次
    return () => clearInterval(timer);
  }, [sgxAutoRefresh, loadWorkerInsights, loadSFQStatus]);

  useEffect(() => {
    const recommended =
      workerInsights?.recommended ||
      workerInsights?.workers?.find((worker) => worker.isRecommended) ||
      workerInsights?.workers?.find((worker) => !!worker.endpoint);
    if (recommended?.endpoint) {
      setAddWorkerEndpoint(recommended.endpoint);
    }
  }, [workerInsights]);

  // 启动和停止功能已移除，请使用 scripts/sfq-server.sh 脚本管理服务器

  const runScenario = async (scenarioId: string) => {
    if (!sfqStatus?.available) {
      message.warning("请先使用脚本启动 SFQ 服务器: ./scripts/sfq-server.sh start");
      return;
    }

    setScenarioRunning(scenarioId);
    setScenarioResult(null);
    try {
      const response = await fetch("/api/scheduling/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      const data = await response.json();
      if (data.success) {
        setScenarioResult(data.data);
        message.success(`${data.data.scenarioName || "场景"} 运行完成`);
      } else {
        message.error(data.error || "场景运行失败");
      }
    } catch (error: any) {
      message.error(error?.message || "场景运行失败");
    } finally {
      setScenarioRunning(null);
    }
  };

  const runAddQuery = async () => {
    if (!addContractAddress || addContractAddress.trim() === "") {
      message.error("请先输入合约地址");
      return;
    }
    setAddLoading(true);
    setAddResult(null);
    try {
      const params = new URLSearchParams({
        contractAddress: addContractAddress.trim(),
        a: addInputs.a.toString(),
        b: addInputs.b.toString(),
      });
      if (addWorkerEndpoint) {
        params.set("workerEndpoint", addWorkerEndpoint);
      }
      const response = await fetch(`/api/contracts/add-query?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "查询失败" }));
        throw new Error(errorData.error || "查询失败");
      }
      const data = await response.json();
      if (data.success) {
        setAddResult(data);
        message.success("查询成功");
      } else {
        throw new Error(data.error || "查询失败");
      }
    } catch (error: any) {
      message.error(error?.message || "查询失败");
      setAddResult({ success: false, error: error?.message || "查询失败" });
    } finally {
      setAddLoading(false);
    }
  };

  const workerDataSource = useMemo(
    () =>
      workerInsights?.workers?.map((worker, index) => ({
        key: worker.pubkey || `worker-${index}`,
        ...worker,
      })) || [],
    [workerInsights]
  );

  const workerColumns = useMemo(
    () => [
      {
        title: "Worker 公钥",
        dataIndex: "pubkey",
        key: "pubkey",
        render: (value: string, record: WorkerInsight) => (
          <Space size="small">
            <Text code style={{ fontSize: 12 }}>
              {value ? `${value.slice(0, 10)}...${value.slice(-6)}` : "--"}
            </Text>
            {record.isRecommended && <Tag color="cyan">推荐</Tag>}
            {!record.inCluster && <Tag>未入集群</Tag>}
          </Space>
        ),
      },
      {
        title: "Endpoint",
        dataIndex: "endpoint",
        key: "endpoint",
        render: (value?: string) => value || "链上注册",
      },
      {
        title: "响应状态",
        dataIndex: "online",
        key: "online",
        render: (value: boolean) =>
          value ? <Tag color="green">有响应</Tag> : <Tag color="red">无响应</Tag>,
      },
      {
        title: "延迟 (ms)",
        dataIndex: "latencyMs",
        key: "latencyMs",
        render: (value?: number) => (typeof value === "number" ? value.toFixed(0) : "--"),
      },
      {
        title: "健康得分",
        dataIndex: "score",
        key: "score",
        render: (value?: number) => (typeof value === "number" ? value.toFixed(1) : "--"),
      },
    ],
    []
  );

  const workerSelectOptions = useMemo(
    () =>
      workerDataSource
        .filter((worker) => !!worker.endpoint)
        .map((worker) => ({
          label: `${worker.endpoint} (${worker.pubkey?.slice(0, 6) || "--"}...)`,
          value: worker.endpoint as string,
        })),
    [workerDataSource]
  );

  const scenarioTotals = useMemo(() => {
    if (!scenarioResult?.flowStats) return null;
    const totals = Object.entries(scenarioResult.flowStats).reduce(
      (acc: { accepted: number; rejected: number; total: number }, [, stats]: [string, any]) => {
        acc.accepted += stats.accepted ?? 0;
        acc.rejected += stats.rejected ?? 0;
        acc.total += stats.total ?? (stats.accepted ?? 0) + (stats.rejected ?? 0);
        return acc;
      },
      { accepted: 0, rejected: 0, total: 0 }
    );
    return totals;
  }, [scenarioResult]);

  const scenarioFlowData = useMemo(() => {
    if (!scenarioResult?.flowStats) return [];
    const flowConfig =
      scenarioResult.flows?.reduce(
        (map: Record<string, any>, flow: any) => ({ ...map, [flow.id]: flow }),
        {}
      ) ?? {};
    return Object.entries(scenarioResult.flowStats).map(([flowId, stats]: [string, any]) => ({
      key: flowId,
      flowId,
      weight: flowConfig[flowId]?.weight ?? stats.weight ?? "--",
      ...stats,
    }));
  }, [scenarioResult]);

  const scenarioStats = useMemo(() => {
    if (!scenarioResult) return [];
    const aggregatedAccepted =
      scenarioResult.totalAccepted ??
      (typeof scenarioTotals?.accepted === "number" ? scenarioTotals.accepted : undefined);
    const aggregatedRejected =
      scenarioResult.totalRejected ??
      (typeof scenarioTotals?.rejected === "number" ? scenarioTotals.rejected : undefined);
    const aggregatedTotal =
      scenarioResult.totalRequests ??
      scenarioResult.total ??
      scenarioResult.results?.length ??
      scenarioTotals?.total ??
      (aggregatedAccepted !== undefined && aggregatedRejected !== undefined
        ? aggregatedAccepted + aggregatedRejected
        : undefined);
    const rejectionRateValue =
      typeof scenarioResult.rejectionRate === "number"
        ? scenarioResult.rejectionRate
        : aggregatedTotal
          ? (aggregatedRejected ?? 0) / (aggregatedTotal || 1)
          : undefined;
    const rejectionRate =
      typeof rejectionRateValue === "number"
        ? `${(rejectionRateValue * 100).toFixed(1)}%`
        : "--";
    const duration = scenarioResult.totalTime ?? scenarioResult.duration ?? "--";
    return [
      { title: "总请求", value: aggregatedTotal ?? "--" },
      { title: "接受", value: aggregatedAccepted ?? "--" },
      { title: "拒绝", value: aggregatedRejected ?? "--" },
      { title: "拒绝率", value: rejectionRate },
      { title: "耗时 (ms)", value: duration },
    ];
  }, [scenarioResult, scenarioTotals]);

  const sfqSummaryStats = useMemo(() => {
    if (!sfqStatus?.data) return [];

    // 计算总处理数
    const totalAccepted = sfqStatus.data.flows?.reduce((sum: number, f: any) => sum + (f.accepted || 0), 0) || 0;
    const totalRejected = sfqStatus.data.flows?.reduce((sum: number, f: any) => sum + (f.rejected || 0), 0) || 0;
    const totalRequests = totalAccepted + totalRejected;
    const successRate = totalRequests > 0 ? ((totalAccepted / totalRequests) * 100).toFixed(1) : "0";

    return [
      {
        title: "处理成功率",
        value: `${successRate}%`,
        suffix: `${totalAccepted}/${totalRequests}`,
      },
      {
        title: "当前正在处理",
        value: sfqStatus.data.serving ?? "无",
        suffix: "流",
      },
      {
        title: "活跃任务流",
        value: sfqStatus.data.flows ? sfqStatus.data.flows.length : 0,
        suffix: "个",
      },
    ];
  }, [sfqStatus]);

  const sfqFlowTableData = useMemo(() => {
    if (!sfqStatus?.data?.flows) return [];
    return sfqStatus.data.flows.map((flow: any, index: number) => ({
      key: flow.flow || `sfq-flow-${index}`,
      ...flow,
    }));
  }, [sfqStatus]);

  const flowChartData = useMemo(() => {
    if (!sfqStatus?.data?.flows) return [];
    return sfqStatus.data.flows.map((flow: any) => ({
      flow: flow.flow,
      label: `${flow.flow || "unknown"} (w=${flow.weight ?? "--"})`,
      vClock: flow.vClock,
      weight: flow.weight,
      backlog: flow.backlog ?? 0,
      accepted: flow.accepted ?? 0,
      rejected: flow.rejected ?? 0,
    }));
  }, [sfqStatus]);

  const flowPerformanceData = useMemo(() => {
    if (!sfqStatus?.data?.flows) return [];
    return sfqStatus.data.flows.flatMap((flow: any) => {
      const label = `${flow.flow || "unknown"} (w=${flow.weight ?? "--"})`;
      return [
        {
          label,
          category: "Accepted",
          value: flow.accepted ?? 0,
        },
        {
          label,
          category: "Rejected",
          value: flow.rejected ?? 0,
        },
      ];
    });
  }, [sfqStatus]);

  const recommendedWorker = useMemo(() => {
    return (
      workerInsights?.recommended ||
      workerInsights?.workers?.find((worker) => worker.isRecommended) ||
      workerInsights?.workers?.[0] ||
      null
    );
  }, [workerInsights]);

  const hostDataSource = hosts.filter((host) =>
    host.name.toLowerCase().includes(search.trim().toLowerCase())
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
    {
      title: "操作",
      key: "actions",
      render: (_: any, r: HOST) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<SearchOutlined />}
            onClick={() => {
              setSearchModalOpen(true);
              fetchVmServices(r.address);
            }}
            disabled={r.status === "stopped"}
          >
            查询服务
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<BarChartOutlined />}
            onClick={() => {
              setResourceModalOpen(true);
              setSelectedHost(r);
              fetchMonitorData(r.address);
            }}
            disabled={r.status === "stopped"}
          >
            资源监控
          </Button>
        </Space>
      ),
    },
  ];

  const vmServicesColumns = [
    {
      title: "服务名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
    },
    {
      title: "创建时间",
      dataIndex: "created",
      key: "created",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
    },
  ];

  const allVmServicesColumns = [
    {
      title: "服务ID",
      dataIndex: "containerId",
      key: "containerId",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return "无服务";
        }
        return text || "N/A";
      },
    },
    {
      title: "服务名称",
      dataIndex: "name",
      key: "serviceName",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return "无服务";
        }
        return text || "N/A";
      },
    },
    {
      title: "镜像",
      dataIndex: "service",
      key: "service",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return "无服务";
        }
        return text || "N/A";
      },
    },
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return "无服务";
        }
        return text || "N/A";
      },
    },
    {
      title: "主机IP",
      dataIndex: "vmIp",
      key: "vmIp",
    },
    {
      title: "创建时间",
      dataIndex: "created",
      key: "created",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return "无服务";
        }
        return text || "N/A";
      },
    },
    {
      title: "容器状态",
      dataIndex: "status",
      key: "status",
      render: (text: string, record: any) => {
        if (record.isEmpty) {
          return <span style={{ color: "red" }}>错误信息: {record.error}</span>;
        }

        let color = "default";
        if (text?.includes("Up")) {
          color = "success";
        } else if (text?.includes("Exited")) {
          color = "error";
        }
        return <Tag color={color}>{text || "N/A"}</Tag>;
      },
    },
    {
      title: "操作",
      key: "actions",
      render: (_: any, r: SERVICE) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CloseCircleOutlined />}
            danger
            onClick={() => handleStopService(r)}
            disabled={!r.status || !r.status.includes("Up")}
            loading={stoppingService === (r.key || r.name)}
          >
            删除服务
          </Button>
        </Space>
      ),
    },
  ];

  const handleDeploy = async (vals: { name: string }) => {
    console.log("Deploy new instance:", vals.name);
    form.resetFields();
    setDeployModalOpen(false);
  };

  const handleDeployButtonClick = async () => {
    try {
      setDeployLoading(true);
      const response = await axios.get(`${API_BASE_URL}/scheduled-vm`);
      console.log(response.data);

      if (response.data && response.data.scheduledVmIp) {
        const ip = response.data.scheduledVmIp;

        // 查找对应的主机名称
        const matchedHost = hosts.find((host) => host.address === ip);
        const hostName = matchedHost ? matchedHost.name : "未知主机";
        console.log(hostName);

        // 存储调度信息
        setScheduledInfo({
          ip,
          hostName,
        });

        // 打开部署模态框
        setDeployModalOpen(true);
      }
    } catch (error) {
      console.error("调度接口调用失败:", error);
      message.error("调度失败，请稍后重试");
    } finally {
      setDeployLoading(false);
    }
  };

  /* 上传前校验 */
  const beforeUpload = (file: File) => {
    const isYaml =
      file.type === "application/x-yaml" ||
      file.name.endsWith(".yaml") ||
      file.name.endsWith(".yml");
    if (!isYaml) {
      message.error("只能上传 docker-compose.yaml / *.yml 文件");
      return Upload.LIST_IGNORE;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error("文件大小不能超过 10MB");
      return Upload.LIST_IGNORE;
    }
    return false; // 手动上传
  };

  /* 自定义部署上传逻辑 */
  const customDeployRequest = async (options: any) => {
    const { file } = options;
    setDeployLoading(true);
    setIsTerminalActive(true);
    setTerminalOutput('🚀 开始部署服务...\n正在处理部署文件...');

    // 立即关闭弹窗，让用户看到终端输出
    setDeployModalOpen(false);
    deployForm.resetFields();

    const formData = new FormData();
    formData.append("composeFile", file);

    // 获取表单中的部署路径和调度的主机IP
    const values = deployForm.getFieldsValue();
    const vmPath = values.name; // 部署路径
    const vmIp = scheduledInfo?.ip; // 主机IP

    // 添加主机IP和路径到formData
    if (vmIp) {
      formData.append("vmIp", vmIp);
      setTerminalOutput(prev => prev + `\n📋 目标主机: ${vmIp}`);
    }

    if (vmPath) {
      formData.append("vmPath", vmPath);
      setTerminalOutput(prev => prev + `\n📋 部署路径: ${vmPath}`);
    }

    setTerminalOutput(prev => prev + '\n⏳ 正在上传并部署，请耐心等待...');

    try {
      const { data } = await axios.post<DeployResponse>(
        `${API_BASE_URL}/deploy`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      console.log(data);

      setTerminalOutput(prev => prev + '\n✅ 部署完成！');
      if (data.message) {
        setTerminalOutput(prev => prev + `\n📋 ${data.message}`);
      }
      if (data.output) {
        setTerminalOutput(prev => prev + '\n\n📋 部署输出:\n' + data.output);
      }

      message.success(data.message || "部署完成");
      loadHygonDevices(); // 刷新链上 Hygon 数据
    } catch (err: any) {
      const resp = err.response?.data as DeployResponse;
      setTerminalOutput(prev => prev + '\n❌ 部署失败！');
      setTerminalOutput(prev => prev + `\n错误: ${resp?.message || err.message || '网络异常，请稍后重试'}`);
      message.error(resp?.message || "部署失败");
    } finally {
      setDeployLoading(false);
      setIsTerminalActive(false);
    }
  };

  // const handleDispatch = (vals: { name: string }) => {
  //   console.log("Dispatch instance:", vals.name);
  //   form.resetFields();
  //   setDispatchModalOpen(false);
  // };

  // 解析CPU使用率百分比
  const parseCpuUsage = (cpuUsage: string): number => {
    if (!cpuUsage) return 0;
    const match = cpuUsage.match(/(\d+\.?\d*)%/);
    return match ? parseFloat(match[1]) : 0;
  };

  // 解析内存使用率百分比
  const parseMemoryUsage = (memory: string): number => {
    if (!memory) return 0;
    const match = memory.match(/\((\d+\.?\d*)%\)/);
    return match ? parseFloat(match[1]) : 0;
  };

  return (
    <AuthGuard>
      <MainLayout>
        <ConfigProvider
          theme={{
            algorithm: antTheme.darkAlgorithm, // 黑夜模式
            token: {
              colorPrimary: "#9f2cff", // 自定义主色（可选）
            },
          }}
        >
          <div
            style={{
              minHeight: "100vh",
              background: "#0d0e20", // 纯黑背景
              padding: 4,
              color: colorText,
            }}
          >
            <Title level={2} style={{ fontSize: "18pt" }}>
              安全调度
            </Title>
            <Text type="secondary"></Text>

            {/* 监控信息大模块 */}
            <div style={{ marginBottom: 32 }}>
              {/* CSV Worker监控模块 */}
              <div style={{ marginBottom: 24 }}>
                <DataCard
                  title="CSV Worker 监控"
                  extra={
                    <Space>
                      <Button
                        icon={<PlusOutlined />}
                        onClick={handleDeployButtonClick}
                        loading={deployLoading}
                        size="small"
                        type="primary"
                      >
                        部署服务
                      </Button>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={loadHygonDevices}
                        loading={hygonLoading}
                        size="small"
                        type="text"
                        style={{ color: "rgba(255,255,255,0.85)" }}
                      >
                        刷新
                      </Button>
                    </Space>
                  }
                >
                  <Spin spinning={hygonLoading}>
                    {hygonError && (
                      <div style={{ marginBottom: 12 }}>
                        <Text type="danger">{hygonError}</Text>
                      </div>
                    )}
                    {hygonDevices.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {hygonDevices.map((device) => (
                          <Card
                            key={device.deviceId}
                            size="small"
                            style={{
                              background: "#1a1d3a",
                              borderColor: "#1f2a44",
                              marginBottom: 16,
                            }}
                          >
                            <Row gutter={[24, 16]}>
                              <Col xs={24} lg={8}>
                                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                                  <div>
                                    <Text strong style={{ color: "#fff", fontSize: 16 }}>
                                      {truncateId(device.deviceId, 8, 6)}
                                    </Text>
                                    <Tag color="purple" style={{ marginLeft: 8 }}>
                                      Hygon TEE
                                    </Tag>
                                  </div>
                                  <Space direction="vertical" size="small">
                                    <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                      CPU: {device.cpuCount} 核
                                    </Text>
                                    <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                      内存: {formatMemoryLabel(device.memoryMb)}
                                    </Text>
                                    <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                      最后心跳: {formatTimestamp(device.lastHeartbeat)}
                                      <Tag
                                        color={isOnline(device.lastHeartbeat) ? "green" : "red"}
                                        style={{ marginLeft: 8 }}
                                      >
                                        {isOnline(device.lastHeartbeat) ? "在线" : "离线"}
                                      </Tag>
                                    </Text>
                                    <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                      心跳次数: {device.heartbeatCount}
                                    </Text>
                                    <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                      累计奖励:{" "}
                                      <Text code style={{ fontSize: 12 }}>
                                        {device.totalRewards}
                                      </Text>
                                    </Text>
                                    <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                      绑定 CVM: {device.cvms.length} 台
                                    </Text>
                                  </Space>
                                </Space>
                              </Col>
                              <Col xs={24} lg={16}>
                                <div>
                                  <Text strong style={{ color: "#fff", marginBottom: 12, display: "block", fontSize: 14 }}>
                                    CVM 详情
                                  </Text>
                                  {device.cvms.length > 0 ? (
                                    <div
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 12,
                                        maxHeight: "260px",
                                        overflowY: "auto",
                                        paddingRight: 4,
                                      }}
                                    >
                                      {device.cvms.map((cvm) => (
                                        <Card
                                          key={cvm.id}
                                          size="small"
                                          style={{
                                            background: "#0f111a",
                                            borderColor: "#1f2a44",
                                            minWidth: 220,
                                            flex: "1 1 220px",
                                          }}
                                          bodyStyle={{ padding: "12px" }}
                                        >
                                          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                              <Text strong style={{ color: "#fff", fontSize: 13 }}>
                                                {truncateId(cvm.id, 8, 4)}
                                              </Text>
                                              {cvm.id === HIGHLIGHT_CVM_ID && (
                                                <Tag color="gold">重点 CVM</Tag>
                                              )}
                                            </div>
                                            <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                              CPU: {cvm.cpuCount} 核 / 内存: {formatMemoryLabel(cvm.memoryMb)}
                                            </Text>
                                            <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                              最后心跳: {formatTimestamp(cvm.lastHeartbeat)}
                                              <Tag
                                                color={isOnline(cvm.lastHeartbeat) ? "green" : "red"}
                                                style={{ marginLeft: 8 }}
                                              >
                                                {isOnline(cvm.lastHeartbeat) ? "在线" : "离线"}
                                              </Tag>
                                            </Text>
                                            <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                              心跳次数: {cvm.heartbeatCount}
                                            </Text>
                                          </Space>
                                        </Card>
                                      ))}
                                    </div>
                                  ) : (
                                    <Empty
                                      description="未绑定 CVM"
                                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                                      style={{ padding: "16px 0" }}
                                    />
                                  )}
                                </div>
                              </Col>
                            </Row>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      !hygonLoading && (
                        <Empty
                          description="链上暂未检测到 Hygon 设备"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      )
                    )}
                  </Spin>
                </DataCard>
              </div>

              <div style={{ marginTop: 24 }} />

              {/* SGX Worker监控模块 */}
              <DataCard
                title="SGX Worker 监控"
                extra={
                  <Space>
                    <Button
                      icon={<UploadOutlined />}
                      onClick={() => setUploadModalVisible(true)}
                      size="small"
                      type="primary"
                    >
                      上传合约
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        loadWorkerInsights();
                        loadContracts();
                      }}
                      loading={workerLoading || contractsLoading}
                      size="small"
                      type="text"
                      style={{ color: "rgba(255,255,255,0.85)" }}
                    >
                      刷新
                    </Button>
                  </Space>
                }
              >
                <Spin spinning={workerLoading || contractsLoading}>
                  {workerInsights?.workers && workerInsights.workers.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {workerInsights.workers.map((worker) => (
                        <Card
                          key={worker.pubkey}
                          size="small"
                          style={{
                            background: "#1a1d3a",
                            borderColor: "#1f2a44",
                            marginBottom: 16,
                          }}
                        >
                          <Row gutter={[24, 16]}>
                            {/* 左面：Worker信息 */}
                            <Col xs={24} lg={8}>
                              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                                <div>
                                  <Text strong style={{ color: "#fff", fontSize: 16 }}>
                                    Worker
                                  </Text>
                                  {worker.isRecommended && (
                                    <Tag color="cyan" style={{ marginLeft: 8 }}>推荐</Tag>
                                  )}
                                  {!worker.inCluster && (
                                    <Tag style={{ marginLeft: 8 }}>未入集群</Tag>
                                  )}
                                </div>
                                <Space direction="vertical" size="small">
                                  <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                    公钥: <Text code style={{ color: "#fff", fontSize: 12 }}>
                                      {worker.pubkey ? `${worker.pubkey.slice(0, 10)}...${worker.pubkey.slice(-6)}` : "--"}
                                    </Text>
                                  </Text>
                                  <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                    Endpoint: {worker.endpoint || "链上注册"}
                                  </Text>
                                  <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                    状态: <Tag color={worker.online ? "green" : "red"}>
                                      {worker.online ? "有响应" : "无响应"}
                                    </Tag>
                                  </Text>
                                  <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                    延迟: {typeof worker.latencyMs === "number" ? `${worker.latencyMs.toFixed(0)} ms` : "--"}
                                    <Tag
                                      color={isWorkerOnline(worker.lastUpdated) ? "green" : "red"}
                                      style={{ marginLeft: 8 }}
                                    >
                                      {isWorkerOnline(worker.lastUpdated) ? "在线" : "离线"}
                                    </Tag>
                                  </Text>
                                  <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                    健康得分: {typeof worker.score === "number" ? worker.score.toFixed(1) : "--"}
                                  </Text>
                                </Space>
                              </Space>
                            </Col>

                            {/* 右面：合约信息 */}
                            <Col xs={24} lg={16}>
                              <div>
                                <Text strong style={{ color: "#fff", marginBottom: 12, display: "block", fontSize: 14 }}>
                                  链上合约 ({contracts.length} 个)
                                </Text>
                                {contracts.length > 0 ? (
                                  <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                    maxHeight: "250px",
                                    overflowY: "auto",
                                    overflowX: "hidden",
                                    paddingRight: 4,
                                  }}>
                                    {contracts.map((contract) => {
                                      const typeColors: Record<string, string> = {
                                        'SGX': 'blue',
                                        'ZK': 'purple',
                                        'MPC': 'orange',
                                        'HE': 'green',
                                        'SGX+SideVM': 'cyan'
                                      };
                                      const statusMap: Record<string, { color: string; text: string }> = {
                                        'active': { color: 'green', text: '运行中' },
                                        'inactive': { color: 'orange', text: '已停止' },
                                        'pending': { color: 'blue', text: '等待中' },
                                        'error': { color: 'red', text: '错误' }
                                      };
                                      const statusInfo = statusMap[contract.status] || { color: 'default', text: contract.status.toUpperCase() };

                                      return (
                                        <Card
                                          key={contract.address}
                                          size="small"
                                          style={{
                                            background: "#0f111a",
                                            borderColor: "#1f2a44",
                                            marginBottom: 0,
                                          }}
                                          bodyStyle={{ padding: "12px" }}
                                        >
                                          <Row gutter={[12, 8]}>
                                            <Col span={24}>
                                              <Space>
                                                <Text strong style={{ color: "#fff", fontSize: 13 }}>
                                                  {contract.name}
                                                </Text>
                                                {contract.isVerified && (
                                                  <Tag color="green">已验证</Tag>
                                                )}
                                                <Tag color={typeColors[contract.type] || 'default'}>
                                                  {contract.type}
                                                </Tag>
                                                <Tag color={statusInfo.color}>
                                                  {statusInfo.text}
                                                </Tag>
                                              </Space>
                                            </Col>
                                            <Col span={24}>
                                              <Text type="secondary" style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
                                                地址: <Text code style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, wordBreak: "break-all" }}>
                                                  {contract.address}
                                                </Text>
                                              </Text>
                                            </Col>
                                            <Col span={12}>
                                              <Text type="secondary" style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                                                Gas: <Text style={{ color: "rgba(255,255,255,0.75)" }}>
                                                  {contract.gasUsed?.toLocaleString() || 0}
                                                </Text>
                                              </Text>
                                            </Col>
                                            <Col span={12}>
                                              <Text type="secondary" style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                                                存储: <Text style={{ color: "rgba(255,255,255,0.75)" }}>
                                                  {(contract.storageUsed || 0).toLocaleString()} bytes
                                                </Text>
                                              </Text>
                                            </Col>
                                          </Row>
                                        </Card>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <Empty
                                    description="暂无合约数据"
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    style={{ padding: "20px 0" }}
                                  />
                                )}
                              </div>
                            </Col>
                          </Row>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Empty description="暂无Worker数据" />
                  )}
                </Spin>
              </DataCard>
            </div>

            {/* 终端输出区域 */}
            <Card style={{ marginBottom: '24px' }}>
              <Title level={4}>
                终端输出
                {isTerminalActive && <Badge status="processing" text="运行中" style={{ marginLeft: 8 }} />}
              </Title>
              <pre style={{
                background: '#000000',
                color: '#00ff00',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '13px',
                maxHeight: '400px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                border: '1px solid #333',
                lineHeight: '1.4'
              }}>
                {terminalOutput}
              </pre>
              <div style={{ marginTop: '8px' }}>
                <Button
                  type="link"
                  onClick={() => setTerminalOutput('等待操作...')}
                  size="small"
                >
                  清空终端
                </Button>
                <Button
                  type="link"
                  onClick={() => setTerminalOutput(prev => prev + '\n' + new Date().toLocaleTimeString() + ' - 手动刷新')}
                  size="small"
                >
                  添加时间戳
                </Button>
              </div>
            </Card>

            {/* 部署服务弹窗 */}
            <Modal
              title="部署服务"
              open={deployModalOpen}
              onCancel={() => {
                setDeployModalOpen(false);
                setScheduledInfo(null);
                deployForm.resetFields();
                setDeployFileList([]);
              }}
              footer={null}
              width={600}
              afterOpenChange={(open) => {
                if (open && scheduledInfo) {
                  deployForm.setFieldsValue({
                    scheduledVmIp: scheduledInfo.ip,
                    hostName: scheduledInfo.hostName,
                  });
                } else if (!open) {
                  deployForm.resetFields();
                  setScheduledInfo(null);
                  setDeployFileList([]);
                }
              }}
            >
              <Form
                form={deployForm}
                layout="vertical"
                preserve={false}
              >
                <Form.Item
                  label="部署路径"
                  name="name"
                  rules={[{ required: true, message: "请输入部署路径" }]}
                >
                  <Input placeholder="例如 /root/test" />
                </Form.Item>

                <Form.Item label="主机IP" name="scheduledVmIp" hidden>
                  <Input />
                </Form.Item>

                <Form.Item
                  label="worker名称"
                  name="hostName"
                  rules={[{ required: true, message: "请选择调度主机" }]}
                >
                  <Input disabled placeholder="调度成功后将显示主机名称" />
                </Form.Item>

                <Form.Item
                  label="部署文件"
                  name="file"
                  rules={[{ required: true, message: "请上传部署文件" }]}
                >
                  <Dragger
                    fileList={deployFileList}
                    beforeUpload={beforeUpload}
                    customRequest={customDeployRequest}
                    onChange={(info) => setDeployFileList(info.fileList)}
                    maxCount={1}
                    disabled={deployLoading}
                  >
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">
                      点击或拖拽 docker-compose.yaml 文件到此处
                    </p>
                    <p className="ant-upload-hint">
                      仅支持 .yaml / .yml 文件，大小 ≤ 10MB
                    </p>
                  </Dragger>
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                  <Space>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={downloadSampleDeployFile}
                    >
                      下载示例文件
                    </Button>
                    <Button onClick={() => {
                      setDeployModalOpen(false);
                      deployForm.resetFields();
                      setDeployFileList([]);
                    }}>
                      取消
                    </Button>
                    <Button
                      type="primary"
                      loading={deployLoading}
                      disabled={deployFileList.length === 0}
                      onClick={() => {
                        const file = deployFileList[0].originFileObj;
                        if (file) customDeployRequest({ file });
                      }}
                    >
                      部署
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Modal>

            {/* 上传合约弹窗 */}
            <Modal
              title="上传隐私智能合约"
              open={uploadModalVisible}
              onCancel={() => {
                setUploadModalVisible(false);
                uploadForm.resetFields();
              }}
              footer={null}
              width={600}
            >
              <Form
                form={uploadForm}
                layout="vertical"
                onFinish={handleUploadContract}
              >
                <Form.Item
                  label="合约描述"
                  name="description"
                >
                  <Input.TextArea
                    placeholder="请输入合约描述（可选）"
                    rows={3}
                  />
                </Form.Item>

                <Form.Item
                  label="合约文件"
                  name="contractFile"
                  rules={[{ required: true, message: '请上传合约文件' }]}
                  valuePropName="fileList"
                  getValueFromEvent={(e) => {
                    if (Array.isArray(e)) {
                      return e;
                    }
                    return e && e.fileList;
                  }}
                >
                  <Upload.Dragger
                    name="contractFile"
                    multiple={false}
                    accept=".sol,.wasm,.contract"
                    beforeUpload={() => false}
                    listType="text"
                  >
                    <p className="ant-upload-drag-icon">
                      <UploadOutlined />
                    </p>
                    <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                    <p className="ant-upload-hint">
                      支持 .sol, .wasm, .contract 格式文件
                    </p>
                  </Upload.Dragger>
                </Form.Item>

                <Alert
                  message="上传说明"
                  description="请确保您的合约文件符合隐私保护要求，系统将自动进行安全验证和隐私等级评估。"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Form.Item>
                  <Space wrap>
                    <Button type="primary" htmlType="submit" loading={uploading}>
                      上传合约
                    </Button>
                    <Button
                      icon={<FileTextOutlined />}
                      onClick={downloadSampleContract}
                    >
                      下载示例合约
                    </Button>
                    <Button
                      icon={<SafetyCertificateOutlined />}
                      onClick={deploySystemContract}
                      loading={uploading}
                      style={{ background: '#1890ff', borderColor: '#1890ff' }}
                    >
                      部署系统合约
                    </Button>
                    <Button onClick={() => {
                      setUploadModalVisible(false);
                      uploadForm.resetFields();
                    }}>
                      取消
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Modal>

            {/* 调度弹窗 */}
            {/* <Modal
              title="服务调度"
              open={dispatchModalOpen}
              onCancel={() => setDispatchModalOpen(false)}
              footer={null}
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={handleDispatch}
                preserve={false}
              >
                <Form.Item
                  label="服务名称"
                  name="name"
                  rules={[{ required: true, message: "请输入服务名称" }]}
                  initialValue="my-host"
                >
                  <Input disabled/>
                </Form.Item>

                <Form.Item
                  label="主机名称"
                  name="host"
                  rules={[{ required: true, message: "请选择主机" }]}
                >
                  <Select
                    showSearch
                    placeholder="请选择调度本服务的主机"
                    optionFilterProp="label"
                    onChange={onChange}
                    onSearch={onSearch}
                    options={hosts.map(host => ({
                      value: host.key,
                      label: host.name,
                    }))}
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                  <Space>
                    <Button onClick={() => setDispatchModalOpen(false)}>按续调度</Button>
                    <Button type="primary" htmlType="submit">
                      选择调度
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Modal> */}

            {/* 查询服务弹窗 */}
            <Modal
              title={`服务信息 - ${currentVmIp || ""}`}
              open={searchModalOpen}
              onCancel={() => {
                setSearchModalOpen(false);
                setCurrentVmIp("");
                setVmServices([]);
              }}
              footer={null}
            >
              <Spin spinning={loadingServices}>
                <Table
                  rowKey="key"
                  columns={vmServicesColumns}
                  dataSource={vmServices}
                  pagination={{
                    pageSize: 50,
                    showSizeChanger: false,
                  }}
                  size="small"
                />
              </Spin>
            </Modal>

            {/* 资源监控弹窗 */}
            <Modal
              title={`资源信息 - ${selectedHost?.address || ""}`}
              open={resourceModalOpen}
              onCancel={() => {
                setResourceModalOpen(false);
                setSelectedHost(null);
                setMonitorData(null);
              }}
              footer={null}
            >
              <Spin spinning={loadingMonitor}>
                {monitorData ? (
                  <Flex gap="middle" vertical>
                    <Flex vertical gap="small">
                      <div>CPU 使用率: {monitorData.cpuUsage}</div>
                      <Progress
                        percent={parseCpuUsage(monitorData.cpuUsage)}
                        status="active"
                        strokeColor={{ from: "#10e992ff", to: "#600aa6ff" }}
                      />
                    </Flex>
                    <Flex vertical gap="small">
                      <div>内存使用情况: {monitorData.memory}</div>
                      <Progress
                        percent={parseMemoryUsage(monitorData.memory)}
                        status="active"
                        strokeColor={{ from: "#86b2ffff", to: "#600aa6ff" }}
                      />
                    </Flex>
                  </Flex>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: "200px",
                    }}
                  >
                    正在加载监控数据
                  </div>
                )}
              </Spin>
            </Modal>

            <Divider style={{ margin: "32px 0" }} />

            <ConfigProvider
              theme={{
                algorithm: antTheme.darkAlgorithm,
                token: {
                  colorBgContainer: "#111325",
                  colorText: "rgba(255,255,255,0.85)",
                  colorTextHeading: "#ffffff",
                },
              }}
            >
              <div
                style={{
                  padding: 24,
                  background: "#090b18",
                  borderRadius: 24,
                  border: "1px solid #1c1f3b",
                }}
              >
                <Space direction="vertical" size={24} style={{ width: "100%" }}>
                  <Card
                    title={
                      <Space>
                        <ThunderboltOutlined />
                        <span>Worker 推荐与全局视图</span>
                      </Space>
                    }
                    extra={
                      <Space>
                        <Button icon={<ReloadOutlined />} onClick={loadSgxAll} loading={sgxLoading} size="small">
                          刷新
                        </Button>
                        <Select
                          size="small"
                          value={sgxAutoRefresh ? "auto" : "manual"}
                          style={{ width: 140 }}
                          onChange={(val) => setSgxAutoRefresh(val === "auto")}
                          options={[
                            { label: "自动刷新", value: "auto" },
                            { label: "手动刷新", value: "manual" },
                          ]}
                        />
                      </Space>
                    }
                    style={{
                      background: "#111325",
                      borderColor: "#1f2a44",
                      color: "#fff",
                    }}
                    headStyle={{ borderColor: "#1f2a44", color: "#fff" }}
                    bodyStyle={{ color: "#fff" }}
                  >
                    {recommendedWorker ? (
                      <>
                        <Row gutter={[16, 16]}>
                          <Col xs={24} lg={16}>
                            <Card
                              bordered={false}
                              style={{
                                background: "#1a1d3a",
                                color: "#fff",
                                height: "100%",
                              }}
                            >
                              <Space direction="vertical" size="small">
                                <Text type="secondary" style={{ color: "rgba(255,255,255,0.65)" }}>
                                  推荐 Worker
                                </Text>
                                <Text code style={{ color: "#fff" }}>
                                  {recommendedWorker.pubkey}
                                </Text>
                                <Text style={{ color: "rgba(255,255,255,0.75)" }}>
                                  Endpoint：{recommendedWorker.endpoint || "链上注册"}
                                </Text>
                                <Divider
                                  style={{ margin: "12px 0", borderColor: "rgba(255,255,255,0.08)" }}
                                />
                                <Row gutter={12}>
                                  <Col span={12}>
                                    <Statistic
                                      title="得分"
                                      value={
                                        typeof recommendedWorker.score === "number"
                                          ? recommendedWorker.score.toFixed(1)
                                          : "--"
                                      }
                                      valueStyle={{ color: "#52c41a" }}
                                    />
                                  </Col>
                                  <Col span={12}>
                                    <Statistic
                                      title="延迟 (ms)"
                                      value={
                                        typeof recommendedWorker.latencyMs === "number"
                                          ? recommendedWorker.latencyMs.toFixed(0)
                                          : "--"
                                      }
                                    />
                                  </Col>
                                </Row>
                              </Space>
                            </Card>
                          </Col>
                          <Col xs={24} lg={8}>
                            <Alert
                              type="info"
                              showIcon
                              message="调度建议"
                              description="推荐算法综合考量响应状态、链上注册、Gatekeeper 角色与实时延迟。也可以在下表手动挑选合适的 worker。"
                              style={{ height: "100%" }}
                            />
                          </Col>
                        </Row>
                        <Divider />
                        <Table
                          size="small"
                          dataSource={workerDataSource}
                          columns={workerColumns}
                          loading={workerLoading}
                          pagination={false}
                          scroll={{ x: true }}
                        />
                      </>
                    ) : (
                      <Empty description="暂无 worker 数据" />
                    )}
                  </Card>

                  <Card
                    title={
                      <Space>
                        <ApiOutlined />
                        <span>phat_hello 合约查询</span>
                      </Space>
                    }
                    style={{
                      background: "#111325",
                      borderColor: "#1f2a44",
                      color: "#fff",
                    }}
                    headStyle={{ borderColor: "#1f2a44", color: "#fff" }}
                    bodyStyle={{ color: "#fff" }}
                  >
                    <Row gutter={[16, 16]}>
                      <Col span={24}>
                        <Space direction="vertical" size="small" style={{ width: "100%" }}>
                          <Text strong>合约地址</Text>
                          <Input
                            placeholder="输入合约地址（0x开头的64位十六进制）"
                            value={addContractAddress}
                            onChange={(e) => setAddContractAddress(e.target.value)}
                            allowClear
                            style={{ width: "100%" }}
                          />
                          <Text type="secondary" style={{ fontSize: "12px" }}>
                            提示：可以从隐私合约页面选择已部署的 phat_hello 合约地址
                          </Text>
                        </Space>
                      </Col>
                      <Col span={24}>
                        <Space direction="vertical" size="small" style={{ width: "100%" }}>
                          <Text strong>已自动选择推荐 Worker</Text>
                          <Select
                            placeholder="选择 worker（留空则使用默认worker）"
                            options={workerSelectOptions}
                            value={addWorkerEndpoint}
                            onChange={(value) => setAddWorkerEndpoint(value)}
                            allowClear
                            style={{ width: "100%" }}
                          />
                        </Space>
                      </Col>
                      <Col span={12}>
                        <Space direction="vertical" size="small" style={{ width: "100%" }}>
                          <Text strong>参数 A</Text>
                          <InputNumber
                            min={0}
                            max={1_000_000}
                            value={addInputs.a}
                            onChange={(value) =>
                              setAddInputs((prev) => ({ ...prev, a: typeof value === "number" ? value : prev.a }))
                            }
                            style={{ width: "100%" }}
                          />
                        </Space>
                      </Col>
                      <Col span={12}>
                        <Space direction="vertical" size="small" style={{ width: "100%" }}>
                          <Text strong>参数 B</Text>
                          <InputNumber
                            min={0}
                            max={1_000_000}
                            value={addInputs.b}
                            onChange={(value) =>
                              setAddInputs((prev) => ({ ...prev, b: typeof value === "number" ? value : prev.b }))
                            }
                            style={{ width: "100%" }}
                          />
                        </Space>
                      </Col>
                      <Col span={24}>
                        <Button type="primary" block onClick={runAddQuery} loading={addLoading}>
                          查询 add(a, b)
                        </Button>
                      </Col>
                    </Row>
                    {addResult && (
                      <Alert
                        style={{ marginTop: 16 }}
                        type={addResult.success !== false ? "success" : "error"}
                        showIcon
                        message={addResult.success !== false ? "查询结果" : "查询失败"}
                        description={
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                            {JSON.stringify(addResult, null, 2)}
                          </pre>
                        }
                      />
                    )}
                  </Card>

                  <Collapse
                    activeKey={sfqExpanded ? ["sfq"] : []}
                    onChange={(keys) => setSfqExpanded(keys.includes("sfq"))}
                    style={{
                      background: "#111325",
                      borderColor: "#1f2a44",
                    }}
                    ghost
                    items={[
                      {
                        key: "sfq",
                        label: (
                          <Space>
                            <PlayCircleOutlined />
                            <span>SFQ 请求调度与服务器控制</span>
                            <Tag color={sfqStatus?.available ? "green" : "red"} style={{ marginLeft: 8 }}>
                              {sfqStatus?.available ? "运行中" : "未运行"}
                            </Tag>
                          </Space>
                        ),
                        extra: (
                          <Space>
                            <Button
                              icon={<ReloadOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                loadSFQStatus();
                              }}
                              loading={sfqLoading}
                              size="small"
                            >
                              刷新状态
                            </Button>
                            <Button
                              type="text"
                              icon={sfqExpanded ? <UpOutlined /> : <DownOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSfqExpanded(!sfqExpanded);
                              }}
                              size="small"
                            >
                              {sfqExpanded ? "收起" : "更多"}
                            </Button>
                          </Space>
                        ),
                        children: (
                          <div style={{ color: "#fff" }}>
                            <Alert
                              type="info"
                              showIcon
                              message="SFQ 调度服务器"
                              description={
                                <div>
                                  <div style={{ marginBottom: 8 }}>
                                    请使用脚本管理服务器：<code>./scripts/sfq-server.sh [start|stop|status|restart]</code>
                                  </div>
                                </div>
                              }
                            />
                            <Space direction="vertical" size={4} style={{ marginBottom: 16 }}>
                              <Text>
                                SFQ 调度器就像银行的多个服务窗口，根据每个客户（任务流）的优先级（权重）公平分配服务时间。
                              </Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                💡 <strong>通俗理解：</strong>多个任务同时到达，调度器按权重比例分配处理资源。高权重的任务获得更多处理时间，就像VIP客户有优先服务通道。
                              </Text>
                            </Space>

                            {sfqSummaryStats.length > 0 && (
                              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                                {sfqSummaryStats.map((stat) => (
                                  <Col xs={12} md={6} key={stat.title}>
                                    <Card size="small">
                                      <Statistic
                                        title={stat.title}
                                        value={stat.value ?? "--"}
                                        suffix={stat.suffix}
                                        valueStyle={{ color: stat.title.includes("成功率") ? "#52c41a" : undefined }}
                                      />
                                    </Card>
                                  </Col>
                                ))}
                              </Row>
                            )}

                            {flowChartData.length > 0 ? (
                              <>
                                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                                  <Col xs={24} lg={12}>
                                    <Card size="small" title="各流处理进度（已完成/总数）" bordered={false}>
                                      <Space direction="vertical" style={{ width: "100%" }} size="middle">
                                        {flowChartData.map((flow: any, idx: number) => {
                                          const total = (flow.accepted || 0) + (flow.rejected || 0);
                                          const progress = total > 0 ? ((flow.accepted || 0) / total) * 100 : 0;
                                          return (
                                            <div key={idx}>
                                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                <Text strong style={{ fontSize: 13 }}>
                                                  {flow.flow?.replace("_", " ").toUpperCase() || `流 ${idx + 1}`}
                                                  {flow.weight && (
                                                    <Tag color="blue" style={{ marginLeft: 8 }}>
                                                      权重 {flow.weight}x
                                                    </Tag>
                                                  )}
                                                </Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                  {flow.accepted || 0}/{total} 成功
                                                </Text>
                                              </div>
                                              <Progress
                                                percent={Math.round(progress)}
                                                status={progress === 100 ? "success" : "active"}
                                                strokeColor={{
                                                  from: "#52c41a",
                                                  to: "#13c2c2",
                                                }}
                                                trailColor="#434343"
                                                showInfo={false}
                                              />
                                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                  {flow.rejected || 0} 个被拒绝
                                                </Text>
                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                  {flow.backlog || 0} 个等待中
                                                </Text>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </Space>
                                    </Card>
                                  </Col>
                                  <Col xs={24} lg={12}>
                                    <Card size="small" title="资源分配比例（饼图）" bordered={false}>
                                      <div style={{ height: 260 }}>
                                        <ColumnChart
                                          data={flowChartData.map((flow: any) => ({
                                            flow: flow.flow,
                                            label: `${flow.flow?.replace("_", " ").toUpperCase() || "Unknown"} (${flow.weight || 1}x)`,
                                            accepted: flow.accepted || 0,
                                            weight: flow.weight || 1,
                                          }))}
                                          xField="label"
                                          yField="accepted"
                                          meta={{
                                            accepted: { alias: "已处理数" },
                                          }}
                                          color={["#9254de", "#13c2c2", "#52c41a", "#faad14", "#f5222d"]}
                                          autoFit
                                          height={240}
                                        />
                                        <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 12 }}>
                                          💡 柱状图高度表示各流已处理的请求数。高权重流应该处理更多请求。
                                        </Text>
                                      </div>
                                    </Card>
                                  </Col>
                                </Row>
                                {flowPerformanceData.length > 0 && (
                                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                                    <Col span={24}>
                                      <Card size="small" title="各流处理结果" bordered={false}>
                                        <div style={{ height: 300 }}>
                                          <ColumnChart
                                            data={flowPerformanceData}
                                            xField="label"
                                            yField="value"
                                            seriesField="category"
                                            isGroup
                                            color={["#52c41a", "#f5222d"]}
                                            autoFit
                                            height={280}
                                            legend={{ position: "top" }}
                                          />
                                        </div>
                                      </Card>
                                    </Col>
                                  </Row>
                                )}
                              </>
                            ) : (
                              <Empty description="等待 SFQ 服务器返回流量数据" style={{ marginBottom: 16 }} />
                            )}

                            {sfqFlowTableData.length > 0 && (
                              <Card
                                size="small"
                                title="实时流量详情"
                                bordered={false}
                                style={{ marginBottom: 16, marginTop: 8 }}
                              >
                                <Table
                                  size="small"
                                  dataSource={sfqFlowTableData}
                                  columns={sfqFlowColumns}
                                  pagination={false}
                                  scroll={{ x: true }}
                                />
                              </Card>
                            )}

                            <Divider />

                            <Space direction="vertical" size="middle" style={{ width: "100%", marginBottom: 16 }}>
                              <Text strong>请求调度场景</Text>
                              <Row gutter={[16, 16]}>
                                {SCENARIOS.map((scenario) => {
                                  const ScenarioIcon = scenario.icon;
                                  const isRunning = scenarioRunning === scenario.id;
                                  return (
                                    <Col xs={24} md={12} lg={8} key={scenario.id}>
                                      <Card
                                        size="small"
                                        style={{
                                          height: "100%",
                                          borderColor: isRunning ? scenario.accent : undefined,
                                        }}
                                      >
                                        <Space align="start" size="middle" style={{ marginBottom: 12 }}>
                                          <div
                                            style={{
                                              width: 40,
                                              height: 40,
                                              borderRadius: 12,
                                              background: `${scenario.accent}22`,
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              color: scenario.accent,
                                            }}
                                          >
                                            <ScenarioIcon />
                                          </div>
                                          <Space direction="vertical" size={4} style={{ flex: 1 }}>
                                            <Space size="small">
                                              <Text strong>{scenario.title}</Text>
                                              <Tag color={scenario.accent}>{scenario.tag}</Tag>
                                            </Space>
                                            <Text type="secondary">{scenario.description}</Text>
                                          </Space>
                                        </Space>
                                        <Button
                                          block
                                          size="large"
                                          type={isRunning ? "primary" : "default"}
                                          loading={isRunning}
                                          onClick={() => runScenario(scenario.id)}
                                        >
                                          运行场景
                                        </Button>
                                      </Card>
                                    </Col>
                                  );
                                })}
                              </Row>
                            </Space>

                            {scenarioResult ? (
                              <Space direction="vertical" style={{ width: "100%" }} size="large">
                                <Space direction="vertical" size="small">
                                  <Text strong>{scenarioResult.scenarioName}</Text>
                                  <Text type="secondary">{scenarioResult.description}</Text>
                                </Space>
                                <Row gutter={[16, 16]}>
                                  {scenarioStats.map((stat) => (
                                    <Col xs={12} md={6} key={stat.title}>
                                      <Card size="small">
                                        <Statistic title={stat.title} value={stat.value ?? "--"} />
                                      </Card>
                                    </Col>
                                  ))}
                                </Row>
                                {scenarioFlowData.length > 0 && (
                                  <>
                                    <Table
                                      size="small"
                                      dataSource={scenarioFlowData}
                                      columns={scenarioFlowColumns}
                                      pagination={false}
                                    />
                                    {scenarioResult?.scenarioId === "weight-distribution" && (
                                      <Card
                                        size="small"
                                        title="权重效果可视化对比"
                                        style={{ marginTop: 16 }}
                                      >
                                        <Row gutter={[16, 16]}>
                                          <Col xs={24} lg={12}>
                                            <Card size="small" title="资源分配对比（接受数）" bordered={false}>
                                              <div style={{ height: 300 }}>
                                                <ColumnChart
                                                  data={scenarioFlowData.flatMap((flow: any) => [
                                                    {
                                                      flow: flow.flowId,
                                                      label: `${flow.flowId} (权重: ${flow.weight}x)`,
                                                      type: "实际接受数",
                                                      value: flow.accepted || 0,
                                                    },
                                                    {
                                                      flow: flow.flowId,
                                                      label: `${flow.flowId} (权重: ${flow.weight}x)`,
                                                      type: "期望接受数",
                                                      value: flow.expectedAccepted || 0,
                                                    },
                                                  ])}
                                                  xField="label"
                                                  yField="value"
                                                  seriesField="type"
                                                  isGroup
                                                  color={["#52c41a", "#1890ff"]}
                                                  legend={{ position: "top" }}
                                                  autoFit
                                                  height={260}
                                                />
                                              </div>
                                              <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
                                                期望接受数 = (该流权重 / 总权重) × 总接受数。实际接受数与期望值越接近，说明权重调度越公平。
                                              </Text>
                                            </Card>
                                          </Col>
                                        </Row>
                                      </Card>
                                    )}
                                  </>
                                )}
                              </Space>
                            ) : (
                              <Empty description="运行任意场景即可查看结果" />
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </Space>
              </div>
            </ConfigProvider>
          </div>
        </ConfigProvider>
      </MainLayout>
    </AuthGuard>

  );
}
