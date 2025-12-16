'use client';

import React, { useEffect } from 'react';
import { Card, Col, List, Row, Timeline, Typography, Button, Tag, Divider } from 'antd';
import { ThunderboltOutlined, DownloadOutlined, SafetyOutlined, SecurityScanOutlined } from '@ant-design/icons';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from './providers.module.css';

const { Title, Paragraph, Text } = Typography;

// CSV Worker 映射：公钥 -> 账户地址
const CSV_WORKER_MAPPING: Record<string, string> = {
    '0x42ccb38c3ed84007abed3e5b14de0dc766d1cb6f3ed6b91fe2cb0944616f155c': '428NizHpx2EKS4v3GhY2rk6nhJwPRZrK2LWPQ7P3xnu1MvrY',
    '0x16ce45340f940e602bc1cb53a20d13e049120739bad1100dd579104daac96c1d': '418h5pUzNJhNezRTfVGvJCo5bJRkKReFEsmY5QDTPWmyR7Gj',
};

const deployChecklist = [
    '准备支持 Intel SGX 的服务器或云主机',
    '安装 Worker 运行环境与必要依赖',
    '配置 worker 的运行参数与 SGX 驱动',
    '将 worker 接入到区块链网络并完成验证',
];

const supportBlocks = [
    {
        title: '接入前准备',
        desc: '上线前快速自检，避免常见踩坑。',
        tags: ['硬件', '网络', '合规'],
        items: [
            'CPU 需支持 Intel SGX，确保 BIOS/固件已开启 SGX 功能',
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
    useEffect(() => {
        // 为 PortalLayout 设置浅蓝色背景
        const portalLayout = document.querySelector('.portalLayout') as HTMLElement;
        if (portalLayout) {
            portalLayout.style.background = 'transparent';
        }

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
                    <Title level={1} className={styles.heroTitle}>
                        兼容国际主流TEE资源可信接入与安全调度
                    </Title>
                    <Paragraph className={styles.heroSubtitle}>
                        基于 Intel SGX 硬件加密隔离技术，提供安全可信的计算资源接入与调度服务。通过标准化的接入流程和统一的管理平台，确保 Worker 节点的安全部署与稳定运行。
                    </Paragraph>

                    {/* SGX 特性展示 */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '24px',
                        marginTop: '32px',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '16px 28px',
                            background: 'rgba(255, 255, 255, 0.25)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, 0.35)',
                            backdropFilter: 'blur(10px)',
                        }}>
                            <SecurityScanOutlined style={{ fontSize: '28px', color: '#1e40af' }} />
                            <div>
                                <Text strong style={{ color: '#1e3a8a', fontSize: '15px', display: 'block' }}>硬件级安全隔离</Text>
                                <Text style={{ color: '#475569', fontSize: '13px' }}>基于 CPU 的加密内存保护</Text>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '16px 28px',
                            background: 'rgba(255, 255, 255, 0.25)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, 0.35)',
                            backdropFilter: 'blur(10px)',
                        }}>
                            <ThunderboltOutlined style={{ fontSize: '28px', color: '#1e40af' }} />
                            <div>
                                <Text strong style={{ color: '#1e3a8a', fontSize: '15px', display: 'block' }}>高效资源调用</Text>
                                <Text style={{ color: '#475569', fontSize: '13px' }}>低延迟、高吞吐量处理</Text>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '16px 28px',
                            background: 'rgba(255, 255, 255, 0.25)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, 0.35)',
                            backdropFilter: 'blur(10px)',
                        }}>
                            <SafetyOutlined style={{ fontSize: '28px', color: '#1e40af' }} />
                            <div>
                                <Text strong style={{ color: '#1e3a8a', fontSize: '15px', display: 'block' }}>可信验证机制</Text>
                                <Text style={{ color: '#475569', fontSize: '13px' }}>远程证明与身份认证</Text>
                            </div>
                        </div>
                    </div>
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

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        部署清单
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
                                            <div style={{ color: '#1e40af', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>SGX</div>
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
