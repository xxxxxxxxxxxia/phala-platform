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
} from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
const { Title, Text } = Typography;
import dynamic from "next/dynamic";
import axios from "axios";

import MainLayout from "@/components/layout/MainLayout";
import DataCard from "@/components/DataCard";
import AuthGuard from '@/components/AuthGuard';

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
  const [sgxAutoRefresh, setSgxAutoRefresh] = useState(true);
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

  const {
    token: { colorBgContainer, colorText },
  } = antTheme.useToken();

  // 在组件加载时自动获取所有VM服务信息
  useEffect(() => {
    fetchAllVmServices();
  }, []);

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
      const res = await fetch("/api/scheduling/workers");
      const data = await res.json();
      if (data.success) {
        setWorkerInsights(data.data);
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
    // 将刷新间隔从8秒增加到30秒，减少服务器访问频率
    const timer = setInterval(() => {
      loadWorkerInsights();
      loadSFQStatus();
    }, 60000); // 30秒刷新一次
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
      setLoading(true);
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
      setLoading(false);
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

  /* 自定义上传逻辑 */
  const customRequest = async (options: any) => {
    const { file } = options;
    setLoading(true);
    setResult(null);
    const formData = new FormData();
    formData.append("composeFile", file);

    // 获取表单中的部署路径和调度的主机IP
    const values = form.getFieldsValue();
    const vmPath = values.name; // 部署路径
    const vmIp = scheduledInfo?.ip; // 主机IP

    // 添加主机IP和路径到formData
    if (vmIp) {
      formData.append("vmIp", vmIp);
    }

    if (vmPath) {
      formData.append("vmPath", vmPath);
    }

    try {
      const { data } = await axios.post<DeployResponse>(
        `${API_BASE_URL}/deploy`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setResult(data);
      console.log(data);

      message.success(data.message || "部署完成");
      setDeployModalOpen(false);
      fetchAllVmServices();
    } catch (err: any) {
      const resp = err.response?.data as DeployResponse;
      setResult(resp || { message: "网络异常，请稍后重试" });
      message.error(resp?.message || "部署失败");
    } finally {
      setLoading(false);
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
            {/* <Divider /> */}
            <DataCard title="服务列表">
              {/* 显示关闭服务后的警告横幅 */}
              {stopServiceAlert.visible && (
                <Alert
                  message={stopServiceAlert.message}
                  banner
                  type="warning"
                  closable
                  onClose={() =>
                    setStopServiceAlert({ visible: false, message: "" })
                  }
                  style={{ marginBottom: 16 }}
                />
              )}
              {/* 顶部操作区 */}
              <Space style={{ marginBottom: 16 }} wrap>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleDeployButtonClick}
                  loading={loading}
                >
                  部署服务
                </Button>
                <Button
                  type="primary"
                  onClick={fetchAllVmServices}
                  loading={loadingAllServices}
                  icon={<UnorderedListOutlined />}
                >
                  查看服务
                </Button>
              </Space>

              {/* 所有服务信息展示区域 */}
              <Spin
                tip="正在查询服务列表..."
                size="large"
                spinning={loadingAllServices}
              >
                {allVmServices.length > 0 ? (
                  <Table
                    rowKey={(record, index) => `vm-${index}`}
                    columns={allVmServicesColumns}
                    dataSource={(() => {
                      const flattenedData: any[] = [];
                      allVmServices.forEach((vm) => {
                        if (
                          vm.success &&
                          vm.services?.docker &&
                          Array.isArray(vm.services.docker) &&
                          vm.services.docker.length > 0
                        ) {
                          vm.services.docker.forEach((service) => {
                            // 只添加状态包含"Up"的服务
                            if (service.status && service.status.includes("Up")) {
                              flattenedData.push({
                                ...service,
                                vmIp: vm.vmIp,
                                vmStatus: vm.success,
                              });
                            }
                          });
                        } else {
                          // 添加一个表示无服务的条目
                          flattenedData.push({
                            vmIp: vm.vmIp,
                            vmStatus: vm.success,
                            error: vm.error,
                            isEmpty: true,
                          });
                        }
                      });
                      return flattenedData;
                    })()}
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "40px 0",
                      color: "rgba(255, 255, 255, 0.3)",
                    }}
                  >
                    {/* 点击"查看所有服务"按钮获取服务信息 */}
                  </div>
                )}
              </Spin>
            </DataCard>

            <p></p>

            <DataCard title="设备列表">
              {/* 设备信息表格 */}
              <Table
                rowKey="key"
                columns={hostColumns}
                dataSource={hostDataSource}
                pagination={{
                  pageSize: 50,
                  showSizeChanger: false,
                  showTotal: (t) => `设备总数: ${t}台`,
                }}
                size="small"
              />
            </DataCard>

            {/* 部署弹窗 */}
            <Modal
              title="部署信息"
              open={deployModalOpen}
              onCancel={() => {
                setDeployModalOpen(false);
                setScheduledInfo(null);
              }}
              footer={null}
              afterOpenChange={(open) => {
                if (open && scheduledInfo) {
                  // 模态框打开后设置表单字段值
                  form.setFieldsValue({
                    scheduledVmIp: scheduledInfo.ip,
                    hostName: scheduledInfo.hostName,
                  });
                } else if (!open) {
                  // 模态框关闭时重置表单和调度信息
                  form.resetFields();
                  setScheduledInfo(null);
                }
              }}
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={handleDeploy}
                preserve={false}
              >
                <Form.Item
                  label="部署路径"
                  name="name"
                  rules={[{ required: true, message: "请输入部署路径" }]}
                // initialValue=""
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
                  {/* <Input readOnly placeholder="调度成功后将显示主机名称" /> */}
                  <Input disabled placeholder="调度成功后将显示主机名称" />
                </Form.Item>

                <Form.Item
                  label="部署文件"
                  name="file"
                  rules={[{ required: true, message: "请上传部署文件" }]}
                >
                  <Dragger
                    fileList={fileList}
                    beforeUpload={beforeUpload}
                    customRequest={customRequest}
                    onChange={(info) => setFileList(info.fileList)}
                    maxCount={1}
                    disabled={loading}
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
                    <Button onClick={() => setDeployModalOpen(false)}>
                      取消
                    </Button>
                    <Button
                      type="primary"
                      loading={loading}
                      disabled={fileList.length === 0}
                      onClick={() => {
                        const file = fileList[0].originFileObj;
                        if (file) customRequest({ file });
                      }}
                      block
                    >
                      部署
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
                    variant="outlined"
                    style={{
                      borderRadius: 18,
                      background: "linear-gradient(125deg,#141e30,#243b55)",
                      color: "#fff",
                    }}
                    styles={{ body: { padding: 32 } }}
                  >
                    <Row justify="space-between" align="middle" gutter={[16, 16]}>
                      <Col xs={24} lg={16}>
                        <Space direction="vertical" size="small">
                          <Title level={3} style={{ color: "#fff", margin: 0 }}>
                            安全调度控制台（SGX）
                          </Title>
                          <Text style={{ color: "rgba(255,255,255,0.75)" }}>
                            查看 worker 健康度、运行 SFQ 调度场景，以及直接调用 phat_hello。
                          </Text>
                        </Space>
                      </Col>
                      <Col>
                        <Space>
                          <Button icon={<ReloadOutlined />} onClick={loadSgxAll} loading={sgxLoading}>
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
                      </Col>
                    </Row>
                  </Card>

                  <Card
                    title={
                      <Space>
                        <ThunderboltOutlined />
                        <span>Worker 推荐与全局视图</span>
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

                  <Card
                    title={
                      <Space>
                        <PlayCircleOutlined />
                        <span>SFQ 请求调度与服务器控制</span>
                      </Space>
                    }
                    extra={
                      <Space>
                        <Tag color={sfqStatus?.available ? "green" : "red"}>
                          {sfqStatus?.available ? "运行中" : "未运行"}
                        </Tag>
                        <Button icon={<ReloadOutlined />} onClick={loadSFQStatus} loading={sfqLoading}>
                          刷新状态
                        </Button>
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
                  </Card>
                </Space>
              </div>
            </ConfigProvider>
          </div>
        </ConfigProvider>
      </MainLayout>
    </AuthGuard>

  );
}
