'use client';

import React, { useState, useEffect } from 'react';
import { Card, Col, List, Row, Timeline, Typography, Button, Spin, Tag, Divider } from 'antd';
import { CloudServerOutlined, ThunderboltOutlined, DownloadOutlined, SafetyOutlined } from '@ant-design/icons';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from './providers.module.css';

const { Title, Paragraph, Text } = Typography;

const deployChecklist = [
    '准备 SGX / TDX 能力的服务器或可信云主机',
    '安装 Worker 运行环境与必要依赖',
    '配置 worker 的运行参数',
    '将 worker 接入到区块链网络',
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

        const fetchStats = async () => {
            try {
                const response = await fetch('/api/real-data');
                const result = await response.json();

                if (result.success && result.data?.workers) {
                    setStats({
                        resourceTypes: 2, // 固定值
                        totalWorkers: result.data.workers.total || 0,
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

                                <Button
                                    type="primary"
                                    icon={<ThunderboltOutlined />}
                                    size="large"
                                    block
                                    onClick={async () => {
                                        try {
                                            console.log('开始下载部署手册...');
                                            const response = await fetch('/api/download-deploy-guide');
                                            console.log('响应状态:', response.status, response.statusText);

                                            if (!response.ok) {
                                                const errorData = await response.json().catch(() => ({ error: '未知错误' }));
                                                console.error('下载失败:', errorData);
                                                alert(`下载失败: ${errorData.error || '请稍后重试'}`);
                                                return;
                                            }

                                            const blob = await response.blob();
                                            console.log('Blob 大小:', blob.size);

                                            if (blob.size === 0) {
                                                alert('文件为空，下载失败');
                                                return;
                                            }

                                            const url = window.URL.createObjectURL(blob);
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.download = '部署手册.md';
                                            link.style.display = 'none';
                                            document.body.appendChild(link);
                                            link.click();

                                            // 延迟清理，确保下载开始
                                            setTimeout(() => {
                                                document.body.removeChild(link);
                                                window.URL.revokeObjectURL(url);
                                            }, 100);

                                            console.log('下载完成');
                                        } catch (error: any) {
                                            console.error('下载部署手册失败:', error);
                                            alert(`下载失败: ${error.message || '请稍后重试'}`);
                                        }
                                    }}
                                    style={{
                                        height: 42,
                                        fontSize: 15,
                                        fontWeight: 500,
                                        boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                                        flexShrink: 0,
                                        marginTop: 'auto'
                                    }}
                                >
                                    下载部署手册
                                </Button>
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

            </div>
        </PortalLayout>
    );
}
