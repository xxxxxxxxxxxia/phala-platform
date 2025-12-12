'use client';

import React, { useState, useEffect } from 'react';
import { Card, Col, List, Row, Timeline, Typography, Button, Spin, Tag, Divider } from 'antd';
import { CloudServerOutlined, ThunderboltOutlined, DownloadOutlined, SafetyOutlined } from '@ant-design/icons';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from './providers.module.css';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { getNodeUrl } from '@/lib/config';
import { decodeAddress } from '@polkadot/util-crypto';

const { Title, Paragraph, Text } = Typography;

// CSV Worker 映射：公钥 -> 账户地址
const CSV_WORKER_MAPPING: Record<string, string> = {
    '0x42ccb38c3ed84007abed3e5b14de0dc766d1cb6f3ed6b91fe2cb0944616f155c': '428NizHpx2EKS4v3GhY2rk6nhJwPRZrK2LWPQ7P3xnu1MvrY',
    '0x16ce45340f940e602bc1cb53a20d13e049120739bad1100dd579104daac96c1d': '418h5pUzNJhNezRTfVGvJCo5bJRkKReFEsmY5QDTPWmyR7Gj',
};

const deployChecklist = [
    '准备 SGX / TDX 能力的服务器或可信云主机',
    '安装 Worker 运行环境与必要依赖',
    '配置 worker 的运行参数',
    '将 worker 接入到区块链网络',
];

const supportBlocks = [
    {
        title: '接入前准备',
        desc: '上线前快速自检，避免常见踩坑。',
        tags: ['硬件', '网络', '合规'],
        items: [
            'CPU 需支持 SGX/TDX，确保 BIOS/固件已开启',
            '提供稳定公网出口，放行区块链与远程管理端口',
            '完成节点实名认证与责任人备案，确保可追溯',
        ],
    },
    {
        title: '技术支持',
        desc: '遇到问题可随时获得帮助。',
        tags: ['工单', '文档', '社群'],
        items: [
            '提交工单：提供日志、环境与复现步骤，快速定位',
            '阅读常见问题与部署指南，获取标准答案',
            '加入技术社群，实时同步变更与安全公告',
        ],
    },
    {
        title: '运行保障',
        desc: '上线后持续运行的必备要点。',
        tags: ['监控', '安全', '升级'],
        items: [
            '接入监控告警：CPU/内存与区块同步情况',
            '定期轮换密钥与证书，最小化访问权限',
            '跟进版本公告，按计划完成 Worker 升级与回滚',
        ],
    },
];

// Worker 部署包仓库地址（可根据实际情况修改）
const WORKER_REPO_URL = 'https://gitee.com/eliauk4813/worker-deploy';

export default function ProvidersPage() {
    const [stats, setStats] = useState({
        resourceTypes: 2, // 固定值：TEE类型种类（SGX和TDX）
        totalWorkers: 0,
        onlineWorkers: 0,
        loading: true,
    });

    useEffect(() => {
        // 为 PortalLayout 设置浅蓝色背景
        const portalLayout = document.querySelector('.portalLayout') as HTMLElement;
        if (portalLayout) {
            portalLayout.style.background = 'transparent';
        }

        // 计算 Worker 数量（和激励机制页面逻辑一致）
        const calculateWorkerCount = async (api: ApiPromise, registeredWorkers: any[]): Promise<number> => {
            const baseCount = registeredWorkers.length;

            // 获取所有已注册的 Worker 公钥集合
            const registeredPubkeys = new Set(registeredWorkers.map((w: any) => {
                // 从 worker entry 中提取公钥
                if (w.pubkey) return w.pubkey;
                if (w.publicKey) return w.publicKey;
                return null;
            }).filter(Boolean));

            // 查询 hygonTeeDevices
            let hygonTeeDevices: Set<string> = new Set();
            try {
                if (api.query.phalaComputation?.hygonTeeDevices) {
                    const hygonDevicesData = await api.query.phalaComputation.hygonTeeDevices.entries();
                    hygonDevicesData.forEach(([key]: [any, any]) => {
                        const accountId = key.args[0].toString();
                        hygonTeeDevices.add(accountId);
                    });
                }
            } catch (e) {
                console.warn('查询 Hygon TEE Devices 失败:', e);
            }

            // 统计 hygonTeeDevices 中未注册的账户数量
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
                        const decoded = decodeAddress(accountAddress, false, 30); // ss58Format: 30 for Phala Network
                        // 将 Uint8Array 转换为十六进制字符串
                        pubkey = '0x' + Array.from(decoded).map(b => b.toString(16).padStart(2, '0')).join('');
                    } catch (e) {
                        // 如果解码失败，跳过这个账户
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

            return baseCount + additionalCount;
        };

        const fetchStats = async () => {
            try {
                // 连接 API 查询链上数据
                const wsUrl = getNodeUrl();
                const provider = new WsProvider(wsUrl);
                const apiPromise = ApiPromise.create({ provider, noInitWarn: true });
                const api = await apiPromise;

                // 查询已注册的 workers
                let registeredWorkers: any[] = [];
                try {
                    const workersData = await api.query.phalaRegistry.workers.entries();
                    registeredWorkers = workersData.map(([key, worker]: [any, any]) => {
                        if (worker.isSome) {
                            // 从 key 中提取公钥，使用 toHex() 确保格式为 0x 开头的十六进制字符串
                            const pubkey = key.args[0].toHex() as string;
                            const workerData = worker.unwrap().toJSON();
                            return { pubkey, ...workerData };
                        }
                        return null;
                    }).filter(Boolean);
                } catch (e) {
                    console.warn('查询 Workers 失败:', e);
                }

                // 计算 Worker 数量（和激励机制页面逻辑一致）
                const totalWorkersCount = await calculateWorkerCount(api, registeredWorkers);

                await api.disconnect();

                // 使用 dashboard/summary API 获取其他数据
                const response = await fetch('/api/dashboard/summary', {
                    headers: { 'cache-control': 'no-store' }
                });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const result = await response.json();
                if (result.success && result.data?.workers) {
                    setStats({
                        resourceTypes: 2,
                        totalWorkers: totalWorkersCount, // 使用计算出的 totalWorkersCount
                        onlineWorkers: result.data.workers.online || 0,
                        loading: false,
                    });
                } else {
                    setStats(prev => ({ ...prev, loading: false }));
                }
            } catch (error) {
                console.error('获取统计数据失败:', error);
                setStats(prev => ({ ...prev, loading: false }));
            }
        };

        // 仅在页面加载时获取一次数据
        fetchStats();

        return () => {
            // 清理时恢复默认背景
            const layout = document.querySelector('.portalLayout') as HTMLElement;
            if (layout) {
                layout.style.background = '';
            }
        };
    }, []);

    return (
        <PortalLayout>
            <div className={styles.providersPageWrapper}></div>
            <div className={styles.providersContent}>
                <section className={styles.hero}>
                    <div className={styles.heroBadge}>
                        <CloudServerOutlined /> 资源提供者专属
                    </div>
                    <Title level={2} className={styles.heroTitle}>
                        Worker 接入
                    </Title>
                    <Paragraph className={styles.heroSubtitle}>
                        统一交付部署清单和运行手册，帮助资源提供者快速上线。
                    </Paragraph>
                    <div className={styles.heroStats}>
                        <div className={styles.heroStat}>
                            {stats.loading ? (
                                <Spin size="small" />
                            ) : (
                                <div className={styles.heroStatValue}>{stats.resourceTypes}</div>
                            )}
                            <div className={styles.heroStatLabel}>已接入资源种类</div>
                        </div>
                        <div className={styles.heroStat}>
                            {stats.loading ? (
                                <Spin size="small" />
                            ) : (
                                <div className={styles.heroStatValue}>{stats.totalWorkers}</div>
                            )}
                            <div className={styles.heroStatLabel}>已接入worker数</div>
                        </div>
                        <div className={styles.heroStat}>
                            {stats.loading ? (
                                <Spin size="small" />
                            ) : (
                                <div className={styles.heroStatValue}>{stats.onlineWorkers}</div>
                            )}
                            <div className={styles.heroStatLabel}>在线worker数</div>
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        快速部署清单
                    </Title>
                    <Paragraph className={styles.sectionDescription}>
                        按照以下步骤即可完成 Worker 节点接入。
                    </Paragraph>
                    <Row gutter={[24, 24]} style={{ display: 'flex', alignItems: 'stretch' }}>
                        <Col xs={24} md={14} style={{ display: 'flex' }}>
                            <Card className={styles.portalCard} style={{ padding: '24px', paddingTop: '4px', paddingBottom: '4px', display: 'flex', flexDirection: 'column', width: '100%', flex: 1 }}>
                                <div style={{ marginBottom: 24, flexShrink: 0 }}>
                                    <Title level={4} style={{ color: '#1e3a8a', marginBottom: 6, fontSize: 18, fontWeight: 600 }}>
                                        部署步骤指南
                                    </Title>
                                    <Paragraph style={{ color: '#475569', margin: 0, fontSize: 13 }}>
                                        按照以下步骤完成 Worker 节点接入
                                    </Paragraph>
                                </div>

                                <div style={{ flex: 1, minHeight: 0 }}>
                                    <Timeline
                                        items={deployChecklist.map((item, idx) => ({
                                            color: idx === deployChecklist.length - 1 ? '#52c41a' : '#1890ff',
                                            children: (
                                                <div style={{ paddingLeft: 10 }}>
                                                    <div style={{ marginBottom: 6 }}>
                                                        <Text style={{ color: '#1e40af', fontSize: 15, lineHeight: '22px', fontWeight: 500 }}>
                                                            步骤 {idx + 1}
                                                        </Text>
                                                    </div>
                                                    <Text style={{ color: '#475569', fontSize: 14, lineHeight: '22px', display: 'block' }}>
                                                        {item}
                                                    </Text>
                                                </div>
                                            ),
                                        }))}
                                        style={{ marginTop: 8, marginBottom: 0 }}
                                    />
                                </div>

                                <Divider style={{ borderColor: 'rgba(59, 130, 246, 0.2)', margin: '24px 0', flexShrink: 0 }} />

                                <div style={{ display: 'flex', gap: 12, flexShrink: 0, marginTop: 'auto' }}>
                                    <Button
                                        type="primary"
                                        icon={<ThunderboltOutlined />}
                                        size="large"
                                        style={{
                                            flex: 1,
                                            height: 42,
                                            fontSize: 15,
                                            fontWeight: 500,
                                            boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                                        }}
                                        onClick={async () => {
                                            try {
                                                // 添加时间戳避免缓存
                                                const response = await fetch(`/api/download-deploy-guide?type=csv&t=${Date.now()}`);
                                                if (!response.ok) {
                                                    const errorData = await response.json().catch(() => ({ error: '未知错误' }));
                                                    alert(`下载失败: ${errorData.error || '请稍后重试'}`);
                                                    return;
                                                }
                                                const blob = await response.blob();
                                                if (blob.size === 0) {
                                                    alert('文件为空，下载失败');
                                                    return;
                                                }

                                                // 尝试从响应头获取文件名，如果没有则使用默认值
                                                const contentDisposition = response.headers.get('Content-Disposition');
                                                let fileName = 'csv部署手册.md';
                                                if (contentDisposition) {
                                                    const matches = contentDisposition.match(/filename\*=UTF-8''(.+)/);
                                                    if (matches && matches[1]) {
                                                        fileName = decodeURIComponent(matches[1]);
                                                    }
                                                }

                                                const url = window.URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.download = fileName;
                                                link.style.display = 'none';
                                                document.body.appendChild(link);
                                                link.click();
                                                setTimeout(() => {
                                                    document.body.removeChild(link);
                                                    window.URL.revokeObjectURL(url);
                                                }, 100);
                                            } catch (error: any) {
                                                console.error('下载CSV手册失败:', error);
                                                alert(`下载失败: ${error.message || '请稍后重试'}`);
                                            }
                                        }}
                                    >
                                        下载 CSV 手册
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<ThunderboltOutlined />}
                                        size="large"
                                        style={{
                                            flex: 1,
                                            height: 42,
                                            fontSize: 15,
                                            fontWeight: 500,
                                            boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                                        }}
                                        onClick={async () => {
                                            try {
                                                // 添加时间戳避免缓存
                                                const response = await fetch(`/api/download-deploy-guide?type=sgx&t=${Date.now()}`);
                                                if (!response.ok) {
                                                    const errorData = await response.json().catch(() => ({ error: '未知错误' }));
                                                    alert(`下载失败: ${errorData.error || '请稍后重试'}`);
                                                    return;
                                                }
                                                const blob = await response.blob();
                                                if (blob.size === 0) {
                                                    alert('文件为空，下载失败');
                                                    return;
                                                }

                                                // 尝试从响应头获取文件名，如果没有则使用默认值
                                                const contentDisposition = response.headers.get('Content-Disposition');
                                                let fileName = 'SGX部署手册.md';
                                                if (contentDisposition) {
                                                    const matches = contentDisposition.match(/filename\*=UTF-8''(.+)/);
                                                    if (matches && matches[1]) {
                                                        fileName = decodeURIComponent(matches[1]);
                                                    }
                                                }

                                                const url = window.URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.download = fileName;
                                                link.style.display = 'none';
                                                document.body.appendChild(link);
                                                link.click();
                                                setTimeout(() => {
                                                    document.body.removeChild(link);
                                                    window.URL.revokeObjectURL(url);
                                                }, 100);
                                            } catch (error: any) {
                                                console.error('下载SGX手册失败:', error);
                                                alert(`下载失败: ${error.message || '请稍后重试'}`);
                                            }
                                        }}
                                    >
                                        下载 SGX 手册
                                    </Button>
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} md={10} style={{ display: 'flex' }}>
                            <Card className={styles.portalCard} style={{ padding: '28px', paddingTop: '8px', paddingBottom: '8px', display: 'flex', flexDirection: 'column', width: '100%', flex: 1 }}>
                                <div style={{ marginBottom: 24, flexShrink: 0, height: 60 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52 }}>
                                        <div className={styles.cardIcon} style={{
                                            width: 52,
                                            height: 52,
                                            fontSize: 26
                                        }}>
                                            <DownloadOutlined />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', height: 52 }}>
                                            <Title level={4} style={{ color: '#1e3a8a', margin: 0, padding: 0, fontSize: 18, fontWeight: 600, lineHeight: '1.2' }}>
                                                Worker 部署包
                                            </Title>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ flex: 1, minHeight: 0 }}>
                                    <Paragraph style={{
                                        color: '#475569',
                                        marginBottom: 18,
                                        fontSize: 13,
                                        lineHeight: '20px',
                                        flexShrink: 0
                                    }}>
                                        下载最新的 Worker 镜像与配置模板，支持容器化或裸金属部署方式。
                                    </Paragraph>

                                    <div style={{
                                        background: '#f0f9ff',
                                        borderRadius: 10,
                                        padding: '18px',
                                        marginTop: 20,
                                        marginBottom: 28,
                                        border: '1px solid rgba(59, 130, 246, 0.2)',
                                        flexShrink: 0
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                            <SafetyOutlined style={{ color: '#52c41a', fontSize: 19 }} />
                                            <Text style={{ color: '#1e3a8a', fontSize: 17, fontWeight: 500 }}>包含内容</Text>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                            <Tag color="blue" style={{ fontSize: 14, margin: 0, padding: '4px 12px', width: 'calc(45% - 6px)' }}>Docker 镜像</Tag>
                                            <Tag color="green" style={{ fontSize: 14, margin: 0, padding: '4px 12px', width: 'calc(45% - 6px)' }}>配置文件</Tag>
                                            <Tag color="orange" style={{ fontSize: 14, margin: 0, padding: '4px 12px', width: 'calc(45% - 6px)' }}>部署脚本</Tag>
                                            <Tag color="purple" style={{ fontSize: 14, margin: 0, padding: '4px 12px', width: 'calc(45% - 6px)' }}>文档说明</Tag>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        gap: 14,
                                        padding: '14px 0',
                                        borderTop: '1px solid rgba(59, 130, 246, 0.2)',
                                        borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
                                        marginBottom: 28,
                                        flexShrink: 0
                                    }}>
                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                            <div style={{ color: '#1e40af', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>2</div>
                                            <div style={{ color: '#64748b', fontSize: 12 }}>部署方式</div>
                                        </div>
                                        <div style={{ width: 1, background: 'rgba(59, 130, 246, 0.2)' }} />
                                        <div style={{ flex: 1, textAlign: 'center' }}>
                                            <div style={{ color: '#1e40af', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>SGX/TDX</div>
                                            <div style={{ color: '#64748b', fontSize: 12 }}>TEE 类型</div>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    type="primary"
                                    icon={<DownloadOutlined />}
                                    block
                                    size="large"
                                    onClick={() => {
                                        window.open(WORKER_REPO_URL, '_blank', 'noopener,noreferrer');
                                    }}
                                    style={{
                                        height: 42,
                                        fontSize: 15,
                                        fontWeight: 500,
                                        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                                        flexShrink: 0,
                                        marginTop: 8
                                    }}
                                >
                                    前往配置仓库
                                </Button>
                            </Card>
                        </Col>
                    </Row>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        接入支持与保障
                    </Title>
                    <Paragraph className={styles.sectionDescription}>
                        从准备、接入到运行全流程的注意事项与支持渠道，帮助你持续稳定地提供算力。
                    </Paragraph>
                    <Row gutter={[24, 24]}>
                        {supportBlocks.map((block) => (
                            <Col xs={24} md={8} key={block.title}>
                                <Card className={styles.portalCard} style={{ padding: 20, height: '100%' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                        <div className={styles.cardIcon}>
                                            <SafetyOutlined />
                                        </div>
                                        <div>
                                            <Title level={4} style={{ color: '#1e3a8a', margin: 0, fontSize: 18, fontWeight: 600 }}>
                                                {block.title}
                                            </Title>
                                            <Paragraph style={{ margin: 0, color: '#475569', fontSize: 13 }}>
                                                {block.desc}
                                            </Paragraph>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                        {block.tags.map((tag) => (
                                            <Tag key={tag} color="blue" className={styles.cardTag}>
                                                {tag}
                                            </Tag>
                                        ))}
                                    </div>
                                    <List
                                        size="small"
                                        className={styles.cardList}
                                        dataSource={block.items}
                                        renderItem={(item, idx) => (
                                            <List.Item className={styles.cardListItem}>
                                                <Text style={{ color: '#1f2937', fontSize: 14 }}>
                                                    {idx + 1}. {item}
                                                </Text>
                                            </List.Item>
                                        )}
                                    />
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </section>

            </div>
        </PortalLayout>
    );
}
