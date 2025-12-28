"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  Col,
  Row,
  Typography,
  Tag,
  Input,
  Space,
  Dropdown,
  message,
  Modal,
  App,
  Form,
  Select,
  InputNumber,
  Checkbox,
  Upload,
} from "antd";
import { x25519 } from "@noble/curves/ed25519.js";
import {
  ReloadOutlined,
  FilterOutlined,
  SearchOutlined,
  CopyOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PauseOutlined,
  GlobalOutlined,
  SafetyOutlined,
  CloudServerOutlined,
  ArrowLeftOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  DeleteOutlined,
  StopOutlined,
  UploadOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PortalLayout from "@/components/layout/PortalLayout";
import DeveloperAuthGuard from "@/components/DeveloperAuthGuard";
import styles from "../../portal.module.css";

const { Title, Text, Paragraph } = Typography;

const heroHighlights = [
  {
    label: "TEE类型",
    value: "国产 Hygon CSV",
  },
  {
    label: "调度延迟",
    value: "< 3s 动态调度响应",
  },
  {
    label: "部署方式",
    value: "一键部署 · 自动配置",
  },
];

const introChecklist = [
  "一键导入 Docker Compose，自动生成 App ID 与哈希校验",
  "支持 KMS 密钥提供者，保护敏感环境变量",
  "支持查看日志信息",
];

interface CVMData {
  id: string;
  name: string;
  identifier: string;
  uuid: string;
  status: "STOPPED" | "RUNNING";
  region: string;
  size: string;
  type: "classic";
}

export interface VMData {
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

interface ImageData {
  name: string;
  version?: string;
}

interface GpuData {
  slot: string;
  description?: string;
  product_id?: string;
  is_free?: boolean;
}

interface PortMapping {
  protocol: "tcp" | "udp";
  host_address: string;
  host_port: number | null;
  vm_port: number | null;
}

interface EncryptedEnv {
  key: string;
  value: string;
}

interface VMFormData {
  name: string;
  image: string;
  dockerComposeFile: string;
  preLaunchScript: string;
  vcpu: number;
  memory: number;
  memoryValue: number;
  memoryUnit: "MB" | "GB";
  disk_size: number;
  selectedGpus: string[];
  attachAllGpus: boolean;
  ports: PortMapping[];
  encryptedEnvs: EncryptedEnv[];
  docker_config: {
    enabled: boolean;
    username: string;
    token_key: string;
  };
  app_id: string;
  kms_enabled: boolean;
  local_key_provider_enabled: boolean;
  key_provider_id: string;
  gateway_enabled: boolean;
  public_logs: boolean;
  public_sysinfo: boolean;
  public_tcbinfo: boolean;
  pin_numa: boolean;
  hugepages: boolean;
  user_config: string;
}

const mockCVMData: CVMData[] = [
  {
    id: "1",
    name: "newdstackteev102",
    identifier: "382f2dd3eae1504c7733640fc5a3ee43538a19f1",
    uuid: "4f3ceae2-f9be-451b-84df-915eab6d3284",
    status: "STOPPED",
    region: "prod8-v03x",
    size: "tdx.small",
    type: "classic",
  },
  {
    id: "2",
    name: "newdstackteev102",
    identifier: "3eaff6ff06f6c4294a835d3f34d3b59f4e99796b",
    uuid: "77e92068-9a42-47ce-8e7a-5f95e20eee99",
    status: "STOPPED",
    region: "prod5",
    size: "tdx.small",
    type: "classic",
  },
  {
    id: "3",
    name: "testbridge106",
    identifier: "4cb6751f32d5f8ac972693658407881dd544e279",
    uuid: "ba3c63e4-3114-445a-a426-94d091800f4c",
    status: "STOPPED",
    region: "prod5",
    size: "tdx.small",
    type: "classic",
  },
];

// 默认主机 IP
export const DEFAULT_BEST_HOST_IP = "localhost";

// RPC 调用函数 - 通过代理API避免CORS问题
export const rpcCall = async (
  bestHostIp: string,
  method: string,
  params?: any
): Promise<Response> => {
  // 使用 Next.js API 路由作为代理，避免 CORS 问题
  // 从 localStorage 读取端口，如果没有则使用默认值 9210
  const port = typeof window !== "undefined" 
    ? (localStorage.getItem("bestHostPort") || "9210")
    : "9210";
  const proxyUrl = `/api/vm-rpc?host=${encodeURIComponent(
    bestHostIp
  )}&method=${encodeURIComponent(method)}&port=${encodeURIComponent(port)}`;
  console.log("通过代理调用 RPC:", proxyUrl);

  const response = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params || {}),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response;
};

// 获取 VM 列表
type VMListItem = VMData & { displayName?: string };

const loadVMList = async (
  bestHostIp: string,
  options?: {
    brief?: boolean;
    keyword?: string;
    page?: number;
    page_size?: number;
    ids?: string[];
  }
): Promise<VMListResponse> => {
  const response = await rpcCall(bestHostIp, "Status", {
    brief: options?.brief ?? true,
    keyword: options?.keyword || "",
    page: options?.page || 1,
    page_size: options?.page_size || 50,
    ...(options?.ids && { ids: options.ids }),
  });

  return await response.json();
};

const getComposeDisplayName = (vm: VMData): string | undefined => {
  const composeSource = vm.configuration?.compose_file;
  if (!composeSource) return undefined;
  try {
    if (typeof composeSource === "string") {
      const parsed = JSON.parse(composeSource);
      return parsed?.name;
    }
    if (typeof composeSource === "object") {
      return (composeSource as any)?.name;
    }
  } catch (error) {
    console.error("Failed to parse compose_file for VM:", vm.id, error);
  }
  return undefined;
};

const getVmDisplayName = (vm: VMListItem) =>
  vm.displayName?.trim() || vm.name || "虚拟机";

function StartPageContent() {
  const router = useRouter();
  const { modal } = App.useApp();
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState("");
  const [cvms] = useState<CVMData[]>(mockCVMData);
  const [bestHostIp, setBestHostIp] = useState<string | null>(null);
  const [vms, setVms] = useState<VMListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalVMs, setTotalVMs] = useState(0);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [availableImages, setAvailableImages] = useState<ImageData[]>([]);
  const [availableGpus, setAvailableGpus] = useState<GpuData[]>([]);
  const [allowAttachAllGpus, setAllowAttachAllGpus] = useState(false);
  const [portMappingEnabled, setPortMappingEnabled] = useState(false);
  const [composeHashPreview, setComposeHashPreview] = useState("");
  const [deployLoading, setDeployLoading] = useState(false);

  useEffect(() => {
    // 从 localStorage 读取 bestHostIp
    const storedBestHostIp = localStorage.getItem("bestHostIp");
    if (storedBestHostIp) {
      setBestHostIp(storedBestHostIp);
    }
  }, []);

  const fetchVMList = useCallback(
    async (showLoading: boolean = true) => {
      if (!bestHostIp) return;

      if (showLoading) {
        setLoading(true);
      }
      try {
        const data = await loadVMList(bestHostIp, {
          brief: false,
          keyword: searchText,
          page: 1,
          page_size: 50,
        });
        console.log("VM List Data:", data);
        const enrichedVms =
          data.vms?.map((vm) => ({
            ...vm,
            displayName: getComposeDisplayName(vm) || vm.name,
          })) || [];
        setVms(enrichedVms);
        setTotalVMs(data.total || data.vms?.length || 0);
        setPortMappingEnabled(data.port_mapping_enabled || false);
      } catch (error) {
        console.error("Error loading VM list:", error);
        // message.error("获取 VM 列表失败");
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [bestHostIp, searchText]
  );

  // 当 bestHostIp 或 searchText 变化时，加载 VM 列表
  useEffect(() => {
    if (bestHostIp) {
      fetchVMList();
    }
  }, [bestHostIp, fetchVMList]);

  // 自动刷新 VM 列表（每 5 分钟），实现 uptime 的实时更新
  // 自动刷新时不显示加载状态，避免页面闪烁
  useEffect(() => {
    if (!bestHostIp) return;

    const intervalId = setInterval(() => {
      fetchVMList(false); // 不显示加载状态
    }, 300000); // 每 5 分钟刷新一次

    // 清理定时器
    return () => {
      clearInterval(intervalId);
    };
  }, [bestHostIp, fetchVMList]);

  const handleCopy = async (text: string, type: string) => {
    // 降级方案：使用 document.execCommand
    const fallbackCopy = (): boolean => {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        return false;
      }
    };

    try {
      // 优先使用 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        message.success(`${type} 已复制到剪贴板`);
      } else {
        // 使用降级方案
        const successful = fallbackCopy();
        if (successful) {
          message.success(`${type} 已复制到剪贴板`);
        } else {
          message.error("复制失败，请手动复制");
        }
      }
    } catch (err) {
      // 如果 Clipboard API 失败，尝试降级方案
      const successful = fallbackCopy();
      if (successful) {
        message.success(`${type} 已复制到剪贴板`);
      } else {
        message.error("复制失败，请手动复制");
      }
    }
  };

  // 显示日志，参考 console.html 的实现
  const showLog = (vmId: string, stream?: "stderr") => {
    if (!bestHostIp) {
      message.warning("请先设置最佳主机 IP");
      return;
    }

    // 构建日志URL，参考 console.html 的实现
    // console.html 中使用: /logs?id=${id}&follow=true&ansi=false&lines=50
    // 从 localStorage 读取端口，如果没有则使用默认值 9210
    const port = localStorage.getItem("bestHostPort") || "9210";
    const baseUrl = `http://${bestHostIp}:${port}`;
    const logUrl =
      stream === "stderr"
        ? `${baseUrl}/logs?id=${vmId}&follow=true&ansi=false&lines=50&ch=stderr`
        : `${baseUrl}/logs?id=${vmId}&follow=true&ansi=false&lines=50`;

    // 在新窗口打开日志
    window.open(logUrl, "_blank");
  };

  // 显示 Dashboard，参考 console.html 的实现
  const showDashboard = (vm: VMData) => {
    if (vm.app_url) {
      window.open(vm.app_url, "_blank");
    } else {
      message.warning("该 VM 没有可用的 Dashboard URL");
    }
  };

  // 检查 Dashboard 是否可用，参考 console.html 的实现
  const dashboardAvailable = (vm: VMData): boolean => {
    return !!vm.app_url;
  };

  // 获取 VM 状态，参考 console.html 的逻辑
  const getVMStatus = (vm: VMData): string => {
    const status = vm.status?.toLowerCase() || "";

    // 如果状态不是 running，直接返回状态
    if (status !== "running") {
      return status;
    }

    // 处理 running 状态的子状态
    if (vm.shutdown_progress) {
      return "shutting down";
    }

    // 如果 boot_progress 是 'running'，表示 VM 在 dstack-vmm 启动前就已经在运行
    if (vm.boot_progress === "running") {
      return "running";
    }

    // 如果 boot_progress 不是 'done'，表示正在启动
    if (vm.boot_progress && vm.boot_progress !== "done") {
      return "booting";
    }

    return "running";
  };

  // 获取状态对应的颜色和样式
  const getStatusConfig = (status: string) => {
    const normalizedStatus = status.toLowerCase();

    switch (normalizedStatus) {
      case "running":
        return {
          color: "#22c55e",
          bgColor: "#f0fdf4",
          iconColor: "#22c55e",
          barColor: "#22c55e",
          barShadow: "0 2px 8px rgba(34, 197, 94, 0.2)",
          iconBg: "#dcfce7",
          iconBorder: "1px solid #86efac",
          iconShadow: "0 2px 8px rgba(34, 197, 94, 0.15)",
          icon: PauseOutlined,
          text: "RUNNING",
        };
      case "booting":
        return {
          color: "#eab308",
          bgColor: "#fefce8",
          iconColor: "#eab308",
          barColor: "#eab308",
          barShadow: "0 2px 8px rgba(234, 179, 8, 0.2)",
          iconBg: "#fef9c3",
          iconBorder: "1px solid #fde047",
          iconShadow: "0 2px 8px rgba(234, 179, 8, 0.15)",
          icon: ClockCircleOutlined,
          text: "BOOTING",
        };
      case "shutting down":
      case "stopping":
        return {
          color: "#f97316",
          bgColor: "#fff7ed",
          iconColor: "#f97316",
          barColor: "#f97316",
          barShadow: "0 2px 8px rgba(249, 115, 22, 0.2)",
          iconBg: "#ffedd5",
          iconBorder: "1px solid #fdba74",
          iconShadow: "0 2px 8px rgba(249, 115, 22, 0.15)",
          icon: PauseCircleOutlined,
          text: "SHUTTING DOWN",
        };
      case "stopped":
        return {
          color: "#ef4444",
          bgColor: "#fef2f2",
          iconColor: "#ef4444",
          barColor: "#ef4444",
          barShadow: "0 2px 8px rgba(239, 68, 68, 0.2)",
          iconBg: "#fee2e2",
          iconBorder: "1px solid #fca5a5",
          iconShadow: "0 2px 8px rgba(239, 68, 68, 0.15)",
          icon: PauseCircleOutlined,
          text: "STOPPED",
        };
      case "created":
        return {
          color: "#eab308",
          bgColor: "#fefce8",
          iconColor: "#eab308",
          barColor: "#eab308",
          barShadow: "0 2px 8px rgba(234, 179, 8, 0.2)",
          iconBg: "#fef9c3",
          iconBorder: "1px solid #fde047",
          iconShadow: "0 2px 8px rgba(234, 179, 8, 0.15)",
          icon: ClockCircleOutlined,
          text: "CREATED",
        };
      case "exited":
        return {
          color: "#6b7280",
          bgColor: "#f9fafb",
          iconColor: "#6b7280",
          barColor: "#6b7280",
          barShadow: "0 2px 8px rgba(107, 114, 128, 0.2)",
          iconBg: "#f3f4f6",
          iconBorder: "1px solid #d1d5db",
          iconShadow: "0 2px 8px rgba(107, 114, 128, 0.15)",
          icon: PauseCircleOutlined,
          text: "EXITED",
        };
      default:
        return {
          color: "#6b7280",
          bgColor: "#f9fafb",
          iconColor: "#6b7280",
          barColor: "#6b7280",
          barShadow: "0 2px 8px rgba(107, 114, 128, 0.2)",
          iconBg: "#f3f4f6",
          iconBorder: "1px solid #d1d5db",
          iconShadow: "0 2px 8px rgba(107, 114, 128, 0.15)",
          icon: PauseCircleOutlined,
          text: status.toUpperCase(),
        };
    }
  };

  // 启动 VM
  const startVm = async (vmId: string) => {
    if (!bestHostIp) {
      message.warning("请先设置最佳主机 IP");
      return;
    }
    try {
      await rpcCall(bestHostIp, "StartVm", { id: vmId });
      message.success("VM 启动成功");
      fetchVMList(false);
    } catch (error) {
      console.error("Error starting VM:", error);
      message.error("启动 VM 失败");
    }
  };

  // 停止 VM (强制停止)
  const stopVm = async (vm: VMListItem) => {
    if (!bestHostIp) {
      message.warning("请先设置最佳主机 IP");
      return;
    }
    modal.confirm({
      title: "请确认是否强制停止 VM?",
      content: `您正在强制停止 "${getVmDisplayName(
        vm
      )}"，这可能会导致数据损坏。`,
      okText: "确认",
      cancelText: "取消",
      okType: "danger",
      onOk: async () => {
        try {
          await rpcCall(bestHostIp, "StopVm", { id: vm.id });
          message.success("VM 已停止");
          fetchVMList(false);
        } catch (error) {
          console.error("Error stopping VM:", error);
          message.error("停止 VM 失败");
        }
      },
    });
  };

  // 优雅关闭 VM
  const shutdownVm = async (vmId: string) => {
    if (!bestHostIp) {
      message.warning("请先设置最佳主机 IP");
      return;
    }
    try {
      await rpcCall(bestHostIp, "ShutdownVm", { id: vmId });
      message.success("VM 正在关闭");
      fetchVMList(false);
    } catch (error) {
      console.error("Error shutting down VM:", error);
      message.error("关闭 VM 失败");
    }
  };

  // 重启 VM (先停止再启动)
  const restartVm = async (vm: VMListItem) => {
    if (!bestHostIp) {
      message.warning("请先设置最佳主机 IP");
      return;
    }
    modal.confirm({
      title: "请确认是否重启 VM?",
      content: `您正在重启 "${getVmDisplayName(vm)}"。`,
      okText: "确认",
      cancelText: "取消",
      onOk: async () => {
        try {
          // 先停止
          await rpcCall(bestHostIp, "ShutdownVm", { id: vm.id });
          // 等待一下再启动
          setTimeout(async () => {
            await rpcCall(bestHostIp, "StartVm", { id: vm.id });
            message.success("VM 重启成功");
            fetchVMList(false);
          }, 1000);
        } catch (error) {
          console.error("Error restarting VM:", error);
          message.error("重启 VM 失败");
        }
      },
    });
  };

  // 删除 VM
  const removeVm = async (vm: VMListItem) => {
    if (!bestHostIp) {
      message.warning("请先设置最佳主机 IP");
      return;
    }
    modal.confirm({
      title: "确认删除 VM",
      content: `您正在删除 "${getVmDisplayName(vm)}"。此操作无法撤销。`,
      okText: "确认删除",
      cancelText: "取消",
      okType: "danger",
      onOk: async () => {
        try {
          await rpcCall(bestHostIp, "RemoveVm", { id: vm.id });
          message.success("VM 已删除");
          fetchVMList(false);
        } catch (error) {
          console.error("Error removing VM:", error);
          message.error("删除 VM 失败");
        }
      },
    });
  };

  // 加载镜像列表
  const loadImages = async () => {
    if (!bestHostIp) return;
    try {
      const response = await rpcCall(bestHostIp, "ListImages");
      const data = await response.json();
      setAvailableImages(data.images || []);
    } catch (error) {
      console.error("Error loading images:", error);
      message.error("加载镜像列表失败");
    }
  };

  // 加载 GPU 列表
  const loadGpus = async () => {
    if (!bestHostIp) return;
    try {
      const response = await rpcCall(bestHostIp, "ListGpus");
      const data = await response.json();
      setAvailableGpus(data.gpus || []);
      setAllowAttachAllGpus(data.allow_attach_all || false);
    } catch (error) {
      console.error("Error loading GPUs:", error);
      message.error("加载 GPU 列表失败");
    }
  };

  // 纯 JavaScript SHA-256 实现（作为后备）
  const sha256Fallback = (message: string): string => {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
      0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
      0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
      0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
      0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
      0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    const H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
      0x1f83d9ab, 0x5be0cd19,
    ];

    const rightRotate = (value: number, amount: number) =>
      (value >>> amount) | (value << (32 - amount));

    const bytes = new TextEncoder().encode(message);
    const bitLength = bytes.length * 8;
    const padding = new Uint8Array((64 - ((bytes.length + 9) % 64)) % 64);
    const lengthBytes = new ArrayBuffer(8);
    new DataView(lengthBytes).setBigUint64(0, BigInt(bitLength), false);
    const lengthArray = new Uint8Array(lengthBytes);

    const totalLength = bytes.length + 1 + padding.length + lengthArray.length;
    const data = new Uint8Array(totalLength);
    data.set(bytes, 0);
    data[bytes.length] = 0x80;
    data.set(padding, bytes.length + 1);
    data.set(lengthArray, bytes.length + 1 + padding.length);

    for (let chunkStart = 0; chunkStart < data.length; chunkStart += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) {
        w[i] =
          (data[chunkStart + i * 4] << 24) |
          (data[chunkStart + i * 4 + 1] << 16) |
          (data[chunkStart + i * 4 + 2] << 8) |
          data[chunkStart + i * 4 + 3];
      }

      for (let i = 16; i < 64; i++) {
        const s0 =
          rightRotate(w[i - 15], 7) ^
          rightRotate(w[i - 15], 18) ^
          (w[i - 15] >>> 3);
        const s1 =
          rightRotate(w[i - 2], 17) ^
          rightRotate(w[i - 2], 19) ^
          (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }

      let [a, b, c, d, e, f, g, h] = H;

      for (let i = 0; i < 64; i++) {
        const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + h) >>> 0;
    }

    return H.map((h) => h.toString(16).padStart(8, "0")).join("");
  };

  // 计算 Compose Hash
  const calcComposeHash = async (content: string): Promise<string> => {
    // 优先使用 Web Crypto API（如果可用）
    if (typeof window !== "undefined") {
      const cryptoObj = window.crypto;
      if (cryptoObj && cryptoObj.subtle) {
        try {
          const encoder = new TextEncoder();
          const data = encoder.encode(content);
          const hashBuffer = await cryptoObj.subtle.digest("SHA-256", data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        } catch (error) {
          console.warn("Web Crypto API failed, using fallback:", error);
        }
      }
    }

    // 使用纯 JavaScript 后备实现
    return sha256Fallback(content);
  };

  // 创建 App Compose 文件内容
  const makeAppComposeFile = async (formData: VMFormData): Promise<string> => {
    const app_compose: any = {
      manifest_version: 2,
      name: formData.name,
      runner: "docker-compose",
      docker_compose_file: formData.dockerComposeFile,
      docker_config: formData.docker_config?.enabled
        ? {
            username: formData.docker_config.username,
            token_key: formData.docker_config.token_key,
          }
        : {},
      kms_enabled: formData.kms_enabled,
      gateway_enabled: formData.gateway_enabled,
      public_logs: formData.public_logs,
      public_sysinfo: formData.public_sysinfo,
      public_tcbinfo: formData.public_tcbinfo,
      local_key_provider_enabled: formData.local_key_provider_enabled,
      key_provider_id: formData.key_provider_id || undefined,
      allowed_envs: formData.encryptedEnvs.map((env) => env.key),
      no_instance_id: !formData.gateway_enabled,
      secure_time: false,
    };

    if (formData.preLaunchScript?.trim()) {
      app_compose.pre_launch_script = formData.preLaunchScript;
    }

    // 如果设置了 APP_LAUNCH_TOKEN，添加其 sha256 hash
    const launchToken = formData.encryptedEnvs.find(
      (env) => env.key === "APP_LAUNCH_TOKEN"
    );
    if (launchToken) {
      app_compose.launch_token_hash = await calcComposeHash(launchToken.value);
    }

    // 兼容旧版本镜像
    const selectedImage = availableImages.find(
      (img) => img.name === formData.image
    );
    if (selectedImage?.version) {
      // 版本比较函数：判断 versionStr >= otherVersionStr
      const verGE = (versionStr: string, otherVersionStr: string): boolean => {
        const version = versionStr.split(".").map(Number);
        const otherVersion = otherVersionStr.split(".").map(Number);
        return (
          version[0] > otherVersion[0] ||
          (version[0] === otherVersion[0] && version[1] > otherVersion[1]) ||
          (version[0] === otherVersion[0] &&
            version[1] === otherVersion[1] &&
            version[2] >= otherVersion[2])
        );
      };

      const versionStr = selectedImage.version;
      let composeVersion = 1;

      if (verGE(versionStr, "0.3.3")) {
        composeVersion = 2;
      }
      if (verGE(versionStr, "0.4.2")) {
        composeVersion = 3;
      }

      if (composeVersion < 2) {
        const features = [];
        if (formData.kms_enabled) features.push("kms");
        if (formData.gateway_enabled) features.push("tproxy-net");
        app_compose.features = features;
        app_compose.manifest_version = 1;
        app_compose.version = "1.0.0";
      }
      if (composeVersion < 3) {
        app_compose.tproxy_enabled = app_compose.gateway_enabled;
        delete app_compose["gateway_enabled"];
      }
    }

    return JSON.stringify(app_compose);
  };

  // 加密环境变量
  const encryptEnv = async (
    envs: EncryptedEnv[],
    hexPublicKey: string
  ): Promise<string> => {
    try {
      // 确保 crypto API 可用
      const cryptoObj =
        typeof window !== "undefined" ? window.crypto : globalThis.crypto;
      if (!cryptoObj || !cryptoObj.subtle) {
        throw new Error(
          "Web Crypto API is not available. Please ensure you are using HTTPS or localhost."
        );
      }

      // 将环境变量转换为 JSON 格式
      const envsJson = JSON.stringify({ env: envs });

      // 处理公钥格式（移除 0x 前缀）
      let processedPublicKey = hexPublicKey;
      if (processedPublicKey.startsWith("0x")) {
        processedPublicKey = processedPublicKey.slice(2);
      }

      // 将十六进制公钥转换为 Uint8Array
      const remotePubkey = new Uint8Array(
        processedPublicKey
          .match(/.{1,2}/g)
          ?.map((byte) => parseInt(byte, 16)) || []
      );

      // 生成随机种子和临时密钥对
      const seed = cryptoObj.getRandomValues(new Uint8Array(32));
      const ephemeralKeyPair = x25519.keygen(seed);
      const ephemeralPrivateKey = ephemeralKeyPair.secretKey;
      const ephemeralPublicKey = ephemeralKeyPair.publicKey;

      // 计算共享密钥
      const shared = x25519.getSharedSecret(ephemeralPrivateKey, remotePubkey);

      // 确保 shared 是标准的 Uint8Array（处理类型兼容性）
      const sharedKey = new Uint8Array(shared);

      // 导入共享密钥用于 AES-GCM 加密
      const importedShared = await cryptoObj.subtle.importKey(
        "raw",
        sharedKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
      );

      // 生成随机 IV
      const iv = cryptoObj.getRandomValues(new Uint8Array(12));

      // 使用 AES-GCM 加密数据
      const encrypted = await cryptoObj.subtle.encrypt(
        { name: "AES-GCM", iv },
        importedShared,
        new TextEncoder().encode(envsJson)
      );

      // 组合结果：临时公钥 + IV + 加密数据
      const result = new Uint8Array(
        ephemeralPublicKey.length + iv.length + encrypted.byteLength
      );
      result.set(ephemeralPublicKey, 0);
      result.set(iv, ephemeralPublicKey.length);
      result.set(
        new Uint8Array(encrypted),
        ephemeralPublicKey.length + iv.length
      );

      // 转换为十六进制字符串
      return Array.from(result)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch (error) {
      console.error("Error encrypting environment variables:", error);
      throw error;
    }
  };

  // 创建加密的环境变量
  const makeEncryptedEnv = async (
    envs: EncryptedEnv[],
    kmsEnabled: boolean,
    appId: string | null | undefined,
    formData?: VMFormData
  ): Promise<string> => {
    if (!kmsEnabled || envs.length === 0 || !bestHostIp) return "";

    // 如果 appId 为空，自动计算（与 console.html 保持一致）
    let finalAppId = appId;
    if (!finalAppId && formData) {
      finalAppId = await calcAppId(formData);
    }

    if (!finalAppId) return "";

    try {
      const response = await rpcCall(bestHostIp, "GetAppEnvEncryptPubKey", {
        app_id: finalAppId,
      });
      const data = await response.json();
      return await encryptEnv(envs, data.public_key);
    } catch (error) {
      console.error("Error getting encrypt public key:", error);
      return "";
    }
  };

  // 配置 GPU
  const configGpu = (formData: VMFormData) => {
    if (formData.attachAllGpus) {
      return { attach_mode: "all" };
    } else {
      const gpus =
        formData.selectedGpus?.length > 0
          ? formData.selectedGpus.map((slot) => ({ slot }))
          : [];
      if (gpus.length === 0) {
        return null;
      }
      return {
        attach_mode: "listed",
        gpus: gpus,
      };
    }
  };

  // 计算 App ID
  const calcAppId = async (formData: VMFormData): Promise<string> => {
    const appCompose = await makeAppComposeFile(formData);
    const composeHash = await calcComposeHash(appCompose);
    return composeHash.slice(0, 40);
  };

  // 显示部署对话框
  const showDeployDialog = () => {
    if (!bestHostIp) {
      message.warning("请先设置最佳主机 IP");
      return;
    }
    setShowDeployModal(true);
    loadImages();
    loadGpus();

    // 重置表单
    form.setFieldsValue({
      name: "",
      image: undefined,
      dockerComposeFile: "",
      preLaunchScript: `EXPECTED_TOKEN_HASH=$(jq -j .launch_token_hash app-compose.json)
if [ "$EXPECTED_TOKEN_HASH" == "null" ]; then
    echo "Skipped APP_LAUNCH_TOKEN check"
else
  ACTUAL_TOKEN_HASH=$(echo -n "$APP_LAUNCH_TOKEN" | sha256sum | cut -d' ' -f1)
  if [ "$EXPECTED_TOKEN_HASH" != "$ACTUAL_TOKEN_HASH" ]; then
      echo "Error: Incorrect APP_LAUNCH_TOKEN, please make sure set the correct APP_LAUNCH_TOKEN in env"
      reboot
      exit 1
  else
      echo "APP_LAUNCH_TOKEN checked OK"
  fi
fi`,
      vcpu: 1,
      memoryValue: 2,
      memoryUnit: "GB",
      disk_size: 20,
      selectedGpus: [],
      attachAllGpus: false,
      ports: [],
      encryptedEnvs: [],
      docker_config: {
        enabled: false,
        username: "",
        token_key: "",
      },
      app_id: "",
      kms_enabled: true,
      local_key_provider_enabled: false,
      key_provider_id: "",
      gateway_enabled: true,
      public_logs: true,
      public_sysinfo: true,
      public_tcbinfo: true,
      pin_numa: false,
      hugepages: false,
      user_config: "",
    });
    setComposeHashPreview("");
  };

  // 创建 VM
  const createVm = async (values: any) => {
    if (!bestHostIp) {
      message.warning("请先设置最佳主机 IP");
      return;
    }

    setDeployLoading(true);
    try {
      // 转换内存单位
      const memory =
        values.memoryUnit === "GB"
          ? values.memoryValue * 1024
          : values.memoryValue;

      const formData: VMFormData = {
        ...values,
        memory,
        // 确保这些字段有默认值，防止 undefined
        docker_config: values.docker_config || {
          enabled: false,
          username: "",
          token_key: "",
        },
        encryptedEnvs: values.encryptedEnvs || [],
        ports: values.ports || [],
        selectedGpus: values.selectedGpus || [],
      };

      // 创建 App Compose 文件
      const composeFile = await makeAppComposeFile(formData);

      // 计算 App ID（如果未提供）
      const appId = formData.app_id || (await calcAppId(formData));

      // 创建加密的环境变量（与 console.html 保持一致：makeEncryptedEnv 内部会处理空 appId）
      const encryptedEnv = await makeEncryptedEnv(
        formData.encryptedEnvs,
        formData.kms_enabled,
        formData.app_id || null,
        formData
      );

      // 配置 GPU
      const gpuConfig = configGpu(formData);

      // 准备创建 VM 的参数
      const createParams: any = {
        name: formData.name,
        image: formData.image,
        vcpu: formData.vcpu,
        memory: formData.memory,
        disk_size: formData.disk_size,
        compose_file: composeFile,
        allowed_envs: formData.encryptedEnvs.map((env) => env.key),
        encrypted_env: encryptedEnv,
        user_config: formData.user_config,
        ...(gpuConfig && { gpus: gpuConfig }),
        ...(portMappingEnabled &&
          formData.ports?.length > 0 && {
            ports: formData.ports.map((port) => ({
              host_address: port.host_address,
              protocol: port.protocol,
              host_port: port.host_port,
              vm_port: port.vm_port,
            })),
          }),
        ...(formData.app_id && { app_id: formData.app_id }),
      };

      // 调用 CreateVm RPC
      await rpcCall(bestHostIp, "CreateVm", createParams);

      message.success("VM 创建成功");
      setShowDeployModal(false);
      fetchVMList(true);
    } catch (error: any) {
      console.error("Error creating VM:", error);
      message.error(`创建 VM 失败: ${error.message || "未知错误"}`);
    } finally {
      setDeployLoading(false);
    }
  };

  // 监听表单变化，更新 Compose Hash 预览
  const watchedValues = Form.useWatch([], form);

  useEffect(() => {
    if (!showDeployModal || !watchedValues) return;

    const updateHash = async () => {
      try {
        const values = watchedValues;
        if (values?.name && values?.dockerComposeFile) {
          const formData: VMFormData = {
            name: values.name || "",
            image: values.image || "",
            dockerComposeFile: values.dockerComposeFile || "",
            preLaunchScript: values.preLaunchScript || "",
            vcpu: values.vcpu || 1,
            memory: 0,
            memoryValue: values.memoryValue || 2,
            memoryUnit: values.memoryUnit || "GB",
            disk_size: values.disk_size || 20,
            selectedGpus: values.selectedGpus || [],
            attachAllGpus: values.attachAllGpus || false,
            ports: values.ports || [],
            encryptedEnvs: values.encryptedEnvs || [],
            docker_config: values.docker_config || {
              enabled: false,
              username: "",
              token_key: "",
            },
            app_id: values.app_id || "",
            kms_enabled: values.kms_enabled !== false,
            local_key_provider_enabled:
              values.local_key_provider_enabled || false,
            key_provider_id: values.key_provider_id || "",
            gateway_enabled: values.gateway_enabled !== false,
            public_logs: values.public_logs !== false,
            public_sysinfo: values.public_sysinfo !== false,
            public_tcbinfo: values.public_tcbinfo !== false,
            pin_numa: values.pin_numa || false,
            hugepages: values.hugepages || false,
            user_config: values.user_config || "",
          };
          const appCompose = await makeAppComposeFile(formData);
          const hash = await calcComposeHash(appCompose);
          setComposeHashPreview(hash);
        } else {
          setComposeHashPreview("");
        }
      } catch (error) {
        console.error("Error calculating hash:", error);
        setComposeHashPreview("");
      }
    };

    // 使用防抖来避免频繁计算
    const timer = setTimeout(updateHash, 500);
    return () => clearTimeout(timer);
  }, [showDeployModal, watchedValues, availableImages]);

  // 获取菜单项，根据 VM 状态显示/隐藏
  const getMoreMenuItems = (vm: VMData) => {
    const vmStatus = getVMStatus(vm);
    const isRunning = vmStatus === "running" || vmStatus === "booting";
    const isStopped =
      vmStatus === "stopped" || vmStatus === "exited" || vmStatus === "created";

    const items = [];

    // 启动 - 只在停止状态显示（绿色，播放图标）
    if (isStopped) {
      items.push({
        key: "start",
        label: (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              color: "#fff",
              width: "100%",
              boxSizing: "border-box",
              maxWidth: "100%",
              overflow: "hidden",
              fontWeight: 500,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
            }}
          >
            <PlayCircleOutlined
              style={{
                fontSize: "16px",
                color: "#fff",
                flexShrink: 0,
                filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))",
              }}
            />
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: "14px",
              }}
            >
              启动
            </span>
          </div>
        ),
        className: "menu-item-start",
      });
    }

    // 关闭 - 只在运行状态显示（蓝色，电源图标）
    if (isRunning) {
      items.push({
        key: "shutdown",
        label: (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              color: "#fff",
              width: "100%",
              boxSizing: "border-box",
              maxWidth: "100%",
              overflow: "hidden",
              fontWeight: 500,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
            }}
          >
            <PoweroffOutlined
              style={{
                fontSize: "16px",
                color: "#fff",
                flexShrink: 0,
                filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))",
              }}
            />
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: "14px",
              }}
            >
              关闭
            </span>
          </div>
        ),
        className: "menu-item-shutdown",
      });
    }

    // 重启 - 只在运行状态显示（橙色，同步图标）
    if (isRunning) {
      items.push({
        key: "restart",
        label: (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              color: "#fff",
              width: "100%",
              boxSizing: "border-box",
              maxWidth: "100%",
              overflow: "hidden",
              fontWeight: 500,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
            }}
          >
            <SyncOutlined
              style={{
                fontSize: "16px",
                color: "#fff",
                flexShrink: 0,
                filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))",
              }}
            />
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: "14px",
              }}
            >
              重启
            </span>
          </div>
        ),
        className: "menu-item-restart",
      });
    }

    // 删除（Remove）- 只在停止状态显示（红色，垃圾桶图标）
    if (isStopped) {
      items.push({
        key: "delete",
        label: (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 12px",
              color: "#fff",
              width: "100%",
              boxSizing: "border-box",
              maxWidth: "100%",
              overflow: "hidden",
              fontWeight: 500,
              textShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
            }}
          >
            <DeleteOutlined
              style={{
                fontSize: "16px",
                color: "#fff",
                flexShrink: 0,
                filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))",
              }}
            />
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontSize: "14px",
              }}
            >
              删除
            </span>
          </div>
        ),
        className: "menu-item-remove",
      });
    }

    return items;
  };

  // 处理菜单项点击
  const handleMenuClick = (vm: VMData, key: string, event?: any) => {
    // 阻止事件冒泡到 Card 的 onClick
    if (event) {
      event.domEvent?.stopPropagation();
    }
    
    switch (key) {
      case "start":
        startVm(vm.id);
        break;
      case "shutdown":
        shutdownVm(vm.id);
        break;
      // case "stop":
      //   stopVm(vm);
      //   break;
      case "restart":
        restartVm(vm);
        break;
      case "delete":
        removeVm(vm);
        break;
      default:
        break;
    }
  };

  // 过滤 VM 列表
  const filteredVMs = vms.filter(
    (vm) =>
      getVmDisplayName(vm)
        .toLowerCase()
        .includes(searchText.toLowerCase()) ||
      vm.app_id?.toLowerCase().includes(searchText.toLowerCase()) ||
      vm.instance_id?.toLowerCase().includes(searchText.toLowerCase()) ||
      vm.id?.toLowerCase().includes(searchText.toLowerCase())
  );

  // 添加样式到 head
  useEffect(() => {
    const styleId = "custom-dropdown-menu-styles";
    if (document.getElementById(styleId)) {
      return;
    }
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
            .custom-dropdown-menu {
                overflow-x: hidden !important;
                overflow-y: auto !important;
                background: #ffffff !important;
                border: 1px solid #e5e7eb !important;
                border-radius: 12px !important;
                padding: 8px !important;
                box-shadow: 0 12px 28px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05) !important;
            }
            .custom-dropdown-menu .ant-dropdown-menu {
                overflow-x: hidden !important;
                overflow-y: auto !important;
                background: transparent !important;
                box-shadow: none !important;
                padding: 0 !important;
            }
            .custom-dropdown-menu .ant-dropdown-menu-item {
                padding: 0 !important;
                margin: 0 0 8px 0 !important;
                border-radius: 10px !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                overflow: hidden !important;
                width: 100%;
                box-sizing: border-box;
                border: 1px solid transparent !important;
            }
            .custom-dropdown-menu .ant-dropdown-menu-item:last-child {
                margin-bottom: 0 !important;
            }
            .custom-dropdown-menu .menu-item-start {
                background: #22c55e !important;
                border: 1px solid #16a34a !important;
                box-shadow: 0 4px 12px rgba(34, 197, 94, 0.25) !important;
            }
            .custom-dropdown-menu .menu-item-start:hover {
                background: #16a34a !important;
                transform: translateY(-2px) scale(1.02) !important;
                box-shadow: 0 8px 20px rgba(34, 197, 94, 0.3) !important;
                border-color: #15803d !important;
            }
            .custom-dropdown-menu .menu-item-shutdown {
                background: #3b82f6 !important;
                border: 1px solid #2563eb !important;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25) !important;
            }
            .custom-dropdown-menu .menu-item-shutdown:hover {
                background: #2563eb !important;
                transform: translateY(-2px) scale(1.02) !important;
                box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3) !important;
                border-color: #1d4ed8 !important;
            }
            .custom-dropdown-menu .menu-item-restart {
                background: #f97316 !important;
                border: 1px solid #ea580c !important;
                box-shadow: 0 4px 12px rgba(249, 115, 22, 0.25) !important;
            }
            .custom-dropdown-menu .menu-item-restart:hover {
                background: #ea580c !important;
                transform: translateY(-2px) scale(1.02) !important;
                box-shadow: 0 8px 20px rgba(249, 115, 22, 0.3) !important;
                border-color: #c2410c !important;
            }
            .custom-dropdown-menu .menu-item-kill {
                background: #8b5cf6 !important;
                border: 1px solid #7c3aed !important;
                box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25) !important;
            }
            .custom-dropdown-menu .menu-item-kill:hover {
                background: #7c3aed !important;
                transform: translateY(-2px) scale(1.02) !important;
                box-shadow: 0 8px 20px rgba(139, 92, 246, 0.3) !important;
                border-color: #6d28d9 !important;
            }
            .custom-dropdown-menu .menu-item-remove {
                background: #ef4444 !important;
                border: 1px solid #dc2626 !important;
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25) !important;
            }
            .custom-dropdown-menu .menu-item-remove:hover {
                background: #dc2626 !important;
                transform: translateY(-2px) scale(1.02) !important;
                box-shadow: 0 8px 20px rgba(239, 68, 68, 0.3) !important;
                border-color: #b91c1c !important;
            }
            .custom-dropdown-menu .ant-dropdown-menu-item .ant-dropdown-menu-title-content {
                width: 100%;
                overflow: hidden;
                box-sizing: border-box;
            }
        `;
    document.head.appendChild(style);
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // 添加部署弹窗表单样式
  useEffect(() => {
    const styleId = "deploy-modal-styles";
    if (document.getElementById(styleId)) {
      return;
    }
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
            @keyframes pulse {
                0%, 100% {
                    opacity: 0.3;
                    transform: scale(1);
                }
                50% {
                    opacity: 0.6;
                    transform: scale(1.1);
                }
            }
            /* 部署弹窗表单样式 */
            .ant-modal-content .ant-form-item-label > label {
                color: #1f2937 !important;
                font-weight: 500 !important;
                font-size: 14px !important;
            }
            .ant-modal-content .ant-input,
            .ant-modal-content .ant-input-number-input,
            .ant-modal-content .ant-select-selector,
            .ant-modal-content .ant-input-number {
                background: #ffffff !important;
                border: 1px solid #d1d5db !important;
                border-radius: 8px !important;
                color: #1f2937 !important;
                transition: all 0.3s ease !important;
            }
            .ant-modal-content .ant-input:hover,
            .ant-modal-content .ant-input-number:hover,
            .ant-modal-content .ant-select:hover .ant-select-selector {
                border-color: #3b82f6 !important;
                background: #ffffff !important;
            }
            .ant-modal-content .ant-input:focus,
            .ant-modal-content .ant-input-focused,
            .ant-modal-content .ant-input-number:focus,
            .ant-modal-content .ant-input-number-focused,
            .ant-modal-content .ant-select-focused .ant-select-selector {
                border-color: #3b82f6 !important;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
                background: #ffffff !important;
            }
            .ant-modal-content .ant-input::placeholder,
            .ant-modal-content .ant-input-number-input::placeholder {
                color: #9ca3af !important;
            }
            .ant-modal-content .ant-select-selection-placeholder {
                color: #9ca3af !important;
            }
            .ant-modal-content .ant-select-selection-item {
                color: #1f2937 !important;
            }
            .ant-modal-content .ant-select-arrow {
                color: #6b7280 !important;
            }
            .ant-modal-content .ant-select-dropdown {
                background: #ffffff !important;
                border: 1px solid #e5e7eb !important;
                border-radius: 12px !important;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1) !important;
            }
            .ant-modal-content .ant-select-item {
                color: #1f2937 !important;
            }
            .ant-modal-content .ant-select-item:hover {
                background: #f3f4f6 !important;
            }
            .ant-modal-content .ant-select-item-option-selected {
                background: #dbeafe !important;
                color: #3b82f6 !important;
            }
            .ant-modal-content .ant-checkbox-wrapper {
                color: #1f2937 !important;
            }
            .ant-modal-content .ant-checkbox-inner {
                background: #ffffff !important;
                border-color: #d1d5db !important;
            }
            .ant-modal-content .ant-checkbox-checked .ant-checkbox-inner {
                background: #3b82f6 !important;
                border-color: #3b82f6 !important;
            }
            .ant-modal-content .ant-checkbox-wrapper:hover .ant-checkbox-inner {
                border-color: #3b82f6 !important;
            }
            .ant-modal-content .ant-btn-dashed {
                background: #ffffff !important;
                border: 1px dashed #d1d5db !important;
                color: #1f2937 !important;
                border-radius: 8px !important;
            }
            .ant-modal-content .ant-btn-dashed:hover {
                background: #f9fafb !important;
                border-color: #3b82f6 !important;
                color: #3b82f6 !important;
            }
            .ant-modal-content .ant-upload .ant-btn {
                background: #ffffff !important;
                border: 1px solid #d1d5db !important;
                color: #1f2937 !important;
                border-radius: 8px !important;
            }
            .ant-modal-content .ant-upload .ant-btn:hover {
                background: #f9fafb !important;
                border-color: #3b82f6 !important;
                color: #3b82f6 !important;
            }
            .ant-modal-content .ant-input-number-handler-wrap {
                background: #f9fafb !important;
                border-left: 1px solid #e5e7eb !important;
            }
            .ant-modal-content .ant-input-number-handler {
                color: #6b7280 !important;
            }
            .ant-modal-content .ant-input-number-handler:hover {
                color: #1f2937 !important;
            }
            .ant-modal-content code {
                background: #f3f4f6 !important;
                border: 1px solid #e5e7eb !important;
                color: #3b82f6 !important;
                padding: 4px 8px !important;
                border-radius: 6px !important;
            }
            .ant-modal-content .anticon {
                color: #6b7280 !important;
            }
            .ant-modal-content .anticon:hover {
                color: #1f2937 !important;
            }
        `;
    document.head.appendChild(style);
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  return (
    <PortalLayout>
      <div className={styles.portalContent}>
        {/* Back to dashboard link */}
        <Link
          href="/developers"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            color: "#6b7280",
            textDecoration: "none",
            marginBottom: "48px",
            fontSize: "14px",
            fontWeight: 500,
            padding: "8px 16px",
            borderRadius: "10px",
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#1f2937";
            e.currentTarget.style.background = "#f3f4f6";
            e.currentTarget.style.borderColor = "#d1d5db";
            e.currentTarget.style.transform = "translateX(-4px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#6b7280";
            e.currentTarget.style.background = "#f9fafb";
            e.currentTarget.style.borderColor = "#e5e7eb";
            e.currentTarget.style.transform = "translateX(0)";
          }}
        >
          <ArrowLeftOutlined />
          <span>返回开发者中心</span>
        </Link>

        {/* Header Section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginBottom: "48px",
            gap: "24px",
          }}
        >
          <div style={{ width: "100%" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  width: "4px",
                  height: "48px",
                  background: "#409EFF",
                  borderRadius: "2px",
                  boxShadow: "0 2px 8px rgba(64, 158, 255, 0.3)",
                }}
              />
              <Title
                level={1}
                style={{
                  color: "#1f2937",
                  margin: 0,
                  fontSize: "42px",
                  fontWeight: 700,
                  letterSpacing: "-0.5px",
                }}
              >
                自主可信应用列表{/* CVMs */}
              </Title>
            </div>
            <Paragraph
              style={{
                marginTop: "12px",
                color: "#4b5563",
                fontSize: "15px",
                lineHeight: 1.8,
                fontWeight: 400,
              }}
            >
              在这里统一查看并管理所有可信应用。通过国产 TEE 与调度网络协同，确保业务持续、可信、可观测。
            </Paragraph>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                marginTop: "16px",
                width: "100%",
              }}
            >
              {heroHighlights.map((item) => (
                <div
                  key={item.label}
                  style={{
                    flex: "1 1 180px",
                    minWidth: "180px",
                    background:
                      "linear-gradient(135deg, rgba(64,158,255,0.12), rgba(99,102,241,0.12))",
                    border: "1px solid rgba(99,102,241,0.15)",
                    borderRadius: "14px",
                    padding: "14px 18px",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                  }}
                >
                  <Text
                    style={{
                      display: "block",
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "#6b7280",
                      marginBottom: "6px",
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {item.value}
                  </Text>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "14px",
                padding: "16px 20px",
              }}
            >
              {introChecklist.map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    color: "#4b5563",
                    fontSize: "13px",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#10b981",
                      boxShadow: "0 0 6px rgba(16,185,129,0.6)",
                      flexShrink: 0,
                    }}
                  />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              {bestHostIp && (
                <div
                  style={{
                    padding: "10px 18px",
                    background: "#ecf5ff",
                    border: "1px solid #b3d8ff",
                    borderRadius: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    width: "fit-content",
                    boxShadow: "0 4px 12px rgba(64, 158, 255, 0.1)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#d9ecff";
                    e.currentTarget.style.borderColor = "#a0cfff";
                    e.currentTarget.style.boxShadow =
                      "0 6px 16px rgba(64, 158, 255, 0.15)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ecf5ff";
                    e.currentTarget.style.borderColor = "#b3d8ff";
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(64, 158, 255, 0.1)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <ThunderboltOutlined
                    style={{
                      fontSize: "14px",
                      color: "#409EFF",
                      transition: "all 0.3s ease",
                    }}
                  />
                  <Text
                    style={{
                      color: "#303133",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    最佳资源地址:
                  </Text>
                  <Text
                    style={{
                      color: "#409EFF",
                      fontSize: "13px",
                      fontFamily: "monospace",
                      fontWeight: 600,
                      letterSpacing: "0.5px",
                    }}
                  >
                    {bestHostIp}:{typeof window !== "undefined" ? (localStorage.getItem("bestHostPort") || "9210") : "9210"}
                  </Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopy(`${bestHostIp}:${typeof window !== "undefined" ? (localStorage.getItem("bestHostPort") || "9210") : "9210"}`, "最佳资源地址")}
                    style={{
                      color: "#409EFF",
                      padding: "0 6px",
                      transition: "all 0.2s ease",
                      borderRadius: "6px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.15)";
                      e.currentTarget.style.color = "#66b1ff";
                      e.currentTarget.style.background = "#d9ecff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.color = "#409EFF";
                      e.currentTarget.style.background = "transparent";
                    }}
                  />
                </div>
              )}
              <Space
                size="small"
                align="center"
                style={{
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <Button
                  type="primary"
                  size="large"
                  onClick={showDeployDialog}
                  style={{
                    background: "#409EFF",
                    border: "none",
                    borderRadius: "12px",
                    padding: "10px 18px",
                    fontSize: "15px",
                    fontWeight: 500,
                    width: "150px",
                    height: "43px",
                    boxShadow: "0 8px 24px rgba(64, 158, 255, 0.3)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    color: "#fff",
                    textShadow: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#66b1ff";
                    e.currentTarget.style.boxShadow =
                      "0 12px 32px rgba(64, 158, 255, 0.4)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#409EFF";
                    e.currentTarget.style.boxShadow =
                      "0 8px 24px rgba(64, 158, 255, 0.3)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  部署
                </Button>
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={() => fetchVMList(true)}
                  loading={loading}
                  style={{
                    color: "#909399",
                    borderRadius: "50%",
                    width: "40px",
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f5f7fa",
                    border: "1px solid #dcdfe6",
                    transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#ecf5ff";
                    e.currentTarget.style.borderColor = "#b3d8ff";
                    e.currentTarget.style.color = "#409EFF";
                    e.currentTarget.style.transform = "rotate(180deg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f5f7fa";
                    e.currentTarget.style.borderColor = "#dcdfe6";
                    e.currentTarget.style.color = "#909399";
                    e.currentTarget.style.transform = "rotate(0deg)";
                  }}
                />
              </Space>
            </div>
          </div>
        </div>

        {/* CVM Cards Section */}
        <section
          className={styles.section}
          style={{
            padding: "32px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "24px",
            boxShadow:
              "0 20px 60px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div
            style={{
              marginBottom: "24px",
              display: "flex",
              gap: "16px",
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "20px",
                alignItems: "center",
                flexWrap: "wrap",
                flex: 1,
                justifyContent: "flex-start",
              }}
            >
              <div
                className={styles.searchInputWrapper}
                style={{ flex: 1, minWidth: "250px", maxWidth: "400px" }}
              >
                <Input
                  placeholder="请输入要搜索的应用信息..."
                  prefix={
                    <SearchOutlined
                      style={{
                        color: "#409EFF",
                        fontSize: "16px",
                        transition: "all 0.3s ease",
                      }}
                    />
                  }
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{
                    flex: 1,
                    background: "#ffffff",
                    border: "1px solid #d1d5db",
                    borderRadius: "12px",
                    height: "48px",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    color: "#1f2937",
                    fontSize: "14px",
                    fontWeight: 400,
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.05)",
                    paddingLeft: "16px",
                    paddingRight: "16px",
                  }}
                  onFocus={(e) => {
                    e.target.style.background = "#ffffff";
                    e.target.style.borderColor = "#409EFF";
                    e.target.style.boxShadow =
                      "0 0 0 3px rgba(64, 158, 255, 0.1), 0 4px 12px rgba(0, 0, 0, 0.1)";
                    const prefixIcon = e.target.parentElement?.querySelector(
                      ".ant-input-prefix .anticon"
                    );
                    if (prefixIcon) {
                      (prefixIcon as HTMLElement).style.color = "#66b1ff";
                      (prefixIcon as HTMLElement).style.transform =
                        "scale(1.15)";
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.background = "#ffffff";
                    e.target.style.borderColor = "#d1d5db";
                    e.target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.05)";
                    const prefixIcon = e.target.parentElement?.querySelector(
                      ".ant-input-prefix .anticon"
                    );
                    if (prefixIcon) {
                      (prefixIcon as HTMLElement).style.color = "#409EFF";
                      (prefixIcon as HTMLElement).style.transform = "scale(1)";
                    }
                  }}
                  onMouseEnter={(e) => {
                    const target = e.target as HTMLInputElement;
                    if (document.activeElement !== target) {
                      target.style.borderColor = "#9ca3af";
                      target.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.08)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    const target = e.target as HTMLInputElement;
                    if (document.activeElement !== target) {
                      target.style.borderColor = "#d1d5db";
                      target.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.05)";
                    }
                  }}
                />
              </div>
              {/* <Button
                                // icon={<FilterOutlined />}
                                style={{
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    borderRadius: '10px',
                                    height: '40px',
                                    padding: '0 20px',
                                    fontWeight: 500,
                                    transition: 'all 0.3s ease',
                                    backdropFilter: 'blur(10px)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                搜索
                            </Button> */}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#409EFF",
                  boxShadow: "0 2px 4px rgba(64, 158, 255, 0.3)",
                }}
              />
              <Text
                style={{
                  color: "#6b7280",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                显示{" "}
                <span style={{ color: "#409EFF", fontWeight: 600 }}>
                  {filteredVMs.length}
                </span>{" "}
                / 共{" "}
                <span style={{ color: "#1f2937", fontWeight: 600 }}>
                  {totalVMs}
                </span>{" "}
                个应用
              </Text>
            </div>
          </div>
          {loading ? (
            <div className={styles.loadingContainer}>
              {/* 动态旋转加载图标 */}
              <div className={styles.loadingSpinner}>
                {/* 外圈旋转 */}
                <div className={styles.loadingSpinnerOuter} />
                {/* 内圈旋转（反向） */}
                <div className={styles.loadingSpinnerInner} />
                {/* 中心脉冲点 */}
                <div className={styles.loadingSpinnerCenter} />
              </div>

              {/* 动态加载文字 */}
              <div className={styles.loadingText}>
                <span>加载中</span>
                <span
                  className={styles.loadingDot}
                  style={{ animationDelay: "0s" }}
                >
                  .
                </span>
                <span
                  className={styles.loadingDot}
                  style={{ animationDelay: "0.2s" }}
                >
                  .
                </span>
                <span
                  className={styles.loadingDot}
                  style={{ animationDelay: "0.4s" }}
                >
                  .
                </span>
              </div>

              {/* 进度条动画 */}
              <div className={styles.loadingProgressBar}>
                <div className={styles.loadingProgressBarFill} />
              </div>
            </div>
          ) : filteredVMs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px",
                color: "#6b7280",
                fontSize: "16px",
              }}
            >
              <CloudServerOutlined
                style={{
                  fontSize: "48px",
                  marginBottom: "16px",
                  color: "#d1d5db",
                  display: "block",
                  margin: "0 auto 16px",
                }}
              />
              {bestHostIp ? "暂无 VM 数据" : "请先设置最佳主机 IP"}
            </div>
          ) : (
            <Row gutter={[24, 24]}>
              {filteredVMs.map((vm) => (
                <Col xs={24} sm={24} md={8} lg={8} xl={8} key={vm.id}>
                  <Card
                    className={styles.portalCard}
                    style={{
                      height: "100%",
                      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "16px",
                      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
                      cursor: "pointer",
                    }}
                    styles={{
                      body: {
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                        padding: "24px",
                      },
                    }}
                    hoverable
                    onClick={() => {
                      router.push(`/developers/start/${vm.id}`);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform =
                        "translateY(-8px) scale(1.02)";
                      e.currentTarget.style.boxShadow =
                        "0 12px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px #e5e7eb";
                      e.currentTarget.style.borderColor = "#d1d5db";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform =
                        "translateY(0) scale(1)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 16px rgba(0, 0, 0, 0.08)";
                      e.currentTarget.style.borderColor = "#e5e7eb";
                    }}
                  >
                    {/* Status indicator bar */}
                    {(() => {
                      const vmStatus = getVMStatus(vm);
                      const statusConfig = getStatusConfig(vmStatus);
                      return (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "4px",
                            background: statusConfig.barColor,
                            opacity: vmStatus === "running" ? 0.9 : 0.7,
                            transition: "opacity 0.3s ease",
                            boxShadow: statusConfig.barShadow,
                          }}
                        />
                      );
                    })()}

                    {/* Card Header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "20px",
                        paddingTop: "8px",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {(() => {
                          const vmStatus = getVMStatus(vm);
                          const statusConfig = getStatusConfig(vmStatus);
                          const StatusIcon = statusConfig.icon;
                          return (
                            <div
                              style={{
                                width: "44px",
                                height: "44px",
                                borderRadius: "12px",
                                background: statusConfig.iconBg,
                                border: statusConfig.iconBorder,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                boxShadow: statusConfig.iconShadow,
                              }}
                            >
                              <CloudServerOutlined
                                style={{
                                  fontSize: "22px",
                                  color: statusConfig.iconColor,
                                }}
                              />
                            </div>
                          );
                        })()}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Title
                            level={5}
                            style={{
                              color: "#1f2937",
                              margin: 0,
                              fontSize: "16px",
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              lineHeight: "1.4",
                            }}
                          >
                            {getVmDisplayName(vm)}
                          </Title>
                        </div>
                      </div>
                      {(() => {
                        const vmStatus = getVMStatus(vm);
                        const statusConfig = getStatusConfig(vmStatus);
                        const StatusIcon = statusConfig.icon;
                        return (
                          <div
                            style={{
                              background: statusConfig.bgColor,
                              border: "none",
                              borderRadius: "8px",
                              padding: "6px 14px",
                              fontSize: "12px",
                              margin: 0,
                              fontWeight: 600,
                              flexShrink: 0,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "8px",
                              color: statusConfig.color,
                              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                              transition: "all 0.3s ease",
                            }}
                          >
                            <StatusIcon
                              style={{
                                fontSize: "14px",
                                color: statusConfig.iconColor,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            />
                            <span style={{ color: statusConfig.color }}>
                              {statusConfig.text}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Info Sections */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        marginBottom: "16px",
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                      }}
                    >
                      {/* VM ID Section */}
                      <div
                        style={{
                          padding: "12px",
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: "10px",
                          transition: "all 0.3s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f3f4f6";
                          e.currentTarget.style.borderColor = "#d1d5db";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#f9fafb";
                          e.currentTarget.style.borderColor = "#e5e7eb";
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            overflow: "hidden",
                          }}
                        >
                          <SafetyOutlined
                            style={{
                              fontSize: "14px",
                              color: "#22c55e",
                              flexShrink: 0,
                            }}
                          />
                          <Text
                            style={{
                              color: "#6b7280",
                              fontSize: "11px",
                              fontWeight: 500,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              flexShrink: 0,
                              whiteSpace: "nowrap",
                            }}
                          >
                            VM ID:
                          </Text>
                          <Text
                            style={{
                              color: "#1f2937",
                              fontSize: "12px",
                              fontFamily: "monospace",
                              fontWeight: 500,
                              letterSpacing: "0.3px",
                              flex: 1,
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {vm.id}
                          </Text>
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(vm.instance_id || vm.id, "VM ID");
                            }}
                            style={{
                              color: "#9ca3af",
                              padding: "2px 6px",
                              minWidth: "auto",
                              height: "auto",
                              transition: "all 0.2s ease",
                              flexShrink: 0,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#22c55e";
                              e.currentTarget.style.transform = "scale(1.15)";
                              e.currentTarget.style.background = "#dcfce7";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "#9ca3af";
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.background = "transparent";
                            }}
                          />
                        </div>
                      </div>

                      {/* Divider line */}
                      {vm.app_id && (
                        <div
                          style={{
                            height: "1px",
                            background: "#e5e7eb",
                            margin: "4px 0",
                          }}
                        />
                      )}

                      {/* App ID Section */}
                      {vm.app_id && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            width: "100%",
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: "12px",
                              background: "#f9fafb",
                              borderRadius: "10px",
                              transition: "all 0.3s ease",
                              overflow: "hidden",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#f3f4f6";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#f9fafb";
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                overflow: "hidden",
                                width: "100%",
                              }}
                            >
                              <GlobalOutlined
                                style={{
                                  fontSize: "14px",
                                  color: "#3b82f6",
                                  flexShrink: 0,
                                }}
                              />
                              <Text
                                style={{
                                  color: "#6b7280",
                                  fontSize: "11px",
                                  fontWeight: 500,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                  flexShrink: 0,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                App ID:
                              </Text>
                              <Text
                                style={{
                                  color: "#1f2937",
                                  fontSize: "12px",
                                  fontFamily: "monospace",
                                  fontWeight: 500,
                                  letterSpacing: "0.3px",
                                  flex: 1,
                                  minWidth: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {vm.app_id}
                              </Text>
                            </div>
                          </div>
                          <Dropdown
                            menu={{
                              items: getMoreMenuItems(vm),
                              onClick: (menuInfo) => {
                                handleMenuClick(vm, menuInfo.key as string, menuInfo);
                              },
                              style: {
                                padding: "8px",
                                minWidth: "160px",
                              },
                            }}
                            trigger={["click"]}
                            placement="bottomRight"
                            overlayClassName="custom-dropdown-menu"
                          >
                            <Button
                              type="text"
                              icon={<MoreOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              style={{
                                color: "#6b7280",
                                padding: "8px",
                                borderRadius: "8px",
                                transition: "all 0.2s ease",
                                minWidth: "32px",
                                width: "32px",
                                height: "32px",
                                flexShrink: 0,
                                background: "transparent",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#f3f4f6";
                                e.currentTarget.style.color = "#1f2937";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                  "transparent";
                                e.currentTarget.style.color = "#6b7280";
                              }}
                            />
                          </Dropdown>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginTop: "auto",
                        // paddingTop: '16px'
                      }}
                    >
                      {vm.status?.toLowerCase() === "running" && vm.uptime ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 12px",
                            background: "#f9fafb",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            color: "#6b7280",
                            fontSize: "12px",
                            fontWeight: 500,
                            width: "fit-content",
                          }}
                        >
                          <ClockCircleOutlined
                            style={{
                              fontSize: "14px",
                              color: "#9ca3af",
                            }}
                          />
                          <span>{vm.uptime}</span>
                        </div>
                      ) : null}
                      <Button
                        type="text"
                        icon={<FileTextOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          showLog(vm.id);
                        }}
                        style={{
                          width: "fit-content",
                          color: "#6b7280",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          padding: "6px 12px",
                          height: "auto",
                          transition: "all 0.3s ease",
                          background: "#f9fafb",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f3f4f6";
                          e.currentTarget.style.borderColor = "#d1d5db";
                          e.currentTarget.style.color = "#3b82f6";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#f9fafb";
                          e.currentTarget.style.borderColor = "#e5e7eb";
                          e.currentTarget.style.color = "#6b7280";
                        }}
                      >
                        日志
                      </Button>
                      {/* {dashboardAvailable(vm) && (
                        <Button
                          type="text"
                          icon={<DashboardOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            showDashboard(vm);
                          }}
                          style={{
                            width: "fit-content",
                            color: "#6b7280",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            padding: "6px 12px",
                            height: "auto",
                            transition: "all 0.3s ease",
                            background: "#f9fafb",
                            fontSize: "12px",
                            fontWeight: 500,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#f3f4f6";
                            e.currentTarget.style.borderColor = "#d1d5db";
                            e.currentTarget.style.color = "#22c55e";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#f9fafb";
                            e.currentTarget.style.borderColor = "#e5e7eb";
                            e.currentTarget.style.color = "#6b7280";
                          }}
                        >
                          Dashboard
                        </Button>
                      )} */}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </section>
      </div>

      {/* 部署对话框 */}
      <Modal
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "0",
            }}
          >
            <CloudServerOutlined
              style={{
                fontSize: "20px",
                color: "#3b82f6",
              }}
            />
            <Title
              level={4}
              style={{
                margin: 0,
                color: "#111827",
                fontWeight: 600,
                fontSize: "20px",
                letterSpacing: "-0.3px",
              }}
            >
              部署新实例
            </Title>
          </div>
        }
        open={showDeployModal}
        onCancel={() => setShowDeployModal(false)}
        width={900}
        footer={null}
        style={{ top: 20 }}
        styles={{
          content: {
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            boxShadow:
              "0 20px 60px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)",
            overflow: "hidden",
            overflowX: "hidden",
          },
          header: {
            background: "transparent",
            borderBottom: "1px solid #f3f4f6",
            padding: "24px 32px",
            borderRadius: "16px 16px 0 0",
            position: "relative",
          },
          body: {
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
            overflowX: "hidden",
            padding: "32px",
            background: "transparent",
          },
          mask: {
            backdropFilter: "blur(4px)",
            background: "rgba(0, 0, 0, 0.45)",
          },
        }}
        closeIcon={
          <div
            style={{
              color: "#6b7280",
              fontSize: "20px",
              transition: "all 0.2s ease",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              background: "transparent",
              border: "1px solid transparent",
              cursor: "pointer",
              lineHeight: "1",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f3f4f6";
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.color = "#111827";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.color = "#6b7280";
            }}
          >
            ×
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={createVm}
          style={{ maxWidth: "100%", overflowX: "hidden" }}
          initialValues={{
            vcpu: 1,
            memoryValue: 2,
            memoryUnit: "GB",
            disk_size: 20,
            kms_enabled: true,
            gateway_enabled: true,
            public_logs: true,
            public_sysinfo: true,
            public_tcbinfo: true,
            ports: [],
            encryptedEnvs: [],
            docker_config: { enabled: false, username: "", token_key: "" },
          }}
        >
          {/* 基本信息分组 */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "20px",
                paddingBottom: "16px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <FileTextOutlined
                style={{ fontSize: "16px", color: "#3b82f6" }}
              />
              <Title
                level={5}
                style={{
                  margin: 0,
                  color: "#111827",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                基本信息
              </Title>
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="名称"
                  name="name"
                  rules={[{ required: true, message: "请输入 VM 名称" }]}
                >
                  <Input placeholder="输入 VM 名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="镜像"
                  name="image"
                  rules={[{ required: true, message: "请选择镜像" }]}
                >
                  <Select placeholder="选择镜像" showSearch>
                    {availableImages.map((img) => (
                      <Select.Option key={img.name} value={img.name}>
                        {img.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  label="vCPU 数量"
                  name="vcpu"
                  rules={[{ required: true, message: "请输入 vCPU 数量" }]}
                >
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="内存"
                  name="memoryValue"
                  rules={[{ required: true, message: "请输入内存大小" }]}
                >
                  <InputNumber min={1} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="内存单位" name="memoryUnit">
                  <Select>
                    <Select.Option value="MB">MB</Select.Option>
                    <Select.Option value="GB">GB</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="磁盘大小 (GB)"
              name="disk_size"
              rules={[{ required: true, message: "请输入磁盘大小" }]}
            >
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          </div>

          {/* Docker Compose 配置分组 */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "20px",
                paddingBottom: "16px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <ThunderboltOutlined
                style={{ fontSize: "16px", color: "#3b82f6" }}
              />
              <Title
                level={5}
                style={{
                  margin: 0,
                  color: "#111827",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                Docker Compose 配置
              </Title>
            </div>
            <Form.Item
              label="Docker Compose 文件"
              name="dockerComposeFile"
              rules={[
                { required: true, message: "请输入 Docker Compose 文件内容" },
              ]}
            >
              <div>
                <Upload
                  accept=".yml,.yaml,.txt"
                  beforeUpload={(file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      const content = e.target?.result as string;
                      form.setFieldValue("dockerComposeFile", content);
                    };
                    reader.readAsText(file);
                    return false; // 阻止自动上传
                  }}
                  showUploadList={false}
                >
                  <Button
                    icon={<UploadOutlined />}
                    style={{
                      marginBottom: 12,
                      background: "#ffffff",
                      border: "1px solid #d1d5db",
                      color: "#374151",
                      borderRadius: "8px",
                      height: "40px",
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f9fafb";
                      e.currentTarget.style.borderColor = "#3b82f6";
                      e.currentTarget.style.color = "#3b82f6";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#ffffff";
                      e.currentTarget.style.borderColor = "#d1d5db";
                      e.currentTarget.style.color = "#374151";
                    }}
                  >
                    上传文件
                  </Button>
                </Upload>
                <Form.Item name="dockerComposeFile" noStyle>
                  <Input.TextArea
                    rows={8}
                    placeholder="粘贴您的 docker-compose.yml 内容或使用上方按钮上传文件"
                    style={{
                      fontFamily: "monospace",
                      fontSize: "13px",
                      lineHeight: "1.6",
                    }}
                  />
                </Form.Item>
              </div>
            </Form.Item>
          </div>

          {availableGpus.length > 0 && (
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "24px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "20px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <ThunderboltOutlined
                  style={{ fontSize: "16px", color: "#3b82f6" }}
                />
                <Title
                  level={5}
                  style={{
                    margin: 0,
                    color: "#111827",
                    fontSize: "15px",
                    fontWeight: 600,
                  }}
                >
                  GPU 配置
                </Title>
              </div>
              {allowAttachAllGpus && (
                <Form.Item
                  name="attachAllGpus"
                  valuePropName="checked"
                  style={{ marginBottom: 16 }}
                >
                  <Checkbox>附加所有 GPU 和 NVSwitch</Checkbox>
                </Form.Item>
              )}
              {!form.getFieldValue("attachAllGpus") && (
                <Form.Item label="选择 GPU" name="selectedGpus">
                  <Select mode="multiple" placeholder="选择要附加的 GPU">
                    {availableGpus.map((gpu) => (
                      <Select.Option key={gpu.slot} value={gpu.slot}>
                        {gpu.slot}: {gpu.description}{" "}
                        {gpu.is_free ? "" : "(使用中)"}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )}
            </div>
          )}

          {/* 高级配置分组 */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "20px",
                paddingBottom: "16px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <SafetyOutlined
                style={{ fontSize: "16px", color: "#3b82f6" }}
              />
              <Title
                level={5}
                style={{
                  margin: 0,
                  color: "#111827",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                高级配置
              </Title>
            </div>
            <Form.Item label="App ID (可选)" name="app_id">
              <Input placeholder="将根据配置自动生成" />
            </Form.Item>

            <Form.Item label="预启动脚本" name="preLaunchScript">
              <Input.TextArea
                rows={6}
                placeholder="可选：在启动容器之前运行的 Bash 脚本"
                style={{
                  fontFamily: "monospace",
                  fontSize: "13px",
                  lineHeight: "1.6",
                }}
              />
            </Form.Item>

            <Form.Item label="用户配置" name="user_config">
              <Input.TextArea
                rows={4}
                placeholder="可选：将放置在 CVM 中 /dstack/.user-config 的用户配置"
                style={{
                  fontFamily: "monospace",
                  fontSize: "13px",
                  lineHeight: "1.6",
                }}
              />
            </Form.Item>
          </div>

          {portMappingEnabled && (
            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "24px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "20px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <GlobalOutlined
                  style={{ fontSize: "16px", color: "#3b82f6" }}
                />
                <Title
                  level={5}
                  style={{
                    margin: 0,
                    color: "#111827",
                    fontSize: "15px",
                    fontWeight: 600,
                  }}
                >
                  端口映射
                </Title>
              </div>
              <Form.Item label="端口映射" name="ports">
                <Form.List name="ports">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }) => (
                        <Space
                          key={key}
                          style={{ display: "flex", marginBottom: 12 }}
                          align="baseline"
                        >
                          <Form.Item
                            {...restField}
                            name={[name, "protocol"]}
                            rules={[{ required: true }]}
                          >
                            <Select style={{ width: 90 }}>
                              <Select.Option value="tcp">TCP</Select.Option>
                              <Select.Option value="udp">UDP</Select.Option>
                            </Select>
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, "host_address"]}
                            rules={[{ required: true }]}
                          >
                            <Select style={{ width: 110 }}>
                              <Select.Option value="127.0.0.1">
                                本地
                              </Select.Option>
                              <Select.Option value="0.0.0.0">
                                公开
                              </Select.Option>
                            </Select>
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, "host_port"]}
                            rules={[{ required: true }]}
                          >
                            <InputNumber
                              placeholder="主机端口"
                              style={{ width: 130 }}
                            />
                          </Form.Item>
                          <Form.Item
                            {...restField}
                            name={[name, "vm_port"]}
                            rules={[{ required: true }]}
                          >
                            <InputNumber
                              placeholder="VM 端口"
                              style={{ width: 130 }}
                            />
                          </Form.Item>
                          <Button
                            type="text"
                            icon={<MinusCircleOutlined />}
                            onClick={() => remove(name)}
                            style={{
                              color: "#ef4444",
                              padding: "4px 8px",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "#dc2626";
                              e.currentTarget.style.background = "#fef2f2";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "#ef4444";
                              e.currentTarget.style.background = "transparent";
                            }}
                          />
                        </Space>
                      ))}
                      <Form.Item>
                        <Button
                          type="dashed"
                          onClick={() => add()}
                          block
                          icon={<PlusOutlined />}
                          style={{
                            height: "40px",
                            borderRadius: "10px",
                            fontWeight: 500,
                          }}
                        >
                          添加端口映射
                        </Button>
                      </Form.Item>
                    </>
                  )}
                </Form.List>
              </Form.Item>
            </div>
          )}

          {/* 功能特性分组 */}
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "20px",
                paddingBottom: "16px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <DashboardOutlined
                style={{ fontSize: "16px", color: "#3b82f6" }}
              />
              <Title
                level={5}
                style={{
                  margin: 0,
                  color: "#111827",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                功能特性
              </Title>
            </div>
            <Form.Item label="功能特性">
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Form.Item name="kms_enabled" valuePropName="checked" noStyle>
                    <Checkbox>KMS</Checkbox>
                  </Form.Item>
                </Col>
                {/* <Col span={8}>
                  <Form.Item
                    name="local_key_provider_enabled"
                    valuePropName="checked"
                    noStyle
                  >
                    <Checkbox>本地密钥提供者</Checkbox>
                  </Form.Item>
                </Col> */}
                <Col span={8}>
                  <Form.Item
                    name="gateway_enabled"
                    valuePropName="checked"
                    noStyle
                  >
                    <Checkbox>Dstack Gateway</Checkbox>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="public_logs" valuePropName="checked" noStyle>
                    <Checkbox>公开日志</Checkbox>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="public_sysinfo"
                    valuePropName="checked"
                    noStyle
                  >
                    <Checkbox>公开系统信息</Checkbox>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="public_tcbinfo"
                    valuePropName="checked"
                    noStyle
                  >
                    <Checkbox>公开 TCB 信息</Checkbox>
                  </Form.Item>
                </Col>
                {/* <Col span={8}>
                  <Form.Item name="pin_numa" valuePropName="checked" noStyle>
                    <Checkbox>NUMA 绑定</Checkbox>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="hugepages" valuePropName="checked" noStyle>
                    <Checkbox>Hugepages</Checkbox>
                  </Form.Item>
                </Col> */}
              </Row>
            </Form.Item>
          </div>

          {/* KMS 和安全配置分组 */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.kms_enabled !== currentValues.kms_enabled ||
              prevValues.docker_config?.enabled !==
                currentValues.docker_config?.enabled
            }
          >
            {({ getFieldValue }) => {
              const kmsEnabled = getFieldValue("kms_enabled");
              const dockerConfigEnabled = getFieldValue([
                "docker_config",
                "enabled",
              ]);
              return (
                kmsEnabled && (
                  <div
                    style={{
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "24px",
                      marginBottom: "20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "20px",
                        paddingBottom: "16px",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      <SafetyOutlined
                        style={{ fontSize: "16px", color: "#3b82f6" }}
                      />
                      <Title
                        level={5}
                        style={{
                          margin: 0,
                          color: "#111827",
                          fontSize: "15px",
                          fontWeight: 600,
                        }}
                      >
                        KMS 和安全配置
                      </Title>
                    </div>
                    <Form.Item
                      label="密钥提供者 ID (可选)"
                      name="key_provider_id"
                      style={{ marginBottom: 20 }}
                    >
                      <Input placeholder="如果要绑定到特定的密钥提供者，请输入密钥提供者 ID" />
                    </Form.Item>
                    {/* <Form.Item
                      name={["docker_config", "enabled"]}
                      valuePropName="checked"
                      style={{ marginBottom: 16 }}
                    >
                      <Checkbox>Docker 镜像仓库登录</Checkbox>
                    </Form.Item> */}
                    {dockerConfigEnabled && (
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label="用户名"
                            name={["docker_config", "username"]}
                          >
                            <Input placeholder="Docker 镜像仓库用户名" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label="令牌密钥"
                            name={["docker_config", "token_key"]}
                          >
                            <Input placeholder="加密环境变量中的密钥名称" />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}
                  </div>
                )
              );
            }}
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.kms_enabled !== currentValues.kms_enabled
            }
          >
            {({ getFieldValue }) =>
              getFieldValue("kms_enabled") && (
                <div
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "24px",
                    marginBottom: "20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "20px",
                      paddingBottom: "16px",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <SafetyOutlined
                      style={{ fontSize: "16px", color: "#3b82f6" }}
                    />
                    <Title
                      level={5}
                      style={{
                        margin: 0,
                        color: "#111827",
                        fontSize: "15px",
                        fontWeight: 600,
                      }}
                    >
                      加密环境变量
                    </Title>
                  </div>
                  <Form.Item label="加密环境变量" name="encryptedEnvs">
                    <Form.List name="encryptedEnvs">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name, ...restField }) => (
                            <Space
                              key={key}
                              style={{ display: "flex", marginBottom: 12 }}
                              align="baseline"
                            >
                              <Form.Item
                                {...restField}
                                name={[name, "key"]}
                                rules={[{ required: true }]}
                              >
                                <Input
                                  placeholder="变量名"
                                  style={{ width: 220 }}
                                />
                              </Form.Item>
                              <Form.Item
                                {...restField}
                                name={[name, "value"]}
                                rules={[{ required: true }]}
                              >
                                <Input.Password
                                  placeholder="值"
                                  style={{ flex: 1, minWidth: 200 }}
                                />
                              </Form.Item>
                              <Button
                                type="text"
                                icon={<MinusCircleOutlined />}
                                onClick={() => remove(name)}
                                style={{
                                  color: "#ef4444",
                                  padding: "4px 8px",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = "#dc2626";
                                  e.currentTarget.style.background = "#fef2f2";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "#ef4444";
                                  e.currentTarget.style.background =
                                    "transparent";
                                }}
                              />
                            </Space>
                          ))}
                          <Form.Item>
                            <Button
                              type="dashed"
                              onClick={() => add()}
                              block
                              icon={<PlusOutlined />}
                              style={{
                                height: "40px",
                                borderRadius: "10px",
                                fontWeight: 500,
                              }}
                            >
                              添加环境变量
                            </Button>
                          </Form.Item>
                        </>
                      )}
                    </Form.List>
                  </Form.Item>
                </div>
              )
            }
          </Form.Item>

          {composeHashPreview && (
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "10px",
                padding: "14px 16px",
                marginBottom: "20px",
              }}
            >
              <Text
                style={{
                  color: "#374151",
                  fontSize: "12px",
                  fontWeight: 500,
                  marginBottom: "8px",
                  display: "block",
                }}
              >
                Compose Hash
              </Text>
              <Text
                code
                style={{
                  // background: "#ffffff",
                  border: "1px solid #dbeafe",
                  color: "#3b82f6",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  display: "inline-block",
                }}
              >
                0x{composeHashPreview}
              </Text>
            </div>
          )}

          {/* 底部操作按钮 */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              paddingTop: "24px",
              borderTop: "1px solid #e5e7eb",
              marginTop: "8px",
            }}
          >
            <Button
              onClick={() => setShowDeployModal(false)}
              style={{
                background: "#ffffff",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 500,
                height: "44px",
                color: "#374151",
                transition: "all 0.2s ease",
                minWidth: "100px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f9fafb";
                e.currentTarget.style.borderColor = "#9ca3af";
                e.currentTarget.style.color = "#111827";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#d1d5db";
                e.currentTarget.style.color = "#374151";
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={deployLoading}
              // icon={<CloudServerOutlined />}
              style={{
                background: "#3b82f6",
                border: "none",
                borderRadius: "8px",
                padding: "10px 28px",
                fontSize: "14px",
                fontWeight: 500,
                height: "44px",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)",
                transition: "all 0.2s ease",
                color: "#fff",
                minWidth: "120px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#2563eb";
                e.currentTarget.style.boxShadow =
                  "0 6px 16px rgba(59, 130, 246, 0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#3b82f6";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(59, 130, 246, 0.25)";
              }}
            >
              部署
            </Button>
          </div>
        </Form>
      </Modal>
    </PortalLayout>
  );
}

export default function StartPage() {
  return (
    <DeveloperAuthGuard>
      <App>
        <StartPageContent />
      </App>
    </DeveloperAuthGuard>
  );
}