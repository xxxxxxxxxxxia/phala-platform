'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { App, Button, Card, Col, Row, Tag, Typography, Space, Menu, type MenuProps } from 'antd';
import {
    ArrowLeftOutlined,
    CloudServerOutlined,
    DashboardOutlined,
    SafetyOutlined,
    GlobalOutlined,
    SettingOutlined,
    ApiOutlined,
    ReloadOutlined,
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
    if (!memoryMB) return 'N/A';
    if (memoryMB >= 1024) {
        return `${(memoryMB / 1024).toFixed(2)} GB`;
    }
    return `${memoryMB} MB`;
};

const getFlags = (vm: any): string => {
    if (!vm.appCompose) return 'None';
    const flags = [];
    if (vm.appCompose.kms_enabled) flags.push('KMS');
    if (vm.appCompose.gateway_enabled || vm.appCompose.tproxy_enabled) flags.push('Gateway');
    if (vm.appCompose.public_logs) flags.push('Public Logs');
    if (vm.appCompose.public_sysinfo) flags.push('Public SysInfo');
    if (vm.appCompose.public_tcbinfo) flags.push('Public TCB Info');
    return flags.length > 0 ? flags.join(', ') : 'None';
};

export default function VmDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { message } = App.useApp();
    const vmId = params?.id as string | undefined;

    const [activeMenuKey, setActiveMenuKey] = useState<string>('overview');

    const [bestHostIp, setBestHostIp] = useState<string | null>(null);
    const [vm, setVm] = useState<VMData | null>(null);
    const [vmDetails, setVmDetails] = useState<any | null>(null);
    const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [loadingNetwork, setLoadingNetwork] = useState<boolean>(false);

    // 读取 bestHostIp
    useEffect(() => {
        const storedBestHostIp = typeof window !== 'undefined' ? localStorage.getItem('bestHostIp') : null;
        if (storedBestHostIp) {
            setBestHostIp(storedBestHostIp);
        } else {
            setBestHostIp(DEFAULT_BEST_HOST_IP);
        }
    }, []);

    const loadDetails = async () => {
        if (!bestHostIp || !vmId) return;
        setLoading(true);
        try {
            const response = await rpcCall(bestHostIp, 'Status', {
                brief: false,
                ids: [vmId],
            });
            const data = await response.json();
            const detailed = data.vms && data.vms.length > 0 ? data.vms[0] : null;

            if (!detailed) {
                message.error('未找到该 VM');
                return;
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
        } catch (error) {
            console.error('Error loading VM details:', error);
            message.error('加载 VM 详情失败');
        } finally {
            setLoading(false);
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
            message.warning('获取网络信息失败');
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
        if (vmDetails && vmDetails.status === 'running') {
            loadNetwork();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vmDetails]);

    const statusText = vmDetails?.status || 'N/A';

    const menuItems: MenuProps['items'] = [
        {
            key: 'overview',
            icon: <DashboardOutlined />,
            label: 'Overview',
        },
        {
            key: 'logs',
            icon: <CloudServerOutlined />,
            label: 'Logs & Containers',
        },
        {
            key: 'network',
            icon: <GlobalOutlined />,
            label: 'Network',
        },
        {
            key: 'kms',
            icon: <SafetyOutlined />,
            label: 'KMS Info',
        },
        {
            key: 'attestations',
            icon: <SafetyOutlined />,
            label: 'Attestations',
        },
        {
            key: 'config',
            icon: <SettingOutlined />,
            label: 'App Config',
        },
        {
            key: 'events',
            icon: <ApiOutlined />,
            label: 'Events',
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: 'Settings',
        },
    ];

    const renderContent = () => {
        if (activeMenuKey === 'overview') {
            return (
                <>
                    {/* 顶部概要卡片，参考截图布局 */}
                    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={24} md={8}>
                            <Card
                                title="System Info"
                                bordered={false}
                                style={{ borderRadius: 16 }}
                                extra={<Tag color="blue">{statusText}</Tag>}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <CloudServerOutlined style={{ fontSize: 24 }} />
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{vmDetails?.name || 'VM'}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                                            {vmDetails?.id}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card
                                title="Memory Usage"
                                bordered={false}
                                style={{ borderRadius: 16 }}
                            >
                                <div>
                                    <div style={{ fontSize: 14 }}>
                                        {formatMemory(vmDetails?.configuration?.memory)}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                                        基于 VM 配置的内存
                                    </div>
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card
                                title="Storage"
                                bordered={false}
                                style={{ borderRadius: 16 }}
                            >
                                <div>
                                    <div style={{ fontSize: 14 }}>
                                        {vmDetails?.configuration?.disk_size
                                            ? `${vmDetails.configuration.disk_size} GB`
                                            : 'N/A'}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                                        系统磁盘大小
                                    </div>
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    {/* 详细信息区域：复用之前 Modal 的信息结构（简化版） */}
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={16}>
                            <Card
                                title="应用信息"
                                bordered={false}
                                style={{ borderRadius: 16, marginBottom: 16 }}
                            >
                                {vmDetails ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                                        <div>应用名称：</div>
                                        <div>{vmDetails.appCompose?.name || 'N/A'}</div>
                                        <div>App ID：</div>
                                        <div style={{ fontFamily: 'monospace' }}>{vmDetails.app_id || 'N/A'}</div>
                                        <div>Instance ID：</div>
                                        <div style={{ fontFamily: 'monospace' }}>{vmDetails.instance_id || 'N/A'}</div>
                                        <div>Runner：</div>
                                        <div>{vmDetails.appCompose?.runner || 'N/A'}</div>
                                        <div>功能特性：</div>
                                        <div>{getFlags(vmDetails)}</div>
                                    </div>
                                ) : (
                                    <div>正在加载应用信息...</div>
                                )}
                            </Card>

                            <Card
                                title="网络信息"
                                bordered={false}
                                style={{ borderRadius: 16 }}
                                extra={
                                    <Button
                                        size="small"
                                        icon={<GlobalOutlined />}
                                        onClick={loadNetwork}
                                        loading={loadingNetwork}
                                    >
                                        刷新网络
                                    </Button>
                                }
                            >
                                {networkInfo ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {networkInfo.dns_servers && (
                                            <div>
                                                <Text strong>DNS:</Text>{' '}
                                                <span>{networkInfo.dns_servers.join(', ')}</span>
                                            </div>
                                        )}
                                        {networkInfo.gateways && (
                                            <div>
                                                <Text strong>Gateways:</Text>{' '}
                                                <span>
                                                    {networkInfo.gateways.map(gw => gw.address).join(', ')}
                                                </span>
                                            </div>
                                        )}
                                        {networkInfo.interfaces && (
                                            <div>
                                                <Text strong>Interfaces:</Text>
                                                {networkInfo.interfaces.map((iface: any, idx: number) => (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            marginTop: 4,
                                                            padding: 6,
                                                            borderRadius: 8,
                                                            background: 'rgba(0,0,0,0.02)',
                                                        }}
                                                    >
                                                        <div>{iface.name}</div>
                                                        <div style={{ fontSize: 12 }}>
                                                            {iface.addresses
                                                                ?.map(
                                                                    (addr: any) =>
                                                                        `${addr.address}/${addr.prefix}`,
                                                                )
                                                                .join(', ')}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {networkInfo.wg_info && (
                                            <div>
                                                <Text strong>WireGuard:</Text>
                                                <pre
                                                    style={{
                                                        marginTop: 4,
                                                        maxHeight: 240,
                                                        overflow: 'auto',
                                                        background: '#000',
                                                        color: '#fff',
                                                        padding: 8,
                                                        borderRadius: 8,
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {networkInfo.wg_info}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>暂无网络信息（仅在 VM 运行时可用）</div>
                                )}
                            </Card>
                        </Col>

                        <Col xs={24} lg={8}>
                            <Card
                                title="VM 配置"
                                bordered={false}
                                style={{ borderRadius: 16, marginBottom: 16 }}
                                extra={<SettingOutlined />}
                            >
                                {vmDetails ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div>
                                            <Text strong>镜像：</Text>
                                            <span style={{ fontFamily: 'monospace' }}>
                                                {vmDetails.configuration?.image || 'N/A'}
                                            </span>
                                        </div>
                                        <div>
                                            <Text strong>vCPUs：</Text>
                                            <span>{vmDetails.configuration?.vcpu ?? 'N/A'}</span>
                                        </div>
                                        <div>
                                            <Text strong>内存：</Text>
                                            <span>{formatMemory(vmDetails.configuration?.memory)}</span>
                                        </div>
                                        <div>
                                            <Text strong>磁盘：</Text>
                                            <span>
                                                {vmDetails.configuration?.disk_size
                                                    ? `${vmDetails.configuration.disk_size} GB`
                                                    : 'N/A'}
                                            </span>
                                        </div>
                                        {vmDetails.configuration?.gpus &&
                                            vmDetails.configuration.gpus.length > 0 && (
                                                <div>
                                                    <Text strong>GPU：</Text>
                                                    <span>
                                                        {vmDetails.configuration.gpus
                                                            .map((gpu: any) => gpu.slot || gpu.product_id)
                                                            .join(', ')}
                                                    </span>
                                                </div>
                                            )}
                                    </div>
                                ) : (
                                    <div>正在加载配置...</div>
                                )}
                            </Card>

                            <Card
                                title="端口映射"
                                bordered={false}
                                style={{ borderRadius: 16 }}
                                extra={<ApiOutlined />}
                            >
                                {vmDetails?.configuration?.ports &&
                                vmDetails.configuration.ports.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {vmDetails.configuration.ports.map((port: any, idx: number) => (
                                            <div
                                                key={idx}
                                                style={{
                                                    padding: 8,
                                                    borderRadius: 8,
                                                    background: 'rgba(0,0,0,0.02)',
                                                    fontFamily: 'monospace',
                                                    fontSize: 12,
                                                }}
                                            >
                                                {port.protocol?.toUpperCase() || 'TCP'}:{' '}
                                                {port.host_port} → {port.vm_port}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div>未配置端口映射</div>
                                )}
                            </Card>
                        </Col>
                    </Row>
                </>
            );
        }

        // 其他菜单内容：先放占位，后续可以接入真实数据
        const menuTitleMap: Record<string, string> = {
            logs: 'Logs & Containers',
            network: 'Network',
            kms: 'KMS Info',
            attestations: 'Attestations',
            config: 'App Config',
            events: 'Events',
            settings: 'Settings',
        };

        return (
            <Card bordered={false} style={{ borderRadius: 16 }}>
                <Title level={4} style={{ marginBottom: 16 }}>
                    {menuTitleMap[activeMenuKey] || 'Detail'}
                </Title>
                <Text type="secondary">该区域内容尚未实现，可根据需求接入对应的数据与组件。</Text>
            </Card>
        );
    };

    return (
        <PortalLayout>
            <div className={styles.portalContent}>
                {/* 顶部返回与标题 */}
                <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link
                        href="/developers/start"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 14px',
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: 'rgba(255,255,255,0.9)',
                            textDecoration: 'none',
                        }}
                    >
                        <ArrowLeftOutlined />
                        <span>返回 VM 列表</span>
                    </Link>
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={loadDetails}
                            loading={loading}
                        >
                            刷新
                        </Button>
                    </Space>
                </div>

                <Row gutter={[24, 24]}>
                    {/* 左侧菜单 */}
                    <Col xs={24} md={6} lg={5}>
                        <Card
                            bordered={false}
                            style={{ borderRadius: 16 }}
                        >
                            <Menu
                                mode="inline"
                                selectedKeys={[activeMenuKey]}
                                items={menuItems}
                                onClick={info => setActiveMenuKey(info.key)}
                            />
                        </Card>
                    </Col>

                    {/* 右侧内容区域 */}
                    <Col xs={24} md={18} lg={19}>
                        {renderContent()}
                    </Col>
                </Row>
            </div>
        </PortalLayout>
    );
}


