'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Card, Col, Row, Tag, Typography, Space, Menu, type MenuProps, Dropdown, Modal, Form, InputNumber, Select, Input, message, Descriptions, Divider, Spin, Empty } from 'antd';
import {
    ArrowLeftOutlined,
    CloudServerOutlined,
    DashboardOutlined,
    SafetyOutlined,
    GlobalOutlined,
    SettingOutlined,
    ApiOutlined,
    ReloadOutlined,
    FileTextOutlined,
    ProfileOutlined,
    PauseCircleOutlined,
    PlayCircleOutlined,
    ExpandOutlined,
    ExportOutlined,
    CopyOutlined,
    DownloadOutlined,
    EditOutlined,
} from '@ant-design/icons';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from '../../../portal.module.css';
import Link from 'next/link';
import { DEFAULT_BEST_HOST_IP, rpcCall, VMData } from '../page';

const { Title, Text } = Typography;

interface NetworkInfo {
    dns_servers?: string[];
    gateways?: { address: string }[];
    interfaces?: any[];
    wg_info?: string;
}

// Guest RPC 调用函数
const guestRpcCall = async (bestHostIp: string, method: string, params?: any): Promise<Response> => {
    const port = '9210';
    const proxyUrl = `/api/vm-guest-rpc?host=${encodeURIComponent(bestHostIp)}&method=${encodeURIComponent(
        method,
    )}&port=${encodeURIComponent(port)}`;

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

const formatMemory = (memoryMB?: number): string => {
    if (!memoryMB) return '暂无';
    if (memoryMB >= 1024) {
        return `${(memoryMB / 1024).toFixed(2)} GB`;
    }
    return `${memoryMB} MB`;
};

const formatUptime = (uptime?: string): string => {
    if (!uptime) return '暂无';
    // uptime 格式可能是 "0h 3m" 或类似格式
    return uptime;
};

const getStatusColor = (status?: string): string => {
    if (!status) return 'default';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'running') return 'success';
    if (lowerStatus === 'stopped' || lowerStatus === 'stopping') return 'error';
    if (lowerStatus === 'starting') return 'processing';
    return 'warning';
};

const getStatusDotColor = (status?: string): string => {
    const color = getStatusColor(status);
    switch (color) {
        case 'success':
            return '#52c41a';
        case 'error':
            return '#ff4d4f';
        case 'processing':
            return '#1677ff';
        case 'warning':
            return '#faad14';
        default:
            return '#d9d9d9';
    }
};

const getFlags = (vm: any): string => {
    if (!vm.appCompose) return '无';
    const flags: string[] = [];
    if (vm.appCompose.kms_enabled) flags.push('KMS');
    if (vm.appCompose.gateway_enabled || vm.appCompose.tproxy_enabled) flags.push('网关');
    if (vm.appCompose.public_logs) flags.push('公开日志');
    if (vm.appCompose.public_sysinfo) flags.push('公开系统信息');
    if (vm.appCompose.public_tcbinfo) flags.push('公开 TCB 信息');
    return flags.length > 0 ? flags.join('、') : '无';
};

export default function VmDetailPage() {
    const router = useRouter();
    const params = useParams();
    const [messageApi, messageContextHolder] = message.useMessage();
    const [modal, modalContextHolder] = Modal.useModal();
    const vmId = params?.id as string | undefined;

    const [activeMenuKey, setActiveMenuKey] = useState<string>('overview');

    const [bestHostIp, setBestHostIp] = useState<string | null>(null);
    const [vm, setVm] = useState<VMData | null>(null);
    const [vmDetails, setVmDetails] = useState<any | null>(null);
    const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [loadingNetwork, setLoadingNetwork] = useState<boolean>(false);
    const [logStream, setLogStream] = useState<'stdout' | 'stderr'>('stdout');
    const [logsReloadKey, setLogsReloadKey] = useState<number>(0);
    const [logsContent, setLogsContent] = useState<string>('');
    const [logsLoading, setLogsLoading] = useState<boolean>(false);
    const [logsError, setLogsError] = useState<string | null>(null);
    const [upgradeModalVisible, setUpgradeModalVisible] = useState<boolean>(false);
    const [resizeModalVisible, setResizeModalVisible] = useState<boolean>(false);
    const [upgradeForm] = Form.useForm();
    const [resizeForm] = Form.useForm();
    const [availableImages, setAvailableImages] = useState<Array<{ name: string; version?: string }>>([]);
    const [environmentPublicKey, setEnvironmentPublicKey] = useState<string>('');
    const [environmentSalt, setEnvironmentSalt] = useState<string>('');

    const copyTextToClipboard = async (content?: string, label?: string) => {
        if (!content) {
            messageApi.warning(`${label || '内容'}暂无可复制内容`);
            return;
        }
        try {
            if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(content);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = content;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            messageApi.success(`${label || '内容'}已复制`);
        } catch (error) {
            console.error('Failed to copy content:', error);
            messageApi.error('复制失败，请稍后重试');
        }
    };

    const downloadTextFile = (filename: string, content?: string) => {
        if (!content) {
            messageApi.warning('暂无可下载的 Compose 内容');
            return;
        }
        if (typeof window === 'undefined') {
            messageApi.warning('当前环境不支持下载');
            return;
        }
        try {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            messageApi.success('Compose 文件已下载');
        } catch (error) {
            console.error('Failed to download compose file:', error);
            messageApi.error('下载失败，请稍后重试');
        }
    };

    // 读取 bestHostIp
    useEffect(() => {
        const storedBestHostIp = typeof window !== 'undefined' ? localStorage.getItem('bestHostIp') : null;
        if (storedBestHostIp) {
            setBestHostIp(storedBestHostIp);
        } else {
            setBestHostIp(DEFAULT_BEST_HOST_IP);
        }
    }, []);

    const loadEnvEncryptionInfo = async (appId?: string | null) => {
        if (!bestHostIp || !appId) {
            setEnvironmentPublicKey('');
            setEnvironmentSalt('');
            return;
        }
        try {
            const response = await rpcCall(bestHostIp, 'GetAppEnvEncryptPubKey', {
                app_id: appId,
            });
            const data = await response.json();
            setEnvironmentPublicKey(data?.public_key || '');
            setEnvironmentSalt(data?.salt || '');
        } catch (error) {
            console.error('Error loading environment encryption info:', error);
            setEnvironmentPublicKey('');
            setEnvironmentSalt('');
        }
    };

    const loadDetails = async (
        options?: { silent?: boolean; skipLoadingState?: boolean },
    ): Promise<(VMData & { appCompose: any }) | null> => {
        if (!bestHostIp || !vmId) return null;
        if (!options?.skipLoadingState) {
            setLoading(true);
        }
        try {
            const response = await rpcCall(bestHostIp, 'Status', {
                brief: false,
                ids: [vmId],
            });
            const data = await response.json();
            const detailed = data.vms && data.vms.length > 0 ? data.vms[0] : null;
            console.log('detailed', detailed);

            if (!detailed) {
                if (!options?.silent) {
                    messageApi.error('未找到该虚拟机');
                }
                return null;
            }

            let appCompose: any = {};
            try {
                appCompose = JSON.parse(detailed.configuration?.compose_file || '{}');
            } catch (e) {
                console.error('Error parsing app compose:', e);
            }

            const fullVm = { ...detailed, appCompose } as VMData & { appCompose: any };
            setVm(fullVm);
            setVmDetails(fullVm);
            loadEnvEncryptionInfo(fullVm?.app_id);
            return fullVm;
        } catch (error) {
            console.error('Error loading VM details:', error);
            if (!options?.silent) {
                messageApi.error('加载虚拟机详情失败');
            }
            return null;
        } finally {
            if (!options?.skipLoadingState) {
                setLoading(false);
            }
        }
    };

    const loadNetwork = async () => {
        if (!bestHostIp || !vmId || !vmDetails || vmDetails.status !== 'running') return;
        setLoadingNetwork(true);
        try {
            const response = await guestRpcCall(bestHostIp, 'NetworkInfo', { id: vmId });
            const data = await response.json();
            setNetworkInfo(data);
        } catch (error) {
            console.error('Error loading network info:', error);
            messageApi.warning('获取网络信息失败');
        } finally {
            setLoadingNetwork(false);
        }
    };

    useEffect(() => {
        if (bestHostIp && vmId) {
            loadDetails();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bestHostIp, vmId]);

    useEffect(() => {
        if (!bestHostIp || !vmId) return;

        let destroyed = false;
        let refreshing = false;

        const refreshDetails = async () => {
            if (destroyed || refreshing) return;
            refreshing = true;
            try {
                await loadDetails({ silent: true, skipLoadingState: true });
            } finally {
                refreshing = false;
            }
        };

        const intervalId = window.setInterval(refreshDetails, 5000);

        return () => {
            destroyed = true;
            window.clearInterval(intervalId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bestHostIp, vmId]);

    useEffect(() => {
        if (vmDetails && vmDetails.status === 'running') {
            loadNetwork();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vmDetails]);

    // 加载可用镜像列表
    const loadImages = async () => {
        if (!bestHostIp) return;
        try {
            const response = await rpcCall(bestHostIp, 'ListImages');
            const data = await response.json();
            setAvailableImages(data.images || []);
        } catch (error) {
            console.error('Error loading images:', error);
        }
    };

    useEffect(() => {
        if (bestHostIp) {
            loadImages();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bestHostIp]);

    // 添加菜单样式
    useEffect(() => {
        const styleId = 'vm-detail-menu-styles';
        if (document.getElementById(styleId)) {
            return;
        }
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .vm-detail-menu .ant-menu-item {
                border-radius: 8px !important;
                transition: background-color 0.2s ease, color 0.2s ease;
            }
            .vm-detail-menu .ant-menu-item-selected {
                background-color: #E6F2FF !important;
                color: #1677ff !important;
            }
            .vm-detail-menu .ant-menu-item-selected .anticon {
                color: #1677ff !important;
            }
            .vm-detail-menu .ant-menu-item:hover {
                background-color: #F2F4F7 !important;
                color: #0F172A !important;
            }
            .vm-detail-menu .ant-menu-item:hover .anticon {
                color: #0F172A !important;
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

    const statusText = vmDetails?.status || '暂无';
    const statusColor = getStatusColor(vmDetails?.status);
    const statusDotColor = getStatusDotColor(vmDetails?.status);
    const normalizedStatus = (vmDetails?.status || '').toLowerCase();
    const isStoppedState = normalizedStatus === 'stopped' || normalizedStatus === 'exited' || normalizedStatus === 'created';
    const disableUpdateAndResize = normalizedStatus === 'running';

    const memoryTotal = vmDetails?.configuration?.memory || 0;
    const memoryTotalGB = memoryTotal / 1024; // 转换为GB
    const storageTotal = vmDetails?.configuration?.disk_size || 0;

    const menuItems: MenuProps['items'] = [
        {
            key: 'overview',
            icon: <DashboardOutlined />,
            label: '概览',
        },
        {
            key: 'logs',
            icon: <FileTextOutlined />,
            label: '日志输出',
        },
        {
            key: 'network',
            icon: <GlobalOutlined />,
            label: '网络信息',
        },
        // {
        //     key: 'kms',
        //     icon: <SafetyOutlined />,
        //     label: 'KMS Info',
        // },
        {
            key: 'attestations',
            icon: <SafetyOutlined />,
            label: '可信证明',
        },
        {
            key: 'config',
            icon: <ProfileOutlined />,
            label: '应用配置',
        },
        // {
        //     key: 'events',
        //     icon: <ApiOutlined />,
        //     label: 'Events',
        // },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: '设置',
        },
    ];

    const renderPortMappings = () => {
        const ports = vmDetails?.configuration?.ports;
        if (!ports || ports.length === 0) {
            return null;
        }
        return (
            <Card
                title="端口映射"
                bordered={false}
                style={{ borderRadius: 16 }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {ports.map((port, index) => (
                        <div
                            key={`${port.host_port}-${port.vm_port}-${index}`}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                border: '1px solid #f0f0f0',
                                borderRadius: 12,
                                padding: '12px 16px',
                                flexWrap: 'wrap',
                                gap: 8,
                            }}
                        >
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>暴露方式</Text>
                                <div style={{ fontWeight: 500, marginTop: 4 }}>
                                    {!port.host_address || port.host_address === '127.0.0.1' ? '本地' : '公网'}
                                </div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>协议</Text>
                                <div style={{ fontWeight: 500, marginTop: 4 }}>{port.protocol?.toUpperCase() || 'TCP'}</div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>宿主机端口</Text>
                                <div style={{ fontWeight: 500, marginTop: 4 }}>{port.host_port ?? '暂无'}</div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>VM 端口</Text>
                                <div style={{ fontWeight: 500, marginTop: 4 }}>{port.vm_port ?? '暂无'}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        );
    };

    const renderOverviewContent = () => (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={[16, 16]} align="stretch">
                <Col xs={24} md={8}>
                    <Card
                        title="系统信息"
                        bordered={false}
                        style={{ borderRadius: 16, height: '100%' }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>操作系统</Text>
                                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>
                                    {vmDetails?.image_version || vmDetails?.configuration?.image || 'DStack 0.3.6'}
                                </div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>处理器</Text>
                                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>
                                    {vmDetails?.configuration?.vcpu || '暂无'} vCPUs
                                </div>
                            </div>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>运行时长</Text>
                                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>
                                    {formatUptime(vmDetails?.uptime)}
                                </div>
                            </div>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card
                        title="内存使用"
                        bordered={false}
                        style={{ borderRadius: 16, height: '100%' }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>配置内存</Text>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>
                                {memoryTotal > 0 ? `${memoryTotalGB.toFixed(2)} GB` : '暂无'}
                            </div>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card
                        title="存储空间"
                        bordered={false}
                        style={{ borderRadius: 16, height: '100%' }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>配置磁盘大小</Text>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>
                                {storageTotal > 0 ? `${storageTotal.toFixed(2)} GB` : '暂无'}
                            </div>
                        </div>
                    </Card>
                </Col>
            </Row>
        </Space>
    );

    const renderLogsContent = () => {
        const vmIdForLog = vmDetails?.id;

        const buildLogsApiUrl = (options?: { follow?: boolean }) => {
            if (!bestHostIp || !vmIdForLog) return '';
            const params = new URLSearchParams({
                host: bestHostIp,
                id: vmIdForLog,
                follow: options?.follow ? 'true' : 'false',
                ansi: 'false',
                lines: '200',
            });
            if (logStream === 'stderr') {
                params.set('ch', 'stderr');
            }
            return `/api/vm-logs?${params.toString()}`;
        };

        const fetchLogs = async () => {
            const url = buildLogsApiUrl();
            if (!url) {
                return;
            }
            setLogsLoading(true);
            setLogsError(null);
            try {
                const resp = await fetch(url);
                if (!resp.ok) {
                    const text = await resp.text();
                    throw new Error(text || `请求失败: ${resp.status}`);
                }
                const text = await resp.text();
                setLogsContent(text || '(no logs)');
            } catch (e: any) {
                console.error('加载日志失败', e);
                setLogsError(e?.message || '加载日志失败');
            } finally {
                setLogsLoading(false);
            }
        };

        const handleOpenInNewWindow = () => {
            const url = buildLogsApiUrl({ follow: true });
            if (!url) {
                messageApi.warning('日志 URL 不可用，请确认虚拟机已运行且已设置最佳主机 IP');
                return;
            }
            window.open(url, '_blank');
        };

        const handleReload = () => {
            setLogsReloadKey((prev) => prev + 1);
        };

        useEffect(() => {
            if (!bestHostIp || !vmIdForLog) return;
            fetchLogs();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [bestHostIp, vmIdForLog, logStream, logsReloadKey]);

        const hasBasicInfo = !!(bestHostIp && vmIdForLog);

        const renderLogLines = (content: string) => {
            if (!content) return null;

            const statusColorMap: Record<string, string> = {
                ok: '#52c41a',
                success: '#52c41a',
                pass: '#52c41a',
                warn: '#faad14',
                warning: '#faad14',
                info: '#1890ff',
                failed: '#ff4d4f',
                fail: '#ff4d4f',
                error: '#ff4d4f',
            };

            return content.split('\n').map((line, index) => {
                if (!line.trim()) {
                    return <div key={`log-line-${index}`} style={{ minHeight: 14 }} />;
                }

                const statusMatch = line.match(/(\[\s*([A-Z ]+)\s*\])/i);
                if (statusMatch) {
                    const fullMatch = statusMatch[1];
                    const keyword = statusMatch[2].trim().toLowerCase();
                    const statusColor = statusColorMap[keyword];
                    if (statusColor) {
                        const matchIndex = statusMatch.index ?? 0;
                        const before = line.slice(0, matchIndex);
                        const after = line.slice(matchIndex + fullMatch.length);
                        return (
                            <div
                                key={`log-line-${index}`}
                                style={{
                                    display: 'flex',
                                    fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
                                    fontSize: 12,
                                    lineHeight: 1.6,
                                    color: '#1f1f1f',
                                    wordBreak: 'break-word',
                                }}
                            >
                                <span>{before}</span>
                                <span
                                    style={{
                                        margin: '0 4px',
                                        color: statusColor,
                                        fontWeight: 600,
                                    }}
                                >
                                    {fullMatch}
                                </span>
                                <span>{after}</span>
                            </div>
                        );
                    }
                }

                return (
                    <div
                        key={`log-line-${index}`}
                        style={{
                            fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
                            fontSize: 12,
                            lineHeight: 1.6,
                            color: '#1f1f1f',
                            wordBreak: 'break-word',
                        }}
                    >
                        {line}
                    </div>
                );
            });
        };

        return (
            <Card
                bordered={false}
                style={{ borderRadius: 16 }}
                title={
                    <Space size={8} align="center" wrap>
                        <Text style={{ fontSize: 14, color: '#8c8c8c', fontWeight: 500 }}>日志流</Text>
                        <Select
                            size="small"
                            style={{ minWidth: 140 }}
                            value={logStream}
                            onChange={(value: 'stdout' | 'stderr') => {
                                setLogStream(value);
                                setLogsReloadKey((prev) => prev + 1);
                            }}
                            options={[
                                { label: '内核 / 标准输出', value: 'stdout' },
                                { label: '错误输出', value: 'stderr' },
                            ]}
                        />
                    </Space>
                }
                extra={
                    <Space size={8} wrap>
                        <Button
                            // size="small"
                            onClick={handleOpenInNewWindow}
                            disabled={!hasBasicInfo}
                        >
                            在新窗口打开
                        </Button>
                        <Button
                            // size="small"
                            onClick={handleReload}
                            disabled={!hasBasicInfo}
                        >
                            重新加载{/* 清空并重新加载 */}
                        </Button>
                    </Space>
                }
            >
                <div
                    style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 12,
                        overflow: 'hidden',
                        height: 480,
                        background: '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {!hasBasicInfo ? (
                        <div
                            style={{
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 24,
                            }}
                        >
                            <Text type="secondary" style={{ textAlign: 'center' }}>
                                日志视图不可用，请确认虚拟机已创建并记录了 ID，且已设置最佳主机 IP。
                            </Text>
                        </div>
                    ) : logsLoading ? (
                        <div
                            style={{
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 24,
                            }}
                        >
                            <Spin tip="加载日志中..." />
                        </div>
                    ) : logsError ? (
                        <div
                            style={{
                                whiteSpace: 'pre-wrap',
                                color: '#ff7875',
                                padding: 16,
                            }}
                        >
                            {logsError}
                        </div>
                    ) : (
                        <div
                            style={{
                                flex: 1,
                                padding: '16px 20px',
                                background: '#f9fafb',
                                overflowY: 'auto',
                                borderTop: '1px solid #f0f0f0',
                            }}
                        >
                            {renderLogLines(logsContent)}
                        </div>
                    )}
                </div>
                <Divider />
                <Descriptions column={1} colon={false}>
                    <Descriptions.Item label="公开日志">
                        {vmDetails?.appCompose?.public_logs ? '已启用' : '未启用'}
                    </Descriptions.Item>
                    <Descriptions.Item label="公开系统信息">
                        {vmDetails?.appCompose?.public_sysinfo ? '已启用' : '未启用'}
                    </Descriptions.Item>
                    <Descriptions.Item label="公开 TCB 信息">
                        {vmDetails?.appCompose?.public_tcbinfo ? '已启用' : '未启用'}
                    </Descriptions.Item>
                </Descriptions>
            </Card>
        );
    };

    const renderNetworkContent = () => {
        if (!vmDetails) {
            return <Empty description="未加载虚拟机数据" />;
        }
        if (vmDetails.status !== 'running') {
            return (
                <Card bordered={false} style={{ borderRadius: 16 }}>
                    <Title level={4} style={{ marginBottom: 12 }}>网络</Title>
                    <Text type="secondary">只有当虚拟机运行时才能获取网络信息。</Text>
                </Card>
            );
        }

        const dnsServersText = networkInfo?.dns_servers?.join('\n') || '';
        const gatewaysText =
            networkInfo?.gateways?.map((gw: any) => gw?.address || gw)?.join('\n') || '';
        const hasInterfaces = !!networkInfo?.interfaces?.length;
        const hasWireGuardInfo = !!networkInfo?.wg_info;

        return (
            // <Card title="仪表盘">
            //     <div>
            //     </div>
            // </Card>
            <Card
                bordered={false}
                style={{ borderRadius: 16 }}
                title="网络信息"
                extra={
                    <Button icon={<ReloadOutlined />} onClick={loadNetwork} loading={loadingNetwork}>
                        刷新
                    </Button>
                }
            >
                {loadingNetwork ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Spin />
                    </div>
                ) : networkInfo ? (
                    <Space direction="vertical" size={24} style={{ width: '100%' }}>
                        <Row gutter={[24, 24]}>
                            <Col xs={24} md={12}>
                                <div>
                                    <Title level={5} style={{ margin: 0 }}>
                                        DNS 服务器
                                    </Title>
                                    <div style={{ marginTop: 12 }}>
                                        <Input.TextArea
                                            value={dnsServersText}
                                            readOnly
                                            autoSize={{ minRows: 1, maxRows: 4 }}
                                            placeholder="暂无"
                                            style={{ width: '100%', background: '#f7f9fc' }}
                                        />
                                    </div>
                                </div>
                            </Col>
                            <Col xs={24} md={12}>
                                <div>
                                    <Title level={5} style={{ margin: 0 }}>
                                        网关
                                    </Title>
                                    <div style={{ marginTop: 12 }}>
                                        <Input.TextArea
                                            value={gatewaysText}
                                            readOnly
                                            autoSize={{ minRows: 1, maxRows: 4 }}
                                            placeholder="暂无"
                                            style={{ width: '100%', background: '#f7f9fc' }}
                                        />
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        {hasInterfaces && (
                            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                {networkInfo.interfaces?.map((iface: any, index: number) => {
                                    const addressList =
                                        iface?.addresses
                                            ?.map(
                                                (addr: any) =>
                                                    `${addr?.address ?? ''}${
                                                        addr?.prefix ? `/${addr.prefix}` : ''
                                                    }`.trim(),
                                            )
                                            .filter(Boolean) || [];
                                    const renderTraffic = (
                                        bytes?: number,
                                        errors?: number,
                                        emptyText = '暂无',
                                    ) =>
                                        typeof bytes === 'number'
                                            ? `${bytes.toLocaleString()} 字节（${errors ?? 0} 错误）`
                                            : `${emptyText}（${errors ?? 0} 错误）`;
                                    return (
                                        <div
                                            key={iface?.name || index}
                                            style={{
                                                border: '1px solid #e6ebf1',
                                                borderRadius: 12,
                                                padding: '16px 20px',
                                                background: '#fbfdff',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                    gap: 8,
                                                }}
                                            >
                                                <Space align="center" size={8}>
                                                    <Title level={5} style={{ margin: 0 }}>
                                                        网络接口 {iface?.name || '未知'}
                                                    </Title>
                                                    {iface?.state && (
                                                        <Tag
                                                            color={iface.state === 'up' ? 'green' : 'default'}
                                                            style={{ borderRadius: 999 }}
                                                        >
                                                            {iface.state.toUpperCase()}
                                                        </Tag>
                                                    )}
                                                </Space>
                                                {typeof iface?.mtu === 'number' && (
                                                    <Text type="secondary">MTU {iface.mtu}</Text>
                                                )}
                                            </div>
                                            <div style={{ marginTop: 12 }}>
                                                {addressList.length > 0 ? (
                                                    <Space size={8} wrap>
                                                        {addressList.map((addr: string, idx: number) => (
                                                            <Tag
                                                                key={`${iface?.name || index}-addr-${idx}`}
                                                                color="blue"
                                                                style={{ borderRadius: 12, padding: '2px 10px' }}
                                                            >
                                                                {addr}
                                                            </Tag>
                                                        ))}
                                                    </Space>
                                                ) : (
                                                    <Text type="secondary">暂无 IP 地址</Text>
                                                )}
                                            </div>
                                            <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
                                                    <Col xs={24} md={12}>
                                                        <div>
                                                            <Text type="secondary">接收</Text>
                                                            <div style={{ fontWeight: 500, marginTop: 4 }}>
                                                                {renderTraffic(iface?.rx_bytes, iface?.rx_errors)}
                                                            </div>
                                                        </div>
                                                    </Col>
                                                    <Col xs={24} md={12}>
                                                        <div>
                                                            <Text type="secondary">发送</Text>
                                                            <div style={{ fontWeight: 500, marginTop: 4 }}>
                                                                {renderTraffic(iface?.tx_bytes, iface?.tx_errors)}
                                                            </div>
                                                        </div>
                                                    </Col>
                                            </Row>
                                        </div>
                                    );
                                })}
                            </Space>
                        )}

                        {hasWireGuardInfo && (
                            <>
                                <Divider style={{ margin: '12px 0 4px' }} />
                                <div>
                                    <Title level={5} style={{ margin: 0 }}>
                                        WireGuard 信息
                                    </Title>
                                    <pre
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            fontSize: 12,
                                            maxHeight: 320,
                                            overflow: 'auto',
                                            background: '#f7f9fc',
                                            borderRadius: 12,
                                            padding: 12,
                                            marginTop: 12,
                                        }}
                                    >
                                        {networkInfo.wg_info}
                                    </pre>
                                </div>
                            </>
                        )}
                    </Space>
                ) : (
                    <Empty description="未获取到网络信息" />
                )}
            </Card>
        );
    };

    const kmsEnabled = !!(vmDetails?.appCompose?.kms_enabled || vmDetails?.appCompose?.features?.includes('kms'));
    const kmsSecretKeys = (() => {
        const encrypted = (vmDetails as any)?.appCompose?.encrypted_envs;
        if (!encrypted) return [];
        if (Array.isArray(encrypted)) {
            return encrypted.map((item: any) => item?.key || item?.name || item).filter(Boolean);
        }
        if (typeof encrypted === 'object') {
            return Object.keys(encrypted);
        }
        return [];
    })();

    const renderKmsContent = () => (
        <Card bordered={false} style={{ borderRadius: 16 }}>
            <Title level={4} style={{ marginBottom: 12 }}>KMS 信息</Title>
            <Descriptions column={1} colon={false}>
                <Descriptions.Item label="是否启用 KMS">{kmsEnabled ? '是' : '否'}</Descriptions.Item>
                <Descriptions.Item label="更新代码权限">
                    {kmsEnabled ? '可以使用更新代码功能' : '启用 KMS 后才能使用更新代码'}
                </Descriptions.Item>
            </Descriptions>
            <Divider />
            <Title level={5} style={{ margin: '8px 0' }}>加密环境变量键</Title>
            {kmsSecretKeys.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {kmsSecretKeys.map((key) => (
                        <Tag key={key} color="blue" style={{ borderRadius: 12, padding: '2px 12px' }}>
                            {key}
                        </Tag>
                    ))}
                </div>
            ) : (
                <Text type="secondary">尚未配置加密环境变量。</Text>
            )}
        </Card>
    );

    const renderAttestationsContent = () => {
        const attestation = vmDetails?.attestation || vmDetails?.tcb_info;
        return (
            <Card bordered={false} style={{ borderRadius: 16 }} title="可信证明">
                {attestation ? (
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(attestation, null, 2)}</pre>
                ) : (
                    <Text type="secondary">该虚拟机暂无可显示的 TCB/Attestation 数据。</Text>
                )}
            </Card>
        );
    };

    const openUpdateCodeModal = () => {
        if (!vmDetails) {
            messageApi.warning('虚拟机详情未加载');
            return;
        }
        const kmsEnabled =
            vmDetails.appCompose?.kms_enabled || vmDetails.appCompose?.features?.includes('kms');
        if (!kmsEnabled) {
            messageApi.warning('该虚拟机不支持更新代码功能（需要启用 KMS）');
            return;
        }
        setUpgradeModalVisible(true);
        const appCompose = vmDetails.appCompose || {};
        upgradeForm.setFieldsValue({
            dockerComposeFile: appCompose.docker_compose_file || '',
            preLaunchScript: appCompose.pre_launch_script || '',
            userConfig: vmDetails?.configuration?.user_config || '',
        });
    };

    const renderAppConfigContent = () => {
        const composeContent =
            vmDetails?.appCompose?.docker_compose_file || vmDetails?.configuration?.compose_file || '';
        const displayEnvironmentPublicKey =
            environmentPublicKey ||
            (vmDetails?.appCompose as any)?.environment_public_key ||
            vmDetails?.configuration?.environment_public_key ||
            '';
        const saltValue =
            environmentSalt ||
            (vmDetails?.appCompose as any)?.salt ||
            vmDetails?.configuration?.salt ||
            '';
        const composeFileName = `${vmDetails?.appCompose?.name || vmDetails?.name || 'app'}-compose.yml`;

        return (
            <Card bordered={false} style={{ borderRadius: 16 }} title="应用配置">
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <div>
                        <Title level={5} style={{ margin: 0 }}>
                            环境加密公钥
                        </Title>
                        <div style={{ display: 'flex', gap: 8 , marginTop: '12px' }}>
                            <Input.TextArea
                                value={displayEnvironmentPublicKey}
                                readOnly
                                autoSize={{ minRows: 1, maxRows: 6 }}
                                placeholder="暂无"
                                style={{ flex: 1, background: '#f7f9fc' }}
                            />
                            <Button
                                // size="small"
                                icon={<CopyOutlined />}
                                disabled={!displayEnvironmentPublicKey}
                                onClick={() =>
                                    copyTextToClipboard(displayEnvironmentPublicKey, 'Environment Public Key')
                                }
                            >
                                复制
                            </Button>
                        </div>
                    </div>

                    <div>
                        <Title level={5} style={{ margin: 0 }}>
                            Salt 值
                        </Title>
                        <div style={{ display: 'flex', gap: 8 , marginTop: '12px' }}>
                            <Input
                                value={saltValue}
                                readOnly
                                placeholder="暂无"
                                style={{ flex: 1, background: '#f7f9fc' }}
                            />
                            <Button
                                // size="small"
                                icon={<CopyOutlined />}
                                disabled={!saltValue}
                                onClick={() => copyTextToClipboard(saltValue, 'Salt')}
                            >
                                复制
                            </Button>
                        </div>
                    </div>
                </Space>

                <Divider />
                {composeContent ? (
                    <>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 12,
                                flexWrap: 'wrap',
                            }}
                        >
                            <Title level={5} style={{ margin: 0 }}>
                                Docker Compose
                            </Title>
                            <Space wrap>
                                <Button
                                    icon={<DownloadOutlined />}
                                    onClick={() => downloadTextFile(composeFileName, composeContent)}
                                >
                                    下载
                                </Button>
                                <Button
                                    icon={<CopyOutlined />}
                                    onClick={() => copyTextToClipboard(composeContent, 'Docker Compose')}
                                >
                                    复制
                                </Button>
                                <Button
                                    icon={<EditOutlined />}
                                    type="primary"
                                    ghost
                                    onClick={openUpdateCodeModal}
                                    disabled={disableUpdateAndResize}
                                >
                                    编辑
                                </Button>
                            </Space>
                        </div>
                        <pre
                            style={{
                                whiteSpace: 'pre-wrap',
                                fontSize: 12,
                                maxHeight: 320,
                                overflow: 'auto',
                                background: '#f7f9fc',
                                borderRadius: 12,
                                padding: 12,
                                marginTop: 12,
                            }}
                        >
                            {composeContent}
                        </pre>
                    </>
                ) : (
                    <Text type="secondary">暂无可显示的 Compose 文件。</Text>
                )}
            </Card>
        );
    };

    const renderEventsContent = () => {
        const events = (vmDetails as any)?.events || (vmDetails as any)?.recent_events;
        return (
            <Card bordered={false} style={{ borderRadius: 16 }}>
                <Title level={4} style={{ marginBottom: 12 }}>事件</Title>
                {events?.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {events.map((event: any, idx: number) => (
                            <div key={`${event.id || idx}`} style={{ border: '1px solid #f0f0f0', borderRadius: 12, padding: 12 }}>
                                <div style={{ fontWeight: 500 }}>{event.title || event.message || '事件'}</div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {event.timestamp || event.time || ''}
                                </Text>
                                {event.details && (
                                    <div style={{ marginTop: 8, fontSize: 12 }}>
                                        {typeof event.details === 'string' ? event.details : JSON.stringify(event.details)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <Text type="secondary">暂无事件记录。</Text>
                )}
            </Card>
        );
    };

    const renderSettingsContent = () => (
        <Card bordered={false} style={{ borderRadius: 16 }}>
            <Title level={4} style={{ marginBottom: 12 }}>设置</Title>
            <Descriptions column={1} colon={false}>
                <Descriptions.Item label="标记">{getFlags(vmDetails || {})}</Descriptions.Item>
                <Descriptions.Item label="最佳主机 IP">{bestHostIp || '暂无'}</Descriptions.Item>
                <Descriptions.Item label="状态">{statusText}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <Text type="secondary">如需修改配置，请使用更新代码或调整配置对话框。</Text>
        </Card>
    );

    const renderContent = () => {
        const sections: Record<string, React.ReactNode> = {
            overview: renderOverviewContent(),
            logs: renderLogsContent(),
            network: renderNetworkContent(),
            kms: renderKmsContent(),
            attestations: renderAttestationsContent(),
            config: renderAppConfigContent(),
            events: renderEventsContent(),
            settings: renderSettingsContent(),
        };

        return sections[activeMenuKey] || sections.overview;
    };

    const handleStart = async () => {
        if (!bestHostIp || !vmId) {
            messageApi.warning('请先设置最佳主机 IP');
            return;
        }
        try {
            await rpcCall(bestHostIp, 'StartVm', { id: vmId });
            messageApi.success('虚拟机启动成功');
            loadDetails();
        } catch (error) {
            console.error('Error starting VM:', error);
            messageApi.error('启动虚拟机失败');
        }
    };

    // 重启 VM
    const handleRestart = async () => {
        if (!bestHostIp || !vmId) {
            messageApi.warning('请先设置最佳主机 IP');
            return;
        }
        modal.confirm({
            title: '请确认是否重启虚拟机?',
            content: `您正在重启 "${vmDetails?.name || '虚拟机'}"。`,
            okText: '确认',
            cancelText: '取消',
            onOk: async () => {
                try {
                    // 先停止
                    await rpcCall(bestHostIp, 'StopVm', { id: vmId });
                    // 等待一下再启动
                    setTimeout(async () => {
                        await rpcCall(bestHostIp, 'StartVm', { id: vmId });
                        messageApi.success('虚拟机重启成功');
                        loadDetails();
                    }, 1000);
                } catch (error) {
                    console.error('Error restarting VM:', error);
                    messageApi.error('重启虚拟机失败');
                }
            },
        });
    };

    // 优雅关闭 VM
    const handleShutdown = async () => {
        if (!bestHostIp || !vmId) {
            messageApi.warning('请先设置最佳主机 IP');
            return;
        }
        modal.confirm({
            title: '请确认是否关闭虚拟机?',
            content: `您正在关闭 "${vmDetails?.name || '虚拟机'}"。`,
            okText: '确认',
            cancelText: '取消',
            onOk: async () => {
                try {
                    await rpcCall(bestHostIp, 'ShutdownVm', { id: vmId });
                    messageApi.success('虚拟机正在关闭');
                    loadDetails();
                } catch (error) {
                    console.error('Error shutting down VM:', error);
                    const updatedVm = await loadDetails({ silent: true });
                    const isStopped = updatedVm && updatedVm.status && updatedVm.status.toLowerCase() !== 'running';
                    if (isStopped) {
                        messageApi.success('虚拟机已关闭');
                        return;
                    }
                    const errorMessage = error instanceof Error ? error.message : '关闭虚拟机失败';
                    messageApi.error(errorMessage);
                }
            },
        });
    };

    // 强制停止 VM
    const handlePowerOff = async () => {
        if (!bestHostIp || !vmId) {
            messageApi.warning('请先设置最佳主机 IP');
            return;
        }
        modal.confirm({
            title: '请确认是否强制停止虚拟机?',
            content: `您正在强制停止 "${vmDetails?.name || '虚拟机'}"，这可能会导致数据损坏。`,
            okText: '确认',
            cancelText: '取消',
            okType: 'danger',
            onOk: async () => {
                try {
                    await rpcCall(bestHostIp, 'StopVm', { id: vmId });
                    messageApi.success('虚拟机已停止');
                    loadDetails();
                } catch (error) {
                    console.error('Error stopping VM:', error);
                    messageApi.error('停止虚拟机失败');
                }
            },
        });
    };

    // 更新代码
    const handleUpdateCode = () => {
        openUpdateCodeModal();
    };

    // 调整大小
    const handleResize = () => {
        if (!vmDetails) {
            messageApi.warning('虚拟机详情未加载');
            return;
        }
        setResizeModalVisible(true);
        // 初始化表单数据
        const config = vmDetails?.configuration || {};
        const memoryMB = config.memory || 0;
        const memoryValue = memoryMB >= 1024 ? (memoryMB / 1024).toFixed(1) : memoryMB;
        const memoryUnit = memoryMB >= 1024 ? 'GB' : 'MB';
        resizeForm.setFieldsValue({
            vcpu: config.vcpu || 1,
            memoryValue: memoryValue,
            memoryUnit: memoryUnit,
            disk_size: config.disk_size || 10,
            image: config.image || '',
        });
    };

    // 执行更新代码
    const handleUpgradeSubmit = async () => {
        if (!bestHostIp || !vmId || !vmDetails) return;
        try {
            const values = await upgradeForm.validateFields();
            const appCompose = {
                ...vmDetails.appCompose,
                docker_compose_file: values.dockerComposeFile,
                pre_launch_script: values.preLaunchScript?.trim() || undefined,
            };
            const body: any = {
                id: vmId,
                compose_file: JSON.stringify(appCompose),
                user_config: values.userConfig || '',
            };
            await rpcCall(bestHostIp, 'UpgradeApp', body);
            messageApi.success('代码更新成功');
            setUpgradeModalVisible(false);
            loadDetails();
        } catch (error) {
            console.error('Error upgrading VM:', error);
            messageApi.error('更新代码失败');
        }
    };

    // 执行调整大小
    const handleResizeSubmit = async () => {
        if (!bestHostIp || !vmId || !vmDetails) return;
        try {
            const values = await resizeForm.validateFields();
            const memoryMB = values.memoryUnit === 'GB' ? values.memoryValue * 1024 : values.memoryValue;
            await rpcCall(bestHostIp, 'ResizeVm', {
                id: vmId,
                vcpu: values.vcpu,
                memory: memoryMB,
                disk_size: values.disk_size,
                image: values.image,
            });
            messageApi.success('虚拟机容量调整成功');
            setResizeModalVisible(false);
            loadDetails();
        } catch (error) {
            console.error('Error resizing VM:', error);
            messageApi.error('调整大小失败');
        }
    };

    const actionMenuItems = isStoppedState
        ? [
              {
                  key: 'start',
                  label: '启动',
                  icon: <PlayCircleOutlined />,
                  onClick: handleStart,
              },
              {
                  key: 'update',
                  label: '更新代码',
                  icon: <ExpandOutlined />,
                  onClick: handleUpdateCode,
                  disabled: disableUpdateAndResize,
              },
              {
                  key: 'resize',
                  label: '调整配置',
                  icon: <ExpandOutlined />,
                  onClick: handleResize,
                  disabled: disableUpdateAndResize,
              },
          ]
        : [
              {
                  key: 'restart',
                  label: '重启',
                  icon: <ReloadOutlined />,
                  onClick: handleRestart,
              },
              {
                  key: 'shutdown',
                  label: '关闭',
                  icon: <PauseCircleOutlined />,
                  onClick: handleShutdown,
              },
              {
                  key: 'update',
                  label: '更新代码',
                  icon: <ExpandOutlined />,
                  onClick: handleUpdateCode,
                  disabled: disableUpdateAndResize,
              },
              {
                  key: 'resize',
                  label: '调整配置',
                  icon: <ExpandOutlined />,
                  onClick: handleResize,
                  disabled: disableUpdateAndResize,
              },
          ];

    return (
        <PortalLayout>
            {messageContextHolder}
            {modalContextHolder}
            <div className={styles.portalContent}>
                {/* 返回按钮 */}
                <div
                    style={{
                        marginBottom: 16,
                        borderRadius: 16,
                        background: '#fafafa',
                        padding: '10px 16px',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                        border: 'none',
                    }}
                    onClick={() => router.push('/developers/start')}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f0f0f0';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fafafa';
                    }}
                >
                    <ArrowLeftOutlined style={{ fontSize: 14, color: '#333' }} />
                    <span style={{ fontSize: 14, color: '#333', fontWeight: 400 }}>返回应用列表</span>
                </div>
                {/* 顶部Header区域 - 参考图片布局 */}
                <Card
                    bordered={false}
                    style={{
                        marginBottom: 24,
                        borderRadius: 16,
                        background: '#fff',
                    }}
                    bodyStyle={{ padding: '20px 24px' }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* 第一行：状态点、名称、状态标签 + 操作按钮 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: statusDotColor,
                                    }}
                                />
                                <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
                                    {vmDetails?.name || '虚拟机'}
                                </Title>
                                <Tag color={statusColor} style={{ borderRadius: 12, padding: '2px 12px' }}>
                                    {statusText.toUpperCase()}
                                </Tag>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {isStoppedState ? (
                                    <Button
                                        type="primary"
                                        icon={<PlayCircleOutlined />}
                                        onClick={handleStart}
                                        loading={loading}
                                    >
                                        启动
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            icon={<ReloadOutlined />}
                                            onClick={handleRestart}
                                            loading={loading}
                                        >
                                            重启
                                        </Button>
                                        <Button icon={<PauseCircleOutlined />} onClick={handleShutdown}>
                                            关闭
                                        </Button>
                                    </>
                                )}
                                <Button icon={<ExportOutlined />} onClick={handleUpdateCode} disabled={disableUpdateAndResize}>
                                    更新代码
                                </Button>
                                <Button icon={<ExpandOutlined />} onClick={handleResize} disabled={disableUpdateAndResize}>
                                    调整配置
                                </Button>
                                {/* <Dropdown
                                    menu={{
                                        items: actionMenuItems,
                                    }}
                                    trigger={['click']}
                                >
                                    <Button icon={<MoreOutlined />} />
                                </Dropdown> */}
                            </div>
                        </div>

                        {/* 第二行：vCPU、内存、磁盘大小 + 版本标签 */}
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
                            <Text type="secondary" style={{ fontSize: 14 }}>
                                {vmDetails?.configuration?.vcpu || '暂无'} vCPU
                            </Text>
                            <div style={{ width: 1, height: 14, background: '#d9d9d9', margin: '0 12px' }} />
                            <Text type="secondary" style={{ fontSize: 14 }}>
                                {formatMemory(vmDetails?.configuration?.memory)}
                            </Text>
                            <div style={{ width: 1, height: 14, background: '#d9d9d9', margin: '0 12px' }} />
                            <Text type="secondary" style={{ fontSize: 14 }}>
                                {vmDetails?.configuration?.disk_size
                                    ? `${vmDetails?.configuration?.disk_size} GB`
                                    : '暂无'}
                            </Text>
                            {vmDetails?.image_version && (
                                <>
                                    <div style={{ width: 1, height: 14, background: '#d9d9d9', margin: '0 12px' }} />
                                    <Tag style={{ borderRadius: 12, padding: '2px 12px', border: '1px solid #d9d9d9', background: '#fff', color: '#333' }}>
                                        {vmDetails.image_version}
                                    </Tag>
                                </>
                            )}
                            {vmDetails?.configuration?.image && (
                                <>
                                    <Tag style={{ borderRadius: 12, padding: '2px 12px', border: '1px solid #d9d9d9', background: '#fff', color: '#333', marginLeft: 8 }}>
                                        {vmDetails.configuration.image}
                                    </Tag>
                                </>
                            )}
                        </div>

                        {/* 第三行：ID 信息 */}
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
                            <div>
                                <Text type="secondary">虚拟机 ID：</Text>
                                <Text code style={{ fontSize: 11 }}>
                                    {vmDetails?.id || '暂无'}
                                </Text>
                            </div>
                            <div>
                                <Text type="secondary">应用 ID：</Text>
                                <Text code style={{ fontSize: 11 }}>
                                    {vmDetails?.app_id || '暂无'}
                                </Text>
                            </div>
                            <div>
                                <Text type="secondary">实例 ID：</Text>
                                <Text code style={{ fontSize: 11 }}>
                                    {vmDetails?.instance_id || '暂无'}
                                </Text>
                            </div>
                        </div>
                    </div>
                </Card>

                <Row gutter={[24, 24]}>
                    {/* 左侧菜单 */}
                    <Col xs={24} md={6} lg={5}>
                        <Card
                            bordered={false}
                            style={{ borderRadius: 16 }}
                            bodyStyle={{ padding: 0 }}
                        >
                            <Menu
                                mode="inline"
                                selectedKeys={[activeMenuKey]}
                                items={menuItems}
                                onClick={info => setActiveMenuKey(info.key)}
                                className="vm-detail-menu"
                                style={{
                                    border: 'none',
                                }}
                            />
                        </Card>
                    </Col>

                    {/* 右侧内容区域 */}
                    <Col xs={24} md={18} lg={19}>
                        {renderContent()}
                    </Col>
                </Row>

                {/* Update Code Modal */}
                <Modal
                    title="更新代码"
                    open={upgradeModalVisible}
                    onOk={handleUpgradeSubmit}
                    onCancel={() => setUpgradeModalVisible(false)}
                    width={800}
                    okText="更新"
                    cancelText="取消"
                >
                    <Form form={upgradeForm} layout="vertical">
                        <Form.Item
                            name="dockerComposeFile"
                            label="Docker Compose 文件"
                            rules={[{ required: true, message: '请输入 Docker Compose 文件内容' }]}
                        >
                            <Input.TextArea
                                rows={10}
                                placeholder="在此粘贴 docker-compose.yml 内容"
                            />
                        </Form.Item>
                        <Form.Item
                            name="preLaunchScript"
                            label="启动前脚本"
                        >
                            <Input.TextArea
                                rows={6}
                                placeholder="可选：容器启动前执行的 Bash 脚本"
                            />
                        </Form.Item>
                        <Form.Item
                            name="userConfig"
                            label="用户配置"
                        >
                            <Input.TextArea
                                rows={4}
                                placeholder="可选：写入 CVM 中 /dstack/.user-config 的内容"
                            />
                        </Form.Item>
                    </Form>
                </Modal>

                {/* Resize Modal */}
                <Modal
                    title="调整虚拟机"
                    open={resizeModalVisible}
                    onOk={handleResizeSubmit}
                    onCancel={() => setResizeModalVisible(false)}
                    width={600}
                    okText="调整"
                    cancelText="取消"
                >
                    <Form form={resizeForm} layout="vertical">
                        <Form.Item
                            name="vcpu"
                            label="vCPU 数量"
                            rules={[{ required: true, message: '请输入 vCPU 数量' }]}
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item
                            label="内存"
                            rules={[{ required: true, message: '请输入内存大小' }]}
                        >
                            <Space.Compact style={{ width: '100%' }}>
                                <Form.Item
                                    name="memoryValue"
                                    noStyle
                                    rules={[{ required: true, message: '请输入内存值' }]}
                                >
                                    <InputNumber min={1} style={{ width: '70%' }} />
                                </Form.Item>
                                <Form.Item
                                    name="memoryUnit"
                                    noStyle
                                    rules={[{ required: true }]}
                                >
                                    <Select style={{ width: '30%' }}>
                                        <Select.Option value="MB">MB</Select.Option>
                                        <Select.Option value="GB">GB</Select.Option>
                                    </Select>
                                </Form.Item>
                            </Space.Compact>
                        </Form.Item>
                        <Form.Item
                            name="disk_size"
                            label="磁盘大小 (GB)"
                            rules={[{ required: true, message: '请输入磁盘大小' }]}
                        >
                            <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item
                            name="image"
                            label="镜像"
                            rules={[{ required: true, message: '请选择镜像' }]}
                        >
                            <Select placeholder="选择镜像" showSearch>
                                {availableImages.map((image) => (
                                    <Select.Option key={image.name} value={image.name}>
                                        {image.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        </PortalLayout>
    );
}


