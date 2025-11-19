'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Col, Row, Typography, Tag, Input, Space, Dropdown, message, Modal, App, Form, Select, InputNumber, Checkbox, Upload } from 'antd';
import { x25519 } from '@noble/curves/ed25519.js';
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
    SettingOutlined,
    ApiOutlined,
    AppstoreOutlined,
    BulbOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from '../../portal.module.css';

const { Title, Text } = Typography;

const classicTheme = {
    background: '#f5f7fd',
    cardBg: '#ffffff',
    cardBorder: '#e2e8f0',
    textPrimary: '#0f172a',
    textMuted: '#64748b',
    highlight: '#0f172a',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primarySoft: 'rgba(59, 130, 246, 0.14)',
    chipBg: '#e3edff',
    success: '#22c55e',
    warning: '#fbbf24',
    caution: '#fb923c',
    danger: '#f87171',
    neutral: '#94a3b8'
};

const statusPalette = {
    success: {
        base: classicTheme.success,
        bar: '#1a9a58',
        bg: 'rgba(39, 194, 108, 0.18)',
        barShadow: '0 4px 14px rgba(39, 194, 108, 0.3)',
        iconBg: 'rgba(39, 194, 108, 0.16)',
        iconBorder: '1px solid rgba(39, 194, 108, 0.28)',
        iconShadow: '0 6px 16px rgba(39, 194, 108, 0.22)'
    },
    warning: {
        base: classicTheme.warning,
        bar: '#e99e2a',
        bg: 'rgba(255, 181, 71, 0.2)',
        barShadow: '0 4px 14px rgba(255, 181, 71, 0.32)',
        iconBg: 'rgba(255, 181, 71, 0.18)',
        iconBorder: '1px solid rgba(255, 181, 71, 0.32)',
        iconShadow: '0 6px 16px rgba(255, 181, 71, 0.25)'
    },
    caution: {
        base: classicTheme.caution,
        bar: '#d67f12',
        bg: 'rgba(255, 159, 28, 0.18)',
        barShadow: '0 4px 14px rgba(255, 159, 28, 0.3)',
        iconBg: 'rgba(255, 159, 28, 0.16)',
        iconBorder: '1px solid rgba(255, 159, 28, 0.28)',
        iconShadow: '0 6px 16px rgba(255, 159, 28, 0.24)'
    },
    danger: {
        base: classicTheme.danger,
        bar: '#e04753',
        bg: 'rgba(255, 90, 101, 0.2)',
        barShadow: '0 4px 14px rgba(255, 90, 101, 0.32)',
        iconBg: 'rgba(255, 90, 101, 0.18)',
        iconBorder: '1px solid rgba(255, 90, 101, 0.28)',
        iconShadow: '0 6px 16px rgba(255, 90, 101, 0.24)'
    },
    neutral: {
        base: classicTheme.neutral,
        bar: '#3a4252',
        bg: 'rgba(75, 85, 103, 0.18)',
        barShadow: '0 4px 14px rgba(75, 85, 103, 0.28)',
        iconBg: 'rgba(75, 85, 103, 0.16)',
        iconBorder: '1px solid rgba(75, 85, 103, 0.28)',
        iconShadow: '0 6px 16px rgba(75, 85, 103, 0.22)'
    }
};

const panelBackground = '#ffffff';
const panelBorder = '#e2e8f0';
const panelDivider = '#edf2f7';

// 默认主机 IP，当 localStorage 中没有 bestHostIp 时使用
export const DEFAULT_BEST_HOST_IP = process.env.NEXT_PUBLIC_DEFAULT_HOST_IP || '43.132.154.142';

interface CVMData {
    id: string;
    name: string;
    identifier: string;
    uuid: string;
    status: 'STOPPED' | 'RUNNING';
    region: string;
    size: string;
    type: 'classic';
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
    boot_error?: string;
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
    protocol: 'tcp' | 'udp';
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
    memoryUnit: 'MB' | 'GB';
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
        id: '1',
        name: 'newdstackteev102',
        identifier: '382f2dd3eae1504c7733640fc5a3ee43538a19f1',
        uuid: '4f3ceae2-f9be-451b-84df-915eab6d3284',
        status: 'STOPPED',
        region: 'prod8-v03x',
        size: 'tdx.small',
        type: 'classic'
    },
    {
        id: '2',
        name: 'newdstackteev102',
        identifier: '3eaff6ff06f6c4294a835d3f34d3b59f4e99796b',
        uuid: '77e92068-9a42-47ce-8e7a-5f95e20eee99',
        status: 'STOPPED',
        region: 'prod5',
        size: 'tdx.small',
        type: 'classic'
    },
    {
        id: '3',
        name: 'testbridge106',
        identifier: '4cb6751f32d5f8ac972693658407881dd544e279',
        uuid: 'ba3c63e4-3114-445a-a426-94d091800f4c',
        status: 'STOPPED',
        region: 'prod5',
        size: 'tdx.small',
        type: 'classic'
    }
];

// RPC 调用函数 - 通过代理API避免CORS问题
export const rpcCall = async (bestHostIp: string, method: string, params?: any): Promise<Response> => {
    // 使用 Next.js API 路由作为代理，避免 CORS 问题
    const port = '9210'; // 后端端口
    const proxyUrl = `/api/vm-rpc?host=${encodeURIComponent(bestHostIp)}&method=${encodeURIComponent(method)}&port=${encodeURIComponent(port)}`;
    console.log('通过代理调用 RPC:', proxyUrl);
    
    const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
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
    const response = await rpcCall(bestHostIp, 'Status', {
        brief: options?.brief ?? true,
        keyword: options?.keyword || '',
        page: options?.page || 1,
        page_size: options?.page_size || 50,
        ...(options?.ids && { ids: options.ids }),
    });

    return await response.json();
};

function StartPageContent() {
    const { modal } = App.useApp();
    const router = useRouter();
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState('');
    const [cvms] = useState<CVMData[]>(mockCVMData);
    const [bestHostIp, setBestHostIp] = useState<string | null>(null);
    const [vms, setVms] = useState<VMData[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalVMs, setTotalVMs] = useState(0);
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [availableImages, setAvailableImages] = useState<ImageData[]>([]);
    const [availableGpus, setAvailableGpus] = useState<GpuData[]>([]);
    const [allowAttachAllGpus, setAllowAttachAllGpus] = useState(false);
    const [portMappingEnabled, setPortMappingEnabled] = useState(false);
    const [composeHashPreview, setComposeHashPreview] = useState('');
    const [deployLoading, setDeployLoading] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedVM, setSelectedVM] = useState<VMData | null>(null);
    const [vmDetails, setVmDetails] = useState<any | null>(null);
    const [networkInfo, setNetworkInfo] = useState<any | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        // 从 localStorage 读取 bestHostIp，读取不到时使用默认 IP
        const storedBestHostIp = localStorage.getItem('bestHostIp');
        if (storedBestHostIp) {
            setBestHostIp(storedBestHostIp);
        } else {
            setBestHostIp(DEFAULT_BEST_HOST_IP);
        }
    }, []);

    const fetchVMList = useCallback(async (showLoading: boolean = true) => {
        if (!bestHostIp) return;

        if (showLoading) {
            setLoading(true);
        }
        try {
            const data = await loadVMList(bestHostIp, {
                brief: true,
                keyword: searchText,
                page: 1,
                page_size: 50,
            });
            setVms(data.vms || []);
            setTotalVMs(data.total || data.vms?.length || 0);
            setPortMappingEnabled(data.port_mapping_enabled || false);
        } catch (error) {
            console.error('Error loading VM list:', error);
            message.error('获取 VM 列表失败');
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    }, [bestHostIp, searchText]);

    // 当 bestHostIp 或 searchText 变化时，加载 VM 列表
    useEffect(() => {
        if (bestHostIp) {
            fetchVMList();
        }
    }, [bestHostIp, fetchVMList]);

    // 自动刷新 VM 列表（每 3 秒），实现 uptime 的实时更新
    // 自动刷新时不显示加载状态，避免页面闪烁
    useEffect(() => {
        if (!bestHostIp) return;

        const intervalId = setInterval(() => {
            fetchVMList(false); // 不显示加载状态
        }, 5000); // 每 5 秒刷新一次

        // 清理定时器
        return () => {
            clearInterval(intervalId);
        };
    }, [bestHostIp, fetchVMList]);

    const handleCopy = async (text: string, type: string) => {
        // 降级方案：使用 document.execCommand
        const fallbackCopy = (): boolean => {
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                const successful = document.execCommand('copy');
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
                    message.error('复制失败，请手动复制');
                }
            }
        } catch (err) {
            // 如果 Clipboard API 失败，尝试降级方案
            const successful = fallbackCopy();
            if (successful) {
                message.success(`${type} 已复制到剪贴板`);
            } else {
                message.error('复制失败，请手动复制');
            }
        }
    };

    // 显示日志，参考 console.html 的实现
    const showLog = (vmId: string, stream?: 'stderr') => {
        if (!bestHostIp) {
            message.warning('请先设置最佳主机 IP');
            return;
        }
        
        // 构建日志URL，参考 console.html 的实现
        // console.html 中使用: /logs?id=${id}&follow=true&ansi=false&lines=50
        // 这里需要通过 bestHostIp 来构建完整的URL，并添加端口号 9210
        const baseUrl = `http://${bestHostIp}:9210`;
        const logUrl = stream === 'stderr' 
            ? `${baseUrl}/logs?id=${vmId}&follow=true&ansi=false&lines=50&ch=stderr`
            : `${baseUrl}/logs?id=${vmId}&follow=true&ansi=false&lines=50`;
        
        // 在新窗口打开日志
        window.open(logUrl, '_blank');
    };

    // 显示 Dashboard，参考 console.html 的实现
    const showDashboard = (vm: VMData) => {
        if (vm.app_url) {
            window.open(vm.app_url, '_blank');
        } else {
            message.warning('该 VM 没有可用的 Dashboard URL');
        }
    };

    // 检查 Dashboard 是否可用，参考 console.html 的实现
    const dashboardAvailable = (vm: VMData): boolean => {
        return !!vm.app_url;
    };

    // 格式化内存
    const formatMemory = (memoryMB?: number): string => {
        if (!memoryMB) return 'N/A';
        if (memoryMB >= 1024) {
            return `${(memoryMB / 1024).toFixed(2)} GB`;
        }
        return `${memoryMB} MB`;
    };

    // 获取功能标志
    const getFlags = (vm: VMData): string => {
        if (!vm.appCompose) return 'None';
        const flags = [];
        if (vm.appCompose.kms_enabled) flags.push('KMS');
        if (vm.appCompose.gateway_enabled || vm.appCompose.tproxy_enabled) flags.push('Gateway');
        if (vm.appCompose.public_logs) flags.push('Public Logs');
        if (vm.appCompose.public_sysinfo) flags.push('Public SysInfo');
        if (vm.appCompose.public_tcbinfo) flags.push('Public TCB Info');
        return flags.length > 0 ? flags.join(', ') : 'None';
    };

    // 获取 VM 状态，参考 console.html 的逻辑
    const getVMStatus = (vm: VMData): string => {
        const status = vm.status?.toLowerCase() || '';
        
        // 如果状态不是 running，直接返回状态
        if (status !== 'running') {
            return status;
        }
        
        // 处理 running 状态的子状态
        if (vm.shutdown_progress) {
            return 'shutting down';
        }
        
        // 如果 boot_progress 是 'running'，表示 VM 在 dstack-vmm 启动前就已经在运行
        if (vm.boot_progress === 'running') {
            return 'running';
        }
        
        // 如果 boot_progress 不是 'done'，表示正在启动
        if (vm.boot_progress && vm.boot_progress !== 'done') {
            return 'booting';
        }
        
        return 'running';
    };

    type StatusPaletteEntry = typeof statusPalette[keyof typeof statusPalette];

    const buildStatusConfig = (
        palette: StatusPaletteEntry,
        icon: React.ComponentType<any>,
        text: string
    ) => ({
        color: palette.base,
        bgColor: palette.bg,
        iconColor: palette.base,
        barColor: palette.bar,
        barShadow: palette.barShadow,
        iconBg: palette.iconBg,
        iconBorder: palette.iconBorder,
        iconShadow: palette.iconShadow,
        icon,
        text
    });

    // 获取状态对应的颜色和样式
    const getStatusConfig = (status: string) => {
        const normalizedStatus = status.toLowerCase();
        
        switch (normalizedStatus) {
            case 'running':
                return buildStatusConfig(statusPalette.success, PauseOutlined, 'RUNNING');
            case 'booting':
                return buildStatusConfig(statusPalette.warning, ClockCircleOutlined, 'BOOTING');
            case 'shutting down':
            case 'stopping':
                return buildStatusConfig(statusPalette.caution, PauseCircleOutlined, 'SHUTTING DOWN');
            case 'stopped':
                return buildStatusConfig(statusPalette.danger, PauseCircleOutlined, 'STOPPED');
            case 'created':
                return buildStatusConfig(statusPalette.warning, ClockCircleOutlined, 'CREATED');
            case 'exited':
                return buildStatusConfig(statusPalette.neutral, PauseCircleOutlined, 'EXITED');
            default:
                return buildStatusConfig(
                    statusPalette.neutral,
                    PauseCircleOutlined,
                    status.toUpperCase()
                );
        }
    };

    // 启动 VM
    const startVm = async (vmId: string) => {
        if (!bestHostIp) {
            message.warning('请先设置最佳主机 IP');
            return;
        }
        try {
            await rpcCall(bestHostIp, 'StartVm', { id: vmId });
            message.success('VM 启动成功');
            fetchVMList(false);
        } catch (error) {
            console.error('Error starting VM:', error);
            message.error('启动 VM 失败');
        }
    };

    // 停止 VM (强制停止)
    const stopVm = async (vm: VMData) => {
        if (!bestHostIp) {
            message.warning('请先设置最佳主机 IP');
            return;
        }
        modal.confirm({
            title: '请确认是否强制停止 VM?',
            content: `您正在强制停止 "${vm.name}"，这可能会导致数据损坏。`,
            okText: '确认',
            cancelText: '取消',
            okType: 'danger',
            onOk: async () => {
                try {
                    await rpcCall(bestHostIp, 'StopVm', { id: vm.id });
                    message.success('VM 已停止');
                    fetchVMList(false);
                } catch (error) {
                    console.error('Error stopping VM:', error);
                    message.error('停止 VM 失败');
                }
            },
        });
    };

    // 优雅关闭 VM
    const shutdownVm = async (vmId: string) => {
        if (!bestHostIp) {
            message.warning('请先设置最佳主机 IP');
            return;
        }
        try {
            await rpcCall(bestHostIp, 'ShutdownVm', { id: vmId });
            message.success('VM 正在关闭');
            fetchVMList(false);
        } catch (error) {
            console.error('Error shutting down VM:', error);
            message.error('关闭 VM 失败');
        }
    };

    // 重启 VM (先停止再启动)
    const restartVm = async (vm: VMData) => {
        if (!bestHostIp) {
            message.warning('请先设置最佳主机 IP');
            return;
        }
        modal.confirm({
            title: '请确认是否重启 VM?',
            content: `您正在重启 "${vm.name}"。`,
            okText: '确认',
            cancelText: '取消',
            onOk: async () => {
                try {
                    // 先停止
                    await rpcCall(bestHostIp, 'StopVm', { id: vm.id });
                    // 等待一下再启动
                    setTimeout(async () => {
                        await rpcCall(bestHostIp, 'StartVm', { id: vm.id });
                        message.success('VM 重启成功');
                        fetchVMList(false);
                    }, 1000);
                } catch (error) {
                    console.error('Error restarting VM:', error);
                    message.error('重启 VM 失败');
                }
            },
        });
    };

    // 删除 VM
    const removeVm = async (vm: VMData) => {
        if (!bestHostIp) {
            message.warning('请先设置最佳主机 IP');
            return;
        }
        modal.confirm({
            title: '确认删除 VM',
            content: `您正在删除 "${vm.name}"。此操作无法撤销。`,
            okText: '确认删除',
            cancelText: '取消',
            okType: 'danger',
            onOk: async () => {
                try {
                    await rpcCall(bestHostIp, 'RemoveVm', { id: vm.id });
                    message.success('VM 已删除');
                    fetchVMList(false);
                } catch (error) {
                    console.error('Error removing VM:', error);
                    message.error('删除 VM 失败');
                }
            },
        });
    };

    // 加载镜像列表
    const loadImages = async () => {
        if (!bestHostIp) return;
        try {
            const response = await rpcCall(bestHostIp, 'ListImages');
            const data = await response.json();
            setAvailableImages(data.images || []);
        } catch (error) {
            console.error('Error loading images:', error);
            message.error('加载镜像列表失败');
        }
    };

    // 加载 GPU 列表
    const loadGpus = async () => {
        if (!bestHostIp) return;
        try {
            const response = await rpcCall(bestHostIp, 'ListGpus');
            const data = await response.json();
            setAvailableGpus(data.gpus || []);
            setAllowAttachAllGpus(data.allow_attach_all || false);
        } catch (error) {
            console.error('Error loading GPUs:', error);
            message.error('加载 GPU 列表失败');
        }
    };

    // 纯 JavaScript SHA-256 实现（作为后备）
    const sha256Fallback = (message: string): string => {
        const K = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];
        
        const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
        
        const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
        
        const bytes = new TextEncoder().encode(message);
        const bitLength = bytes.length * 8;
        const padding = new Uint8Array((64 - (bytes.length + 9) % 64) % 64);
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
                w[i] = (data[chunkStart + i * 4] << 24) | (data[chunkStart + i * 4 + 1] << 16) |
                       (data[chunkStart + i * 4 + 2] << 8) | data[chunkStart + i * 4 + 3];
            }
            
            for (let i = 16; i < 64; i++) {
                const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
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
        
        return H.map(h => h.toString(16).padStart(8, '0')).join('');
    };

    // 计算 Compose Hash
    const calcComposeHash = async (content: string): Promise<string> => {
        // 优先使用 Web Crypto API（如果可用）
        if (typeof window !== 'undefined') {
            const cryptoObj = window.crypto;
            if (cryptoObj && cryptoObj.subtle) {
                try {
                    const encoder = new TextEncoder();
                    const data = encoder.encode(content);
                    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                } catch (error) {
                    console.warn('Web Crypto API failed, using fallback:', error);
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
            docker_config: formData.docker_config.enabled ? {
                username: formData.docker_config.username,
                token_key: formData.docker_config.token_key,
            } : {},
            kms_enabled: formData.kms_enabled,
            gateway_enabled: formData.gateway_enabled,
            public_logs: formData.public_logs,
            public_sysinfo: formData.public_sysinfo,
            public_tcbinfo: formData.public_tcbinfo,
            local_key_provider_enabled: formData.local_key_provider_enabled,
            key_provider_id: formData.key_provider_id || undefined,
            allowed_envs: formData.encryptedEnvs.map(env => env.key),
            no_instance_id: !formData.gateway_enabled,
            secure_time: false,
        };

        if (formData.preLaunchScript?.trim()) {
            app_compose.pre_launch_script = formData.preLaunchScript;
        }

        // 如果设置了 APP_LAUNCH_TOKEN，添加其 sha256 hash
        const launchToken = formData.encryptedEnvs.find(env => env.key === 'APP_LAUNCH_TOKEN');
        if (launchToken) {
            app_compose.launch_token_hash = await calcComposeHash(launchToken.value);
        }

        // 兼容旧版本镜像
        const selectedImage = availableImages.find(img => img.name === formData.image);
        if (selectedImage?.version) {
            // 版本比较函数：判断 versionStr >= otherVersionStr
            const verGE = (versionStr: string, otherVersionStr: string): boolean => {
                const version = versionStr.split('.').map(Number);
                const otherVersion = otherVersionStr.split('.').map(Number);
                return version[0] > otherVersion[0] || 
                       (version[0] === otherVersion[0] && version[1] > otherVersion[1]) || 
                       (version[0] === otherVersion[0] && version[1] === otherVersion[1] && version[2] >= otherVersion[2]);
            };

            const versionStr = selectedImage.version;
            let composeVersion = 1;
            
            if (verGE(versionStr, '0.3.3')) {
                composeVersion = 2;
            }
            if (verGE(versionStr, '0.4.2')) {
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
    const encryptEnv = async (envs: EncryptedEnv[], hexPublicKey: string): Promise<string> => {
        try {
            // 确保 crypto API 可用
            const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
            if (!cryptoObj || !cryptoObj.subtle) {
                throw new Error('Web Crypto API is not available. Please ensure you are using HTTPS or localhost.');
            }
            
            // 将环境变量转换为 JSON 格式
            const envsJson = JSON.stringify({ env: envs });
            
            // 处理公钥格式（移除 0x 前缀）
            let processedPublicKey = hexPublicKey;
            if (processedPublicKey.startsWith('0x')) {
                processedPublicKey = processedPublicKey.slice(2);
            }
            
            // 将十六进制公钥转换为 Uint8Array
            const remotePubkey = new Uint8Array(
                processedPublicKey.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
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
                'raw',
                sharedKey,
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt']
            );
            
            // 生成随机 IV
            const iv = cryptoObj.getRandomValues(new Uint8Array(12));
            
            // 使用 AES-GCM 加密数据
            const encrypted = await cryptoObj.subtle.encrypt(
                { name: 'AES-GCM', iv },
                importedShared,
                new TextEncoder().encode(envsJson)
            );
            
            // 组合结果：临时公钥 + IV + 加密数据
            const result = new Uint8Array(
                ephemeralPublicKey.length + iv.length + encrypted.byteLength
            );
            result.set(ephemeralPublicKey, 0);
            result.set(iv, ephemeralPublicKey.length);
            result.set(new Uint8Array(encrypted), ephemeralPublicKey.length + iv.length);
            
            // 转换为十六进制字符串
            return Array.from(result)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch (error) {
            console.error('Error encrypting environment variables:', error);
            throw error;
        }
    };

    // 创建加密的环境变量
    const makeEncryptedEnv = async (envs: EncryptedEnv[], kmsEnabled: boolean, appId: string | null | undefined, formData?: VMFormData): Promise<string> => {
        if (!kmsEnabled || envs.length === 0 || !bestHostIp) return '';
        
        // 如果 appId 为空，自动计算（与 console.html 保持一致）
        let finalAppId = appId;
        if (!finalAppId && formData) {
            finalAppId = await calcAppId(formData);
        }
        
        if (!finalAppId) return '';
        
        try {
            const response = await rpcCall(bestHostIp, 'GetAppEnvEncryptPubKey', { app_id: finalAppId });
            const data = await response.json();
            return await encryptEnv(envs, data.public_key);
        } catch (error) {
            console.error('Error getting encrypt public key:', error);
            return '';
        }
    };

    // 配置 GPU
    const configGpu = (formData: VMFormData) => {
        if (formData.attachAllGpus) {
            return { attach_mode: 'all' };
        } else {
            const gpus = formData.selectedGpus?.length > 0
                ? formData.selectedGpus.map(slot => ({ slot }))
                : [];
            if (gpus.length === 0) {
                return null;
            }
            return {
                attach_mode: 'listed',
                gpus: gpus
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
            message.warning('请先设置最佳主机 IP');
            return;
        }
        setShowDeployModal(true);
        loadImages();
        loadGpus();
        
        // 重置表单
        form.setFieldsValue({
            name: '',
            image: undefined,
            dockerComposeFile: '',
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
            memoryUnit: 'GB',
            disk_size: 20,
            selectedGpus: [],
            attachAllGpus: false,
            ports: [],
            encryptedEnvs: [],
            docker_config: {
                enabled: false,
                username: '',
                token_key: ''
            },
            app_id: '',
            kms_enabled: true,
            local_key_provider_enabled: false,
            key_provider_id: '',
            gateway_enabled: true,
            public_logs: true,
            public_sysinfo: true,
            public_tcbinfo: true,
            pin_numa: false,
            hugepages: false,
            user_config: ''
        });
        setComposeHashPreview('');
    };

    // 创建 VM
    const createVm = async (values: any) => {
        if (!bestHostIp) {
            message.warning('请先设置最佳主机 IP');
            return;
        }

        setDeployLoading(true);
        try {
            // 转换内存单位
            const memory = values.memoryUnit === 'GB' ? values.memoryValue * 1024 : values.memoryValue;

            const formData: VMFormData = {
                ...values,
                memory,
            };

            // 创建 App Compose 文件
            const composeFile = await makeAppComposeFile(formData);

            // 计算 App ID（如果未提供）
            const appId = formData.app_id || await calcAppId(formData);

            // 创建加密的环境变量（与 console.html 保持一致：makeEncryptedEnv 内部会处理空 appId）
            const encryptedEnv = await makeEncryptedEnv(formData.encryptedEnvs, formData.kms_enabled, formData.app_id || null, formData);

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
                allowed_envs: formData.encryptedEnvs.map(env => env.key),
                encrypted_env: encryptedEnv,
                user_config: formData.user_config,
                ...(gpuConfig && { gpus: gpuConfig }),
                ...(portMappingEnabled && formData.ports?.length > 0 && {
                    ports: formData.ports.map(port => ({
                        host_address: port.host_address,
                        protocol: port.protocol,
                        host_port: port.host_port,
                        vm_port: port.vm_port
                    }))
                }),
                ...(formData.app_id && { app_id: formData.app_id })
            };

            // 调用 CreateVm RPC
            await rpcCall(bestHostIp, 'CreateVm', createParams);
            
            message.success('VM 创建成功');
            setShowDeployModal(false);
            fetchVMList(true);
        } catch (error: any) {
            console.error('Error creating VM:', error);
            message.error(`创建 VM 失败: ${error.message || '未知错误'}`);
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
                        name: values.name || '',
                        image: values.image || '',
                        dockerComposeFile: values.dockerComposeFile || '',
                        preLaunchScript: values.preLaunchScript || '',
                        vcpu: values.vcpu || 1,
                        memory: 0,
                        memoryValue: values.memoryValue || 2,
                        memoryUnit: values.memoryUnit || 'GB',
                        disk_size: values.disk_size || 20,
                        selectedGpus: values.selectedGpus || [],
                        attachAllGpus: values.attachAllGpus || false,
                        ports: values.ports || [],
                        encryptedEnvs: values.encryptedEnvs || [],
                        docker_config: values.docker_config || { enabled: false, username: '', token_key: '' },
                        app_id: values.app_id || '',
                        kms_enabled: values.kms_enabled !== false,
                        local_key_provider_enabled: values.local_key_provider_enabled || false,
                        key_provider_id: values.key_provider_id || '',
                        gateway_enabled: values.gateway_enabled !== false,
                        public_logs: values.public_logs !== false,
                        public_sysinfo: values.public_sysinfo !== false,
                        public_tcbinfo: values.public_tcbinfo !== false,
                        pin_numa: values.pin_numa || false,
                        hugepages: values.hugepages || false,
                        user_config: values.user_config || ''
                    };
                    const appCompose = await makeAppComposeFile(formData);
                    const hash = await calcComposeHash(appCompose);
                    setComposeHashPreview(hash);
                } else {
                    setComposeHashPreview('');
                }
            } catch (error) {
                console.error('Error calculating hash:', error);
                setComposeHashPreview('');
            }
        };

        // 使用防抖来避免频繁计算
        const timer = setTimeout(updateHash, 500);
        return () => clearTimeout(timer);
    }, [showDeployModal, watchedValues, availableImages]);

    // 获取菜单项，根据 VM 状态显示/隐藏
    const getMoreMenuItems = (vm: VMData) => {
        const renderMenuItem = (
            labelText: string,
            IconComponent: React.ComponentType<{ style?: React.CSSProperties }>,
            accentColor: string,
            accentBg: string
        ) => (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    width: '100%',
                    boxSizing: 'border-box',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    fontWeight: 500,
                    borderRadius: '10px',
                    background: accentBg,
                    color: classicTheme.textPrimary
                }}
            >
                <div
                    style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        border: '1px solid rgba(15, 23, 42, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        background: '#fff'
                    }}
                >
                    <IconComponent
                        style={{
                            fontSize: '16px',
                            color: accentColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    />
                </div>
                <span
                    style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: '14px'
                    }}
                >
                    {labelText}
                </span>
            </div>
        );

        const vmStatus = getVMStatus(vm);
        const isRunning = vmStatus === 'running' || vmStatus === 'booting';
        const isStopped = vmStatus === 'stopped' || vmStatus === 'exited' || vmStatus === 'created';

        const items = [];

        // 启动 - 只在停止状态显示（绿色，播放图标）
        if (isStopped) {
            items.push({
                key: 'start',
                label: renderMenuItem('Start', PlayCircleOutlined, classicTheme.success, statusPalette.success.bg),
                className: 'menu-item-start'
            });
        }

        // 关闭 - 只在运行状态显示（橙色，电源图标）
        if (isRunning) {
            items.push({
                key: 'shutdown',
                label: renderMenuItem('关闭', PoweroffOutlined, classicTheme.warning, statusPalette.warning.bg),
                className: 'menu-item-shutdown'
            });
        }

        // 停止（Kill）- 只在运行状态显示（紫色，暂停图标）
        if (isRunning) {
            items.push({
                key: 'stop',
                label: renderMenuItem('停止', StopOutlined, classicTheme.caution, statusPalette.caution.bg),
                className: 'menu-item-kill'
            });
        }

        // 删除（Remove）- 始终显示（橙色，垃圾桶图标）
        items.push({
            key: 'delete',
            label: renderMenuItem('删除', DeleteOutlined, classicTheme.danger, statusPalette.danger.bg),
            className: 'menu-item-remove'
        });

        return items;
    };

    // 处理菜单项点击
    const handleMenuClick = (vm: VMData, key: string) => {
        switch (key) {
            case 'start':
                startVm(vm.id);
                break;
            case 'shutdown':
                shutdownVm(vm.id);
                break;
            case 'stop':
                stopVm(vm);
                break;
            case 'restart':
                restartVm(vm);
                break;
            case 'delete':
                removeVm(vm);
                break;
            default:
                break;
        }
    };

    // 过滤 VM 列表
    const filteredVMs = vms.filter(vm => 
        vm.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        vm.app_id?.toLowerCase().includes(searchText.toLowerCase()) ||
        vm.instance_id?.toLowerCase().includes(searchText.toLowerCase()) ||
        vm.id?.toLowerCase().includes(searchText.toLowerCase())
    );
    // 采用门户首页的浅色主题，不再注入额外的下拉样式
return (
        <PortalLayout>
            <div 
                className={styles.portalContent}
                style={{
                    background: classicTheme.background
                }}
            >
                {/* Back to dashboard link */}
                <Link 
                    href="/developers" 
                    style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '10px',
                        color: classicTheme.primary,
                        textDecoration: 'none',
                        marginBottom: '40px',
                        fontSize: '14px',
                        fontWeight: 600,
                        padding: '8px 16px',
                        borderRadius: '999px',
                        background: classicTheme.primarySoft,
                        border: `1px solid ${classicTheme.cardBorder}`,
                        transition: 'all 0.3s ease',
                        boxShadow: '0 8px 18px rgba(15, 24, 40, 0.12)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = classicTheme.primaryHover;
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.borderColor = 'rgba(23, 59, 104, 0.4)';
                        e.currentTarget.style.transform = 'translateX(-4px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = classicTheme.primary;
                        e.currentTarget.style.background = classicTheme.primarySoft;
                        e.currentTarget.style.borderColor = classicTheme.cardBorder;
                        e.currentTarget.style.transform = 'translateX(0)';
                    }}
                >
                    <ArrowLeftOutlined />
                    <span>返回开发者中心</span>
                </Link>

                {/* Header Section */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '0px',
                    gap: '24px',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            marginBottom: '20px'
                        }}>
                            <div style={{
                                width: '4px',
                                height: '48px',
                                background: classicTheme.primary,
                                borderRadius: '2px',
                                boxShadow: '0 0 14px rgba(23, 59, 104, 0.4)'
                            }} />
                            <Title level={1} style={{ 
                                color: classicTheme.highlight, 
                                margin: 0,
                                fontSize: '42px',
                                fontWeight: 700,
                                letterSpacing: '-0.5px'
                            }}>
                                机密虚拟机列表{/* CVMs */}
                            </Title>
                        </div>
                        {bestHostIp && (
                            <div style={{ 
                                marginTop: '16px'
                            }}>
                                <div style={{ 
                                    padding: '10px 18px',
                                    background: classicTheme.chipBg,
                                    border: `1px solid ${classicTheme.cardBorder}`,
                                    borderRadius: '12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    width: 'fit-content',
                                    boxShadow: '0 12px 22px rgba(15, 24, 40, 0.08)',
                                    backdropFilter: 'blur(6px)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#fff';
                                    e.currentTarget.style.borderColor = classicTheme.primary;
                                    e.currentTarget.style.boxShadow = '0 16px 30px rgba(15, 24, 40, 0.15)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = classicTheme.chipBg;
                                    e.currentTarget.style.borderColor = classicTheme.cardBorder;
                                    e.currentTarget.style.boxShadow = '0 12px 22px rgba(15, 24, 40, 0.08)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                                >
                                    <ThunderboltOutlined style={{
                                        fontSize: '15px',
                                        color: classicTheme.primary,
                                        transition: 'all 0.3s ease',
                                        filter: 'drop-shadow(0 0 4px rgba(23, 60, 112, 0.25))'
                                    }} />
                                    <Text style={{ 
                                        color: classicTheme.textPrimary,
                                        fontSize: '13px',
                                        fontWeight: 600
                                    }}>
                                        最佳资源 IP: 
                                    </Text>
                                    <Text style={{ 
                                        color: classicTheme.primaryHover,
                                        fontSize: '13px',
                                        fontFamily: 'monospace',
                                        fontWeight: 700,
                                        letterSpacing: '0.5px'
                                    }}>
                                        {bestHostIp}
                                    </Text>
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<CopyOutlined />}
                                        onClick={() => handleCopy(bestHostIp, '最佳资源 IP')}
                                        style={{
                                            color: classicTheme.primary,
                                            padding: '0 6px',
                                            transition: 'all 0.2s ease',
                                            borderRadius: '6px'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'scale(1.15)';
                                            e.currentTarget.style.color = classicTheme.primaryHover;
                                            e.currentTarget.style.background = 'rgba(23, 59, 104, 0.12)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                            e.currentTarget.style.color = classicTheme.primary;
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <Space size="small" align="center" style={{ flexShrink: 0, alignSelf: bestHostIp ? 'flex-start' : 'center', marginTop: bestHostIp ? '64px' : '0' }}>
                        <Button
                            type="primary"
                            size="large"
                            onClick={showDeployDialog}
                            style={{
                                background: classicTheme.primary,
                                border: 'none',
                                borderRadius: '12px',
                                padding: '10px 18px',
                                fontSize: '15px',
                                fontWeight: 500,
                                width: '150px',
                                height: '43px',
                                boxShadow: '0 14px 28px rgba(20, 47, 83, 0.3)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                color: '#fff',
                                textShadow: 'none'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = classicTheme.primaryHover;
                                e.currentTarget.style.boxShadow = '0 18px 32px rgba(20, 47, 83, 0.4)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = classicTheme.primary;
                                e.currentTarget.style.boxShadow = '0 14px 28px rgba(20, 47, 83, 0.3)';
                                e.currentTarget.style.transform = 'translateY(0)';
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
                                color: classicTheme.textPrimary,
                                borderRadius: '50%',
                                width: '44px',
                                height: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: classicTheme.cardBg,
                                border: `1px solid ${classicTheme.cardBorder}`,
                                transition: 'all 0.3s ease',
                                boxShadow: '0 10px 20px rgba(15, 24, 40, 0.08)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e6ebf5';
                                e.currentTarget.style.borderColor = classicTheme.primary;
                                e.currentTarget.style.color = classicTheme.primary;
                                e.currentTarget.style.transform = 'rotate(180deg)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = classicTheme.cardBg;
                                e.currentTarget.style.borderColor = classicTheme.cardBorder;
                                e.currentTarget.style.color = classicTheme.textPrimary;
                                e.currentTarget.style.transform = 'rotate(0deg)';
                            }}
                        />                                    
                    </Space>
                </div>

                {/* CVM Cards Section */}
                <section className={styles.section}>
                    <div style={{ 
                        marginBottom: '24px',
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ 
                            display: 'flex',
                            gap: '20px',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            flex: 1,
                            justifyContent: 'flex-start'
                        }}>
                            <div className={styles.searchInputWrapper} style={{ flex: 1, minWidth: '250px', maxWidth: '400px' }}>
                                <Input
                                    placeholder="请输入要搜索的应用信息..."
                                    prefix={<SearchOutlined style={{ 
                                        color: classicTheme.primary, 
                                        fontSize: '16px'
                                    }} />}
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    style={{
                                        flex: 1,
                                        borderRadius: '12px',
                                        height: '48px',
                                        fontSize: '14px',
                                        paddingLeft: '16px',
                                        paddingRight: '16px'
                                    }}
                                />
                            </div>
                            {/* <Button
                                // icon={<FilterOutlined />}
                                style={{
                                    border: '1px solid rgba(24, 48, 80, 0.2)',
                                    background: '#f1f3f6',
                                    color: '#1d2538',
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
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <div style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: classicTheme.primary,
                                boxShadow: '0 0 6px rgba(23, 59, 104, 0.4)'
                            }} />
                            <Text style={{ 
                                color: classicTheme.textMuted,
                                fontSize: '14px',
                                fontWeight: 500
                            }}>
                                显示 <span style={{ color: classicTheme.primary, fontWeight: 600 }}>{filteredVMs.length}</span> / 共 <span style={{ color: classicTheme.textPrimary, fontWeight: 600 }}>{totalVMs}</span> 个应用
                            </Text>
                        </div>
                    </div>
                    {loading ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '80px 20px',
                            gap: '24px'
                        }}>
                            <div style={{
                                position: 'relative',
                                width: '64px',
                                height: '64px'
                            }}>
                                {/* 外层旋转环 */}
                                <div style={{
                                    position: 'absolute',
                                    width: '64px',
                                    height: '64px',
                                    border: `4px solid ${classicTheme.primary}20`,
                                    borderTopColor: classicTheme.primary,
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                                {/* 中层旋转环 */}
                                <div style={{
                                    position: 'absolute',
                                    width: '48px',
                                    height: '48px',
                                    top: '8px',
                                    left: '8px',
                                    border: `3px solid ${classicTheme.primary}15`,
                                    borderRightColor: classicTheme.primary,
                                    borderRadius: '50%',
                                    animation: 'spin 0.8s linear infinite reverse'
                                }} />
                                {/* 内层脉冲圆 */}
                                <div style={{
                                    position: 'absolute',
                                    width: '24px',
                                    height: '24px',
                                    top: '20px',
                                    left: '20px',
                                    background: classicTheme.primary,
                                    borderRadius: '50%',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                    boxShadow: `0 0 0 0 ${classicTheme.primary}40`
                                }} />
                                {/* 光晕效果 */}
                                <div style={{
                                    position: 'absolute',
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: `radial-gradient(circle, ${classicTheme.primary}20 0%, transparent 70%)`,
                                    animation: 'glow 2s ease-in-out infinite',
                                    top: '0',
                                    left: '0'
                                }} />
                            </div>
                            {/* 进度条 */}
                            <div style={{
                                width: '200px',
                                height: '4px',
                                background: `${classicTheme.primary}15`,
                                borderRadius: '2px',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    height: '100%',
                                    width: '40%',
                                    background: `linear-gradient(90deg, ${classicTheme.primary}, ${classicTheme.primaryHover}, ${classicTheme.primary})`,
                                    backgroundSize: '200% 100%',
                                    borderRadius: '2px',
                                    animation: 'shimmer 1.5s ease-in-out infinite'
                                }} />
                            </div>
                            <style jsx>{`
                                @keyframes spin {
                                    from { transform: rotate(0deg); }
                                    to { transform: rotate(360deg); }
                                }
                                @keyframes pulse {
                                    0%, 100% {
                                        transform: scale(1);
                                        opacity: 1;
                                        box-shadow: 0 0 0 0 ${classicTheme.primary}40;
                                    }
                                    50% {
                                        transform: scale(1.2);
                                        opacity: 0.8;
                                        box-shadow: 0 0 0 8px ${classicTheme.primary}00;
                                    }
                                }
                                @keyframes glow {
                                    0%, 100% {
                                        opacity: 0.5;
                                        transform: scale(1);
                                    }
                                    50% {
                                        opacity: 0.8;
                                        transform: scale(1.1);
                                    }
                                }
                                @keyframes shimmer {
                                    0% {
                                        background-position: -200% 0;
                                    }
                                    100% {
                                        background-position: 200% 0;
                                    }
                                }
                            `}</style>
                        </div>
                    ) : filteredVMs.length === 0 ? (
                        <div style={{ 
                            textAlign: 'center', 
                            padding: '60px', 
                            color: '#94a3b8',
                            fontSize: '16px'
                        }}>
                            <CloudServerOutlined style={{ 
                                fontSize: '48px', 
                                marginBottom: '16px',
                                color: '#cbd5f5',
                                display: 'block',
                                margin: '0 auto 16px'
                            }} />
                            {bestHostIp ? '暂无 VM 数据' : '请先设置最佳主机 IP'}
                        </div>
                    ) : (
                        <Row gutter={[24, 24]}>
                            {filteredVMs.map((vm) => (
                                <Col xs={24} sm={24} md={8} lg={8} xl={8} key={vm.id}>
                                    <Card
                                        className={styles.portalCard}
                                        style={{
                                            height: '100%',
                                            transition: 'all 0.3s ease',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            background: classicTheme.cardBg,
                                            border: `1px solid ${classicTheme.cardBorder}`,
                                            borderRadius: '16px',
                                            boxShadow: '0 18px 32px rgba(15, 24, 40, 0.08)',
                                            cursor: 'pointer'
                                        }}
                                        styles={{
                                            body: {
                                                display: 'flex',
                                                flexDirection: 'column',
                                                flex: 1,
                                                padding: '24px'
                                            }
                                        }}
                                        hoverable
                                        onClick={() => router.push(`/developers/start/${vm.id}`)}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-6px)';
                                            e.currentTarget.style.boxShadow = '0 24px 46px rgba(15, 24, 40, 0.14)';
                                            e.currentTarget.style.borderColor = classicTheme.primary;
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 18px 32px rgba(15, 24, 40, 0.08)';
                                            e.currentTarget.style.borderColor = classicTheme.cardBorder;
                                        }}
                                    >
                                        {/* Status indicator bar */}
                                        {(() => {
                                            const vmStatus = getVMStatus(vm);
                                            const statusConfig = getStatusConfig(vmStatus);
                                            return (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    height: '4px',
                                                    background: statusConfig.barColor,
                                                    opacity: vmStatus === 'running' ? 0.9 : 0.7,
                                                    transition: 'opacity 0.3s ease',
                                                    boxShadow: statusConfig.barShadow
                                                }} />
                                            );
                                        })()}
                                        
                                        {/* Card Header */}
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'flex-start',
                                            marginBottom: '20px',
                                            paddingTop: '8px',
                                            gap: '12px'
                                        }}>
                                            <div style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '12px',
                                                flex: 1,
                                                minWidth: 0
                                            }}>
                                                {(() => {
                                                    const vmStatus = getVMStatus(vm);
                                                    const statusConfig = getStatusConfig(vmStatus);
                                                    const StatusIcon = statusConfig.icon;
                                                    return (
                                                        <div style={{
                                                            width: '44px',
                                                            height: '44px',
                                                            borderRadius: '12px',
                                                            background: statusConfig.iconBg,
                                                            border: statusConfig.iconBorder,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                            boxShadow: statusConfig.iconShadow
                                                        }}>
                                                            <CloudServerOutlined style={{ 
                                                                fontSize: '22px', 
                                                                color: statusConfig.iconColor
                                                            }} />
                                                        </div>
                                                    );
                                                })()}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <Title level={5} style={{ 
                                                        color: classicTheme.textPrimary, 
                                                        margin: 0,
                                                        fontSize: '16px',
                                                        fontWeight: 600,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        lineHeight: '1.4'
                                                    }}>
                                                        {vm.name || 'Unnamed VM'}
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
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            padding: '6px 14px',
                                                            fontSize: '12px',
                                                            margin: 0,
                                                            fontWeight: 600,
                                                            flexShrink: 0,
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.5px',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            color: statusConfig.color,
                                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                                                            transition: 'all 0.3s ease'
                                                        }}
                                                    >
                                                        <StatusIcon style={{ 
                                                            fontSize: '14px', 
                                                            color: statusConfig.iconColor,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }} />
                                                        <span style={{ color: statusConfig.color }}>
                                                            {statusConfig.text}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Info Sections */}
                                        <div style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column',
                                            gap: '12px',
                                            marginBottom: '16px',
                                            flex: 1,
                                            minWidth: 0,
                                            overflow: 'hidden'
                                        }}>
                                            {/* VM ID Section */}
                                            <div style={{ 
                                                padding: '12px',
                                                background: classicTheme.primarySoft,
                                                border: `1px solid ${classicTheme.cardBorder}`,
                                                borderRadius: '10px',
                                                transition: 'all 0.3s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#fff';
                                                e.currentTarget.style.borderColor = classicTheme.primary;
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = classicTheme.primarySoft;
                                                e.currentTarget.style.borderColor = classicTheme.cardBorder;
                                            }}
                                            >
                                                <div style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '8px',
                                                    overflow: 'hidden'
                                                }}>
                                                    <Text style={{ 
                                                        color: classicTheme.textMuted,
                                                        fontSize: '11px',
                                                        fontWeight: 500,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.5px',
                                                        flexShrink: 0,
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        VM ID:
                                                    </Text>
                                                    <Text style={{ 
                                                        color: classicTheme.textPrimary,
                                                        fontSize: '12px',
                                                        fontFamily: 'monospace',
                                                        fontWeight: 500,
                                                        letterSpacing: '0.3px',
                                                        flex: 1,
                                                        minWidth: 0,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {vm.instance_id || vm.id}
                                                    </Text>
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={<CopyOutlined />}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopy(vm.instance_id || vm.id, 'VM ID');
                                                        }}
                                                        style={{
                                                            color: classicTheme.textMuted,
                                                            padding: '2px 6px',
                                                            minWidth: 'auto',
                                                            height: 'auto',
                                                            transition: 'all 0.2s ease',
                                                            flexShrink: 0
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.color = classicTheme.primary;
                                                            e.currentTarget.style.transform = 'scale(1.15)';
                                                            e.currentTarget.style.background = 'rgba(10, 132, 255, 0.12)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.color = classicTheme.textMuted;
                                                            e.currentTarget.style.transform = 'scale(1)';
                                                            e.currentTarget.style.background = 'transparent';
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Gradient divider line */}
                                            {vm.app_id && (
                                                <div style={{
                                                    height: '1px',
                                                    background: 'linear-gradient(to right, rgba(47, 47, 48, 0.06), rgba(153, 156, 160, 0.5), rgba(148, 163, 184, 0))',
                                                    margin: '4px 0'
                                                }} />
                                            )}

                                            {/* App ID Section */}
                                            {vm.app_id && (
                                                <div style={{ 
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    width: '100%',
                                                    minWidth: 0
                                                }}>
                                                    <div style={{ 
                                                        flex: 1,
                                                        minWidth: 0,
                                                        padding: '12px',
                                                        background: '#f7f8fb',
                                                        borderRadius: '10px',
                                                        transition: 'all 0.3s ease',
                                                        overflow: 'hidden'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(23, 36, 56, 0.08)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = '#f7f8fb';
                                                    }}
                                                    >
                                                        <div style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '8px',
                                                            overflow: 'hidden',
                                                            width: '100%'
                                                        }}>
                                                            <GlobalOutlined style={{ 
                                                                fontSize: '14px', 
                                                                color: classicTheme.primary,
                                                                flexShrink: 0
                                                            }} />
                                                            <Text style={{ 
                                                                color: classicTheme.textMuted,
                                                                fontSize: '11px',
                                                                fontWeight: 500,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.5px',
                                                                flexShrink: 0,
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                App ID:
                                                            </Text>
                                                            <Text style={{ 
                                                                color: classicTheme.textPrimary,
                                                                fontSize: '12px',
                                                                fontFamily: 'monospace',
                                                                fontWeight: 500,
                                                                letterSpacing: '0.3px',
                                                                flex: 1,
                                                                minWidth: 0,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {vm.app_id}
                                                            </Text>
                                                        </div>
                                                    </div>
                                                    <Dropdown
                                                        menu={{ 
                                                            items: getMoreMenuItems(vm),
                                                            onClick: ({ key, domEvent }) => {
                                                                domEvent?.stopPropagation();
                                                                handleMenuClick(vm, key as string);
                                                            },
                                                            style: {
                                                                padding: '8px',
                                                                minWidth: '160px'
                                                            }
                                                        }}
                                                        trigger={['click']}
                                                        placement="bottomRight"
                                                        overlayClassName="custom-dropdown-menu"
                                                        onOpenChange={(open) => {
                                                            // 阻止点击下拉菜单时触发卡片点击
                                                        }}
                                                    >
                                                        <Button
                                                            type="text"
                                                            icon={<MoreOutlined />}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                            }}
                                                            style={{
                                                                color: classicTheme.textMuted,
                                                                padding: '8px',
                                                                borderRadius: '8px',
                                                                transition: 'all 0.2s ease',
                                                                minWidth: '32px',
                                                                width: '32px',
                                                                height: '32px',
                                                                flexShrink: 0,
                                                                background: classicTheme.primarySoft,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                boxShadow: '0 6px 14px rgba(15, 24, 40, 0.08)'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = 'rgba(23, 59, 104, 0.15)';
                                                                e.currentTarget.style.color = classicTheme.primary;
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = classicTheme.primarySoft;
                                                                e.currentTarget.style.color = classicTheme.textMuted;
                                                            }}
                                                        />
                                                    </Dropdown>
                                                </div>
                                            )}

                                        </div>

                                        {/* Action Buttons */}
                                        <div style={{ 
                                            display: 'flex', 
                                            gap: '10px',
                                            marginTop: 'auto',
                                            // paddingTop: '16px'
                                        }}>
                                            {vm.status?.toLowerCase() === 'running' && vm.uptime ? (
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '8px 12px',
                                                    background: '#fff',
                                                    border: `1px solid ${classicTheme.cardBorder}`,
                                                    borderRadius: '8px',
                                                    color: classicTheme.textPrimary,
                                                    fontSize: '12px',
                                                    fontWeight: 500,
                                                    width: 'fit-content'
                                                }}>
                                                    <ClockCircleOutlined style={{ 
                                                        fontSize: '14px', 
                                                        color: classicTheme.primary
                                                    }} />
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
                                                    width: 'fit-content',
                                                    color: classicTheme.primary,
                                                    border: `1px solid ${classicTheme.cardBorder}`,
                                                    borderRadius: '8px',
                                                    padding: '6px 12px',
                                                    height: 'auto',
                                                    transition: 'all 0.3s ease',
                                                    background: classicTheme.primarySoft,
                                                    fontSize: '12px',
                                                    fontWeight: 500
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(10, 132, 255, 0.2)';
                                                    e.currentTarget.style.borderColor = classicTheme.primary;
                                                    e.currentTarget.style.color = classicTheme.primaryHover;
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = classicTheme.primarySoft;
                                                    e.currentTarget.style.borderColor = classicTheme.cardBorder;
                                                    e.currentTarget.style.color = classicTheme.primary;
                                                }}
                                            >
                                                日志
                                            </Button>
                                            {dashboardAvailable(vm) && (
                                                <Button
                                                    type="text"
                                                    icon={<DashboardOutlined />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        showDashboard(vm);
                                                    }}
                                                    style={{
                                                        width: 'fit-content',
                                                        color: classicTheme.textPrimary,
                                                        border: `1px solid ${classicTheme.cardBorder}`,
                                                        borderRadius: '8px',
                                                        padding: '6px 12px',
                                                        height: 'auto',
                                                        transition: 'all 0.3s ease',
                                                        background: '#edf0e3',
                                                        fontSize: '12px',
                                                        fontWeight: 500
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = '#dfe4d1';
                                                        e.currentTarget.style.borderColor = '#a8b58e';
                                                        e.currentTarget.style.color = '#394734';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = '#edf0e3';
                                                        e.currentTarget.style.borderColor = classicTheme.cardBorder;
                                                        e.currentTarget.style.color = classicTheme.textPrimary;
                                                    }}
                                                >
                                                    Dashboard
                                                </Button>
                                            )}
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
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '4px 0'
                        }}>
                            <CloudServerOutlined style={{ 
                                fontSize: '20px', 
                                color: classicTheme.primary
                            }} />
                            <div style={{ flex: 1 }}>
                                <Title level={4} style={{ 
                                    margin: 0, 
                                    color: classicTheme.textPrimary,
                                    fontWeight: 600,
                                    fontSize: '20px',
                                    letterSpacing: '0'
                                }}>
                                    部署新实例
                                </Title>
                                <Text style={{
                                    color: classicTheme.textMuted,
                                    fontSize: '13px',
                                    fontWeight: 400,
                                    marginTop: '2px',
                                    display: 'block'
                                }}>
                                    配置并启动您的计算应用实例
                                </Text>
                            </div>
                        </div>
                    }
                    open={showDeployModal}
                    onCancel={() => setShowDeployModal(false)}
                    width={960}
                    footer={null}
                    style={{ top: 20 }}
                >
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={createVm}
                        style={{ maxWidth: '100%', overflowX: 'hidden' }}
                        initialValues={{
                            vcpu: 1,
                            memoryValue: 2,
                            memoryUnit: 'GB',
                            disk_size: 20,
                            kms_enabled: true,
                            gateway_enabled: true,
                            public_logs: true,
                            public_sysinfo: true,
                            public_tcbinfo: true,
                            ports: [],
                            encryptedEnvs: [],
                            docker_config: { enabled: false, username: '', token_key: '' }
                        }}
                    >
                        {/* 基本信息分组 */}
                        <div style={{
                            background: panelBackground,
                            border: `1px solid ${panelBorder}`,
                            borderRadius: '16px',
                            padding: '24px',
                            marginBottom: '24px',
                            backdropFilter: 'blur(10px)'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '20px',
                                paddingBottom: '16px',
                                borderBottom: `1px solid ${panelDivider}`
                            }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: 'rgba(20, 99, 255, 0.12)',
                                    border: `1px solid ${classicTheme.primarySoft}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <FileTextOutlined style={{ fontSize: '18px', color: '#a855f7' }} />
                                </div>
                                <Title level={5} style={{ margin: 0, color: classicTheme.highlight, fontSize: '17px', fontWeight: 600 }}>
                                    基本信息
                                </Title>
                            </div>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入 VM 名称' }]}>
                                        <Input placeholder="输入 VM 名称" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item label="镜像" name="image" rules={[{ required: true, message: '请选择镜像' }]}>
                                        <Select placeholder="选择镜像" showSearch>
                                            {availableImages.map(img => (
                                                <Select.Option key={img.name} value={img.name}>{img.name}</Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={16}>
                                <Col span={8}>
                                    <Form.Item label="vCPU 数量" name="vcpu" rules={[{ required: true, message: '请输入 vCPU 数量' }]}>
                                        <InputNumber min={1} style={{ width: '100%' }} />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label="内存" name="memoryValue" rules={[{ required: true, message: '请输入内存大小' }]}>
                                        <InputNumber min={1} style={{ width: '100%' }} />
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

                            <Form.Item label="磁盘大小 (GB)" name="disk_size" rules={[{ required: true, message: '请输入磁盘大小' }]}>
                                <InputNumber min={1} style={{ width: '100%' }} />
                            </Form.Item>
                        </div>

                        {/* Docker Compose 配置分组 */}
                        <div style={{
                            background: panelBackground,
                            border: `1px solid ${panelBorder}`,
                            borderRadius: '16px',
                            padding: '24px',
                            marginBottom: '24px',
                            backdropFilter: 'blur(10px)'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '20px',
                                paddingBottom: '16px',
                                borderBottom: `1px solid ${panelDivider}`
                            }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: 'rgba(46, 180, 170, 0.2)',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <ThunderboltOutlined style={{ fontSize: '18px', color: '#22c55e' }} />
                                </div>
                                <Title level={5} style={{ margin: 0, color: classicTheme.highlight, fontSize: '17px', fontWeight: 600 }}>
                                    Docker Compose 配置
                                </Title>
                            </div>
                            <Form.Item label="Docker Compose 文件" name="dockerComposeFile" rules={[{ required: true, message: '请输入 Docker Compose 文件内容' }]}>
                                <div>
                                    <Upload
                                        accept=".yml,.yaml,.txt"
                                        beforeUpload={(file) => {
                                            const reader = new FileReader();
                                            reader.onload = (e) => {
                                                const content = e.target?.result as string;
                                                form.setFieldValue('dockerComposeFile', content);
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
                                                background: 'rgba(34, 197, 94, 0.1)',
                                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                                color: '#22c55e',
                                                borderRadius: '10px',
                                                height: '40px',
                                                fontWeight: 500
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(34, 197, 94, 0.2)';
                                                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(34, 197, 94, 0.1)';
                                                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
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
                                            fontFamily: 'monospace',
                                            fontSize: '14px',
                                            lineHeight: '1.6'
                                        }}
                                    />
                                    </Form.Item>
                                </div>
                            </Form.Item>
                        </div>

                        {availableGpus.length > 0 && (
                            <div style={{
                                background: panelBackground,
                                border: `1px solid ${panelBorder}`,
                                borderRadius: '16px',
                                padding: '24px',
                                marginBottom: '24px',
                                backdropFilter: 'blur(10px)'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    marginBottom: '20px',
                                    paddingBottom: '16px',
                                    borderBottom: `1px solid ${panelDivider}`
                                }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        background: 'rgba(247, 107, 64, 0.2)',
                                        border: '1px solid rgba(251, 146, 60, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <ThunderboltOutlined style={{ fontSize: '18px', color: '#fb923c' }} />
                                    </div>
                                    <Title level={5} style={{ margin: 0, color: classicTheme.highlight, fontSize: '17px', fontWeight: 600 }}>
                                        GPU 配置
                                    </Title>
                                </div>
                                {allowAttachAllGpus && (
                                    <Form.Item name="attachAllGpus" valuePropName="checked" style={{ marginBottom: 16 }}>
                                        <Checkbox>附加所有 GPU 和 NVSwitch</Checkbox>
                                    </Form.Item>
                                )}
                                {!form.getFieldValue('attachAllGpus') && (
                                    <Form.Item label="选择 GPU" name="selectedGpus">
                                        <Select mode="multiple" placeholder="选择要附加的 GPU">
                                            {availableGpus.map(gpu => (
                                                <Select.Option key={gpu.slot} value={gpu.slot}>
                                                    {gpu.slot}: {gpu.description} {gpu.is_free ? '' : '(使用中)'}
                                                </Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                )}
                            </div>
                        )}

                        {/* 高级配置分组 */}
                        <div style={{
                            background: panelBackground,
                            border: `1px solid ${panelBorder}`,
                            borderRadius: '16px',
                            padding: '24px',
                            marginBottom: '24px',
                            backdropFilter: 'blur(10px)'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '20px',
                                paddingBottom: '16px',
                                borderBottom: `1px solid ${panelDivider}`
                            }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: 'rgba(202, 90, 200, 0.2)',
                                    border: '1px solid rgba(168, 85, 247, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <SettingOutlined style={{ fontSize: '18px', color: '#a855f7' }} />
                                </div>
                                <Title level={5} style={{ margin: 0, color: classicTheme.highlight, fontSize: '17px', fontWeight: 600 }}>
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
                                        fontFamily: 'monospace',
                                        fontSize: '14px',
                                        lineHeight: '1.6'
                                    }}
                                />
                            </Form.Item>

                            <Form.Item label="用户配置" name="user_config">
                                <Input.TextArea 
                                    rows={4} 
                                    placeholder="可选：将放置在 CVM 中 /dstack/.user-config 的用户配置"
                                    style={{ 
                                        fontFamily: 'monospace',
                                        fontSize: '14px',
                                        lineHeight: '1.6'
                                    }}
                                />
                            </Form.Item>
                        </div>

{portMappingEnabled && (
    <div style={{
        background: panelBackground,
        border: `1px solid ${panelBorder}`,
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        backdropFilter: 'blur(10px)'
    }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    marginBottom: '20px',
                                    paddingBottom: '16px',
        borderBottom: `1px solid ${panelDivider}`
                                }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        background: 'rgba(79, 116, 244, 0.2)',
                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <GlobalOutlined style={{ fontSize: '18px', color: '#3b82f6' }} />
                                    </div>
        <Title level={5} style={{ margin: 0, color: classicTheme.highlight, fontSize: '17px', fontWeight: 600 }}>
                                        端口映射
                                    </Title>
                                </div>
                                <Form.Item label="端口映射" name="ports">
                                    <Form.List name="ports">
                                        {(fields, { add, remove }) => (
                                            <>
                                                {fields.map(({ key, name, ...restField }) => (
                                                    <Space key={key} style={{ display: 'flex', marginBottom: 12 }} align="baseline">
                                                        <Form.Item {...restField} name={[name, 'protocol']} rules={[{ required: true }]}>
                                                            <Select style={{ width: 90 }}>
                                                                <Select.Option value="tcp">TCP</Select.Option>
                                                                <Select.Option value="udp">UDP</Select.Option>
                                                            </Select>
                                                        </Form.Item>
                                                        <Form.Item {...restField} name={[name, 'host_address']} rules={[{ required: true }]}>
                                                            <Select style={{ width: 110 }}>
                                                                <Select.Option value="127.0.0.1">本地</Select.Option>
                                                                <Select.Option value="0.0.0.0">公开</Select.Option>
                                                            </Select>
                                                        </Form.Item>
                                                        <Form.Item {...restField} name={[name, 'host_port']} rules={[{ required: true }]}>
                                                            <InputNumber placeholder="主机端口" style={{ width: 130 }} />
                                                        </Form.Item>
                                                        <Form.Item {...restField} name={[name, 'vm_port']} rules={[{ required: true }]}>
                                                            <InputNumber placeholder="VM 端口" style={{ width: 130 }} />
                                                        </Form.Item>
                                                        <Button
                                                            type="text"
                                                            icon={<MinusCircleOutlined />}
                                                            onClick={() => remove(name)}
                                                            style={{
                                                                color: 'rgba(239, 68, 68, 0.8)',
                                                                padding: '4px 8px'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.color = '#ef4444';
                                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.color = 'rgba(239, 68, 68, 0.8)';
                                                                e.currentTarget.style.background = 'transparent';
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
                                                            height: '40px',
                                                            borderRadius: '10px',
                                                            fontWeight: 500
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
<div style={{
    background: panelBackground,
    border: `1px solid ${panelBorder}`,
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    backdropFilter: 'blur(10px)'
}}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '20px',
                                paddingBottom: '16px',
    borderBottom: `1px solid ${panelDivider}`
                            }}>
                                <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: 'rgba(120, 210, 96, 0.2)',
                                    border: '1px solid rgba(39, 194, 108, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <DashboardOutlined style={{ fontSize: '18px', color: '#a8e063' }} />
                                </div>
    <Title level={5} style={{ margin: 0, color: classicTheme.highlight, fontSize: '17px', fontWeight: 600 }}>
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
                                    <Col span={8}>
                                        <Form.Item name="local_key_provider_enabled" valuePropName="checked" noStyle>
                                            <Checkbox>本地密钥提供者</Checkbox>
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="gateway_enabled" valuePropName="checked" noStyle>
                                            <Checkbox>Dstack Gateway</Checkbox>
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="public_logs" valuePropName="checked" noStyle>
                                            <Checkbox>公开日志</Checkbox>
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="public_sysinfo" valuePropName="checked" noStyle>
                                            <Checkbox>公开系统信息</Checkbox>
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="public_tcbinfo" valuePropName="checked" noStyle>
                                            <Checkbox>公开 TCB 信息</Checkbox>
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="pin_numa" valuePropName="checked" noStyle>
                                            <Checkbox>NUMA 绑定</Checkbox>
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="hugepages" valuePropName="checked" noStyle>
                                            <Checkbox>Hugepages</Checkbox>
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Form.Item>
                        </div>

                        {/* 安全配置分组 */}
                        <Form.Item 
                            noStyle 
                            shouldUpdate={(prevValues, currentValues) => 
                                prevValues.kms_enabled !== currentValues.kms_enabled ||
                                prevValues.docker_config?.enabled !== currentValues.docker_config?.enabled
                            }
                        >
                            {({ getFieldValue }) => {
                                const kmsEnabled = getFieldValue('kms_enabled');
                                const dockerConfigEnabled = getFieldValue(['docker_config', 'enabled']);
                                return kmsEnabled && (
                                    <div style={{
                                        background: panelBackground,
                                        border: `1px solid ${panelBorder}`,
                                        borderRadius: '16px',
                                        padding: '24px',
                                        marginBottom: '24px',
                                        backdropFilter: 'blur(10px)'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            marginBottom: '20px',
                                            paddingBottom: '16px',
                                            borderBottom: `1px solid ${panelDivider}`
                                        }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '10px',
                                                background: 'rgba(210, 80, 170, 0.2)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <SafetyOutlined style={{ fontSize: '18px', color: '#ef4444' }} />
                                            </div>
                                            <Title level={5} style={{ margin: 0, color: classicTheme.highlight, fontSize: '17px', fontWeight: 600 }}>
                                                安全配置
                                            </Title>
                                        </div>
                                        <Form.Item label="密钥提供者 ID (可选)" name="key_provider_id" style={{ marginBottom: 20 }}>
                                            <Input placeholder="如果要绑定到特定的密钥提供者，请输入密钥提供者 ID" />
                                        </Form.Item>
                                        <Form.Item name={['docker_config', 'enabled']} valuePropName="checked" style={{ marginBottom: 16 }}>
                                            <Checkbox>Docker 镜像仓库登录</Checkbox>
                                        </Form.Item>
                                        {dockerConfigEnabled && (
                                            <Row gutter={16}>
                                                <Col span={12}>
                                                    <Form.Item label="用户名" name={['docker_config', 'username']}>
                                                        <Input placeholder="Docker 镜像仓库用户名" />
                                                    </Form.Item>
                                                </Col>
                                                <Col span={12}>
                                                    <Form.Item label="令牌密钥" name={['docker_config', 'token_key']}>
                                                        <Input placeholder="加密环境变量中的密钥名称" />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        )}
                                        <Form.Item label="加密环境变量" name="encryptedEnvs" style={{ marginTop: 16 }}>
                                            <Form.List name="encryptedEnvs">
                                                {(fields, { add, remove }) => (
                                                    <>
                                                        {fields.map(({ key, name, ...restField }) => (
                                                            <Space key={key} style={{ display: 'flex', marginBottom: 12 }} align="baseline">
                                                                <Form.Item {...restField} name={[name, 'key']} rules={[{ required: true }]}>
                                                                    <Input placeholder="变量名" style={{ width: 220 }} />
                                                                </Form.Item>
                                                                <Form.Item {...restField} name={[name, 'value']} rules={[{ required: true }]}>
                                                                    <Input.Password placeholder="值" style={{ flex: 1, minWidth: 200 }} />
                                                                </Form.Item>
                                                                <Button
                                                                    type="text"
                                                                    icon={<MinusCircleOutlined />}
                                                                    onClick={() => remove(name)}
                                                                    style={{
                                                                        color: 'rgba(239, 68, 68, 0.8)',
                                                                        padding: '4px 8px'
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.color = '#ef4444';
                                                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.color = 'rgba(239, 68, 68, 0.8)';
                                                                        e.currentTarget.style.background = 'transparent';
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
                                                                    height: '40px',
                                                                    borderRadius: '10px',
                                                                    fontWeight: 500
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
                                );
                            }}
                        </Form.Item>

                        {composeHashPreview && (
                            <div style={{
                                background: 'rgba(99, 102, 241, 0.1)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                borderRadius: '12px',
                                padding: '16px',
                                marginBottom: '24px'
                            }}>
                                <Text style={{ color: '#64748b', fontSize: '14px', fontWeight: 500, marginBottom: '8px', display: 'block' }}>
                                    Compose Hash
                                </Text>
                                <Text code style={{
                                    background: 'rgba(99, 102, 241, 0.2)',
                                    border: '1px solid rgba(99, 102, 241, 0.4)',
                                    color: '#a855f7',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontFamily: 'monospace',
                                    display: 'inline-block'
                                }}>
                                    0x{composeHashPreview}
                                </Text>
                            </div>
                        )}

                        {/* 底部操作按钮 */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px',
                            paddingTop: '24px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                            marginTop: '8px'
                        }}>
                            <Button 
                                onClick={() => setShowDeployModal(false)}
                                style={{
                                    background: '#ffffff',
                                    border: `1px solid ${panelBorder}`,
                                    borderRadius: '12px',
                                    padding: '12px 28px',
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    height: '48px',
                                    color: classicTheme.textPrimary,
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    minWidth: '120px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
                                    e.currentTarget.style.transform = 'translateY(0)';
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
                                    background: '#6366f1',
                                    border: 'none',
                                    borderRadius: '12px',
                                    padding: '12px 32px',
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    height: '48px',
                                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.5), 0 4px 12px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    color: '#fff',
                                    minWidth: '140px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#7c7ef8';
                                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(99, 102, 241, 0.6), 0 6px 16px rgba(168, 85, 247, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#6366f1';
                                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.5), 0 4px 12px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                部署
                            </Button>
                        </div>
                    </Form>
                </Modal>

                {/* VM 详情模态框 */}
                <Modal
                    title={
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '4px 0',
                            position: 'relative'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: '#667eea',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    borderRadius: '14px'
                                }} />
                                <CloudServerOutlined style={{ 
                                    fontSize: '22px', 
                                    color: '#fff',
                                    position: 'relative',
                                    zIndex: 1,
                                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
                                }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <Title level={4} style={{ 
                                    margin: 0, 
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '22px',
                                    letterSpacing: '-0.02em',
                                    background: 'rgba(255, 255, 255, 0.95)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text'
                                }}>
                                    {selectedVM?.name || 'VM 详细信息'}
                                </Title>
                                <Text style={{
                                    color: '#94a3b8',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    marginTop: '4px',
                                    display: 'block',
                                    fontFamily: 'monospace',
                                    letterSpacing: '0.02em'
                                }}>
                                    {selectedVM?.id || ''}
                                </Text>
                            </div>
                        </div>
                    }
                    open={showDetailModal}
                    onCancel={() => {
                        setShowDetailModal(false);
                        setSelectedVM(null);
                        setVmDetails(null);
                        setNetworkInfo(null);
                    }}
                    width={920}
                    footer={null}
                    style={{ top: 20 }}
                    styles={{
                        content: {
                            background: 'rgba(15, 23, 42, 0.97)',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 32px 96px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                            overflow: 'hidden',
                            overflowX: 'hidden',
                            backdropFilter: 'blur(24px) saturate(180%)',
                            position: 'relative'
                        },
                        header: {
                            background: 'rgba(255, 255, 255, 0.08)',
                            borderBottom: '1px solid #e2e8f0',
                            padding: '32px 40px',
                            borderRadius: '8px 8px 0 0',
                            position: 'relative',
                            backdropFilter: 'blur(10px)'
                        },
                        body: { 
                            maxHeight: 'calc(100vh - 240px)', 
                            overflowY: 'auto', 
                            overflowX: 'hidden',
                            padding: '40px',
                            background: 'transparent'
                        },
                        mask: {
                            backdropFilter: 'blur(16px)',
                            background: 'rgba(0, 0, 0, 0.7)'
                        }
                    }}
                    closeIcon={
                        <div 
                            style={{
                                color: '#64748b',
                                fontSize: '24px',
                                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '12px',
                                background: '#f1f5f9',
                                border: '1px solid #e2e8f0',
                                cursor: 'pointer',
                                lineHeight: '1',
                                fontWeight: 300,
                                backdropFilter: 'blur(10px)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                                e.currentTarget.style.color = '#fca5a5';
                                e.currentTarget.style.transform = 'rotate(90deg) scale(1.15)';
                                e.currentTarget.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                                e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            ×
                        </div>
                    }
                >
                    {loadingDetails ? (
                        <div style={{ 
                            textAlign: 'center', 
                            padding: '60px', 
                            color: '#94a3b8',
                            fontSize: '16px'
                        }}>
                            <div className={styles.loadingSpinner} style={{ margin: '0 auto 20px' }}>
                                <div className={styles.loadingSpinnerOuter} />
                                <div className={styles.loadingSpinnerInner} />
                                <div className={styles.loadingSpinnerCenter} />
                            </div>
                            <div>加载详细信息中...</div>
                        </div>
                    ) : vmDetails ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Boot Status */}
                            <div style={{
                                background: 'rgba(139, 92, 246, 0.15)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                borderRadius: '20px',
                                padding: '28px',
                                backdropFilter: 'blur(16px) saturate(180%)',
                                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px', position: 'relative', zIndex: 1 }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '14px',
                                        background: '#8b5cf6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            borderRadius: '14px'
                                        }} />
                                        <BulbOutlined style={{ fontSize: '20px', color: '#fff', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' }} />
                                    </div>
                                    <Title level={5} style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                                        启动状态
                                    </Title>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 1 }}>
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        padding: '16px 20px',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        borderRadius: '14px',
                                        border: '1px solid #e2e8f0',
                                        backdropFilter: 'blur(10px)',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        <span style={{ color: '#334155', fontSize: '15px', fontWeight: 600 }}>启动进度</span>
                                        <Tag 
                                            color={vmDetails.boot_progress === 'done' ? 'success' : 'processing'}
                                            style={{
                                                margin: 0,
                                                padding: '6px 16px',
                                                borderRadius: '10px',
                                                fontWeight: 600,
                                                fontSize: '13px',
                                                border: 'none',
                                                boxShadow: vmDetails.boot_progress === 'done' 
                                                    ? '0 4px 12px rgba(34, 197, 94, 0.3)' 
                                                    : '0 4px 12px rgba(59, 130, 246, 0.3)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }}
                                        >
                                            {vmDetails.boot_progress || 'N/A'}
                                        </Tag>
                                    </div>
                                    {vmDetails.boot_error && (
                                        <div style={{
                                            padding: '16px 20px',
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            borderRadius: '14px',
                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '12px',
                                            backdropFilter: 'blur(10px)',
                                            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                                        }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '10px',
                                                background: 'rgba(239, 68, 68, 0.3)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                <SafetyOutlined style={{ color: '#fca5a5', fontSize: '16px' }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ color: '#fca5a5', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>启动错误</div>
                                                <div style={{ color: 'rgba(252, 165, 165, 0.95)', fontSize: '13px', lineHeight: '1.6' }}>{vmDetails.boot_error}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Network Information */}
                            {networkInfo && (
                                <div style={{
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    borderRadius: '20px',
                                    padding: '28px',
                                    backdropFilter: 'blur(16px) saturate(180%)',
                                    boxShadow: '0 8px 32px rgba(59, 130, 246, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px', position: 'relative', zIndex: 1 }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '14px',
                                            background: '#2563eb',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                background: 'rgba(255, 255, 255, 0.2)',
                                                borderRadius: '14px'
                                            }} />
                                            <GlobalOutlined style={{ fontSize: '20px', color: '#fff', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' }} />
                                        </div>
                                        <Title level={5} style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                                            网络信息
                                        </Title>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 1 }}>
                                        {networkInfo.dns_servers && (
                                            <div style={{
                                                padding: '16px 20px',
                                                background: 'rgba(0, 0, 0, 0.3)',
                                                borderRadius: '14px',
                                                border: '1px solid #e2e8f0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                backdropFilter: 'blur(10px)',
                                                transition: 'all 0.2s ease'
                                            }}>
                                                <span style={{ color: '#334155', fontSize: '15px', fontWeight: 600 }}>DNS 服务器</span>
                                                <span style={{ 
                                                    color: '#93c5fd', 
                                                    fontSize: '14px',
                                                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                                                    background: 'rgba(59, 130, 246, 0.2)',
                                                    padding: '6px 14px',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                                    fontWeight: 500,
                                                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
                                                }}>
                                                    {networkInfo.dns_servers.join(', ')}
                                                </span>
                                            </div>
                                        )}
                                        {networkInfo.gateways && (
                                            <div style={{
                                                padding: '16px 20px',
                                                background: 'rgba(0, 0, 0, 0.3)',
                                                borderRadius: '14px',
                                                border: '1px solid #e2e8f0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                backdropFilter: 'blur(10px)',
                                                transition: 'all 0.2s ease'
                                            }}>
                                                <span style={{ color: '#334155', fontSize: '15px', fontWeight: 600 }}>网关</span>
                                                <span style={{ 
                                                    color: '#93c5fd', 
                                                    fontSize: '14px',
                                                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                                                    background: 'rgba(59, 130, 246, 0.2)',
                                                    padding: '6px 14px',
                                                    borderRadius: '10px',
                                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                                    fontWeight: 500,
                                                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
                                                }}>
                                                    {networkInfo.gateways.map((gw: any) => gw.address).join(', ')}
                                                </span>
                                            </div>
                                        )}
                                        {networkInfo.interfaces && networkInfo.interfaces.map((iface: any, idx: number) => (
                                            <div key={idx} style={{ 
                                                padding: '16px',
                                                background: 'rgba(0, 0, 0, 0.25)',
                                                borderRadius: '12px',
                                                border: '1px solid #e2e8f0',
                                                marginTop: '4px'
                                            }}>
                                                <div style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '8px',
                                                    marginBottom: '12px',
                                                    color: classicTheme.textPrimary, 
                                                    fontSize: '14px', 
                                                    fontWeight: 600 
                                                }}>
                                                    <div style={{
                                                        width: '6px',
                                                        height: '6px',
                                                        borderRadius: '50%',
                                                        background: '#2563eb',
                                                        boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)'
                                                    }} />
                                                    接口 {iface.name}
                                                </div>
                                                <div style={{ 
                                                    display: 'grid', 
                                                    gridTemplateColumns: 'auto 1fr', 
                                                    gap: '8px 12px',
                                                    color: classicTheme.textMuted, 
                                                    fontSize: '13px',
                                                    marginLeft: '14px'
                                                }}>
                                                    <span style={{ color: '#a5b4fc' }}>IP:</span>
                                                    <span style={{ fontFamily: 'monospace' }}>{iface.addresses?.map((addr: any) => `${addr.address}/${addr.prefix}`).join(', ') || 'N/A'}</span>
                                                    <span style={{ color: '#a5b4fc' }}>RX:</span>
                                                    <span>{iface.rx_bytes || 0} bytes {iface.rx_errors > 0 && <span style={{ color: '#ef4444' }}>({iface.rx_errors} errors)</span>}</span>
                                                    <span style={{ color: '#a5b4fc' }}>TX:</span>
                                                    <span>{iface.tx_bytes || 0} bytes {iface.tx_errors > 0 && <span style={{ color: '#ef4444' }}>({iface.tx_errors} errors)</span>}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {networkInfo.wg_info && (
                                            <div style={{ marginTop: '8px' }}>
                                                <div style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '8px',
                                                    color: classicTheme.textPrimary, 
                                                    fontSize: '14px', 
                                                    fontWeight: 600,
                                                    marginBottom: '12px'
                                                }}>
                                                    <SafetyOutlined style={{ fontSize: '16px', color: '#3b82f6' }} />
                                                    WireGuard 信息
                                                </div>
                                                <div style={{
                                                    background: 'rgba(15, 23, 42, 0.45)',
                                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                                    borderRadius: '12px',
                                                    padding: '16px',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        right: 0,
                                                        height: '2px',
                                                        background: 'rgba(59, 130, 246, 0.6)'
                                                    }} />
                                                    <pre style={{
                                                        margin: 0,
                                                        color: classicTheme.textPrimary,
                                                        fontSize: '12px',
                                                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                                        lineHeight: '1.6',
                                                        overflow: 'auto',
                                                        maxHeight: '280px',
                                                        padding: '4px 0'
                                                    }}>{networkInfo.wg_info}</pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* VM Configuration */}
                            <div style={{
                                background: 'rgba(34, 197, 94, 0.15)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                borderRadius: '20px',
                                padding: '28px',
                                backdropFilter: 'blur(16px) saturate(180%)',
                                boxShadow: '0 8px 32px rgba(34, 197, 94, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px', position: 'relative', zIndex: 1 }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '14px',
                                        background: '#16a34a',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        boxShadow: '0 8px 24px rgba(34, 197, 94, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            borderRadius: '14px'
                                        }} />
                                        <SettingOutlined style={{ fontSize: '20px', color: '#fff', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' }} />
                                    </div>
                                    <Title level={5} style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                                        VM 配置
                                    </Title>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', color: '#1f2937', position: 'relative', zIndex: 1 }}>
                                    {[
                                        { label: '镜像', value: vmDetails.configuration?.image || 'N/A', monospace: true },
                                        { label: 'vCPUs', value: vmDetails.configuration?.vcpu || 'N/A', monospace: false },
                                        { label: '内存', value: formatMemory(vmDetails.configuration?.memory), monospace: false },
                                        { label: '磁盘大小', value: vmDetails.configuration?.disk_size ? `${vmDetails.configuration.disk_size} GB` : 'N/A', monospace: false },
                                        ...(vmDetails.configuration?.gpus && vmDetails.configuration.gpus.length > 0 ? [{
                                            label: 'GPUs',
                                            value: vmDetails.configuration.gpus.map((gpu: any) => gpu.slot || gpu.product_id).join(', '),
                                            monospace: true
                                        }] : []),
                                        { label: 'VM ID', value: vmDetails.id, monospace: true }
                                    ].map((item, idx) => (
                                        <React.Fragment key={idx}>
                                            <div style={{ 
                                                color: '#475569', 
                                                fontSize: '15px',
                                                fontWeight: 600,
                                                padding: '12px 0',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}>{item.label}:</div>
                                            <div style={{ 
                                                fontSize: '14px',
                                                fontFamily: item.monospace ? 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' : 'inherit',
                                                padding: '12px 16px',
                                                background: 'rgba(0, 0, 0, 0.3)',
                                                borderRadius: '12px',
                                                border: '1px solid #e2e8f0',
                                                backdropFilter: 'blur(10px)',
                                                color: item.monospace ? '#86efac' : 'rgba(255, 255, 255, 0.9)',
                                                fontWeight: item.monospace ? 500 : 400
                                            }}>{item.value}</div>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>

                            {/* Port Mappings */}
                            {vmDetails.configuration?.ports && vmDetails.configuration.ports.length > 0 && (
                                <div style={{
                                    background: 'rgba(251, 146, 60, 0.15)',
                                    border: '1px solid rgba(251, 146, 60, 0.3)',
                                    borderRadius: '20px',
                                    padding: '28px',
                                    backdropFilter: 'blur(16px) saturate(180%)',
                                    boxShadow: '0 8px 32px rgba(251, 146, 60, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px', position: 'relative', zIndex: 1 }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '14px',
                                            background: '#ea580c',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            boxShadow: '0 8px 24px rgba(251, 146, 60, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                position: 'absolute',
                                                inset: 0,
                                                background: 'rgba(255, 255, 255, 0.2)',
                                                borderRadius: '14px'
                                            }} />
                                            <ApiOutlined style={{ fontSize: '20px', color: '#fff', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' }} />
                                        </div>
                                        <Title level={5} style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                                            端口映射
                                        </Title>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
                                        {vmDetails.configuration.ports.map((port: any, idx: number) => {
                                            const isLocal = !port.host_address || port.host_address === '127.0.0.1';
                                            return (
                                                <div key={idx} style={{
                                                    padding: '16px 20px',
                                                    background: 'rgba(0, 0, 0, 0.3)',
                                                    borderRadius: '14px',
                                                    border: '1px solid #e2e8f0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '14px',
                                                    backdropFilter: 'blur(10px)',
                                                    transition: 'all 0.2s ease'
                                                }}>
                                                    <Tag 
                                                        color={isLocal ? 'success' : 'warning'}
                                                        style={{
                                                            margin: 0,
                                                            padding: '6px 14px',
                                                            borderRadius: '10px',
                                                            fontWeight: 700,
                                                            fontSize: '12px',
                                                            border: 'none',
                                                            minWidth: '60px',
                                                            textAlign: 'center',
                                                            boxShadow: isLocal 
                                                                ? '0 4px 12px rgba(34, 197, 94, 0.3)' 
                                                                : '0 4px 12px rgba(251, 146, 60, 0.3)',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.05em'
                                                        }}
                                                    >
                                                        {isLocal ? '本地' : '公开'}
                                                    </Tag>
                                                    <span style={{
                                                        color: '#fed7aa',
                                                        fontSize: '14px',
                                                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                                                        flex: 1,
                                                        fontWeight: 500
                                                    }}>
                                                        {port.protocol?.toUpperCase()}: {port.host_port} → {port.vm_port}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* App Information */}
                            <div style={{
                                background: 'rgba(168, 85, 247, 0.15)',
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                borderRadius: '20px',
                                padding: '28px',
                                backdropFilter: 'blur(16px) saturate(180%)',
                                boxShadow: '0 8px 32px rgba(168, 85, 247, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '22px', position: 'relative', zIndex: 1 }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '14px',
                                        background: '#8b5cf6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        boxShadow: '0 8px 24px rgba(168, 85, 247, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            borderRadius: '14px'
                                        }} />
                                        <AppstoreOutlined style={{ fontSize: '20px', color: '#fff', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' }} />
                                    </div>
                                    <Title level={5} style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                                        应用信息
                                    </Title>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', color: '#1f2937', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
                                    {[
                                        { label: '应用名称', value: vmDetails.appCompose?.name || 'N/A', monospace: false },
                                        { label: 'App ID', value: vmDetails.app_id || 'N/A', monospace: true },
                                        { label: 'Instance ID', value: vmDetails.instance_id || 'N/A', monospace: true },
                                        { label: 'Runner', value: vmDetails.appCompose?.runner || 'N/A', monospace: false },
                                        { label: '功能特性', value: getFlags(vmDetails), monospace: false }
                                    ].map((item, idx) => (
                                        <React.Fragment key={idx}>
                                            <div style={{ 
                                                color: '#475569', 
                                                fontSize: '15px',
                                                fontWeight: 600,
                                                padding: '12px 0',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}>{item.label}:</div>
                                            <div style={{ 
                                                fontSize: '14px',
                                                fontFamily: item.monospace ? 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' : 'inherit',
                                                padding: '12px 16px',
                                                background: 'rgba(0, 0, 0, 0.3)',
                                                borderRadius: '12px',
                                                border: '1px solid #e2e8f0',
                                                backdropFilter: 'blur(10px)',
                                                color: item.monospace ? '#c4b5fd' : 'rgba(255, 255, 255, 0.9)',
                                                fontWeight: item.monospace ? 500 : 400
                                            }}>{item.value}</div>
                                        </React.Fragment>
                                    ))}
                                </div>

                                {vmDetails.appCompose?.docker_compose_file && (
                                    <>
                                        <div style={{ marginTop: '20px', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
                                            <Title level={5} style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: 600 }}>
                                                Docker Compose 文件
                                            </Title>
                                        </div>
                                        <div style={{
                                            background: 'rgba(15, 23, 42, 0.45)',
                                            border: '1px solid rgba(139, 92, 246, 0.3)',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            marginBottom: '16px'
                                        }}>
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                height: '2px',
                                                background: 'rgba(139, 92, 246, 0.6)'
                                            }} />
                                            <pre style={{
                                                margin: 0,
                                                color: classicTheme.textPrimary,
                                                fontSize: '12px',
                                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                                lineHeight: '1.6',
                                                overflow: 'auto',
                                                maxHeight: '300px',
                                                padding: '4px 0'
                                            }}>{vmDetails.appCompose.docker_compose_file}</pre>
                                        </div>
                                    </>
                                )}

                                {vmDetails.appCompose?.pre_launch_script && (
                                    <>
                                        <div style={{ marginTop: '20px', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
                                            <Title level={5} style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: 600 }}>
                                                预启动脚本
                                            </Title>
                                        </div>
                                        <div style={{
                                            background: 'rgba(15, 23, 42, 0.45)',
                                            border: '1px solid rgba(139, 92, 246, 0.3)',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                height: '2px',
                                                background: 'rgba(139, 92, 246, 0.6)'
                                            }} />
                                            <pre style={{
                                                margin: 0,
                                                color: classicTheme.textPrimary,
                                                fontSize: '12px',
                                                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                                lineHeight: '1.6',
                                                overflow: 'auto',
                                                maxHeight: '300px',
                                                padding: '4px 0'
                                            }}>{vmDetails.appCompose.pre_launch_script}</pre>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{ 
                            textAlign: 'center', 
                            padding: '60px', 
                            color: '#94a3b8',
                            fontSize: '16px'
                        }}>
                            无法加载详细信息
                        </div>
                    )}
                </Modal>
            </PortalLayout>
    );
}

export default function StartPage() {
    return (
        <App>
            <StartPageContent />
        </App>
    );
}

