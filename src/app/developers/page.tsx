'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Col, Row, Steps, Typography, message } from 'antd';
import { CodeOutlined, ApiOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from '../portal.module.css';
import developersStyles from './developers.module.css';

const { Title, Paragraph } = Typography;

// API 基础地址配置 - 可根据需要修改
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://8.147.106.136:8888';

const sdkList = [
    { name: 'Phala JS SDK', version: 'v0.5.x', desc: '在浏览器或 Node.js 中快速调度 TEE 任务。' },
    { name: 'Rust Worker Toolkit', version: 'v1.2.x', desc: '面向链上合约与 Worker 扩展的工具集。' },
    // { name: 'REST OpenAPI', version: '2025.04', desc: '通过 HTTP / WebSocket 访问调度中间件。' },
];

const quickStartSteps = [
    '连接测试网，完成账户绑定与 API Key 申请',
    '部署示例 Worker 或绑定已存在的计算资源',
    '通过 SDK 发送计算任务并订阅事件',
    '在门户查看日志、度量与奖励',
];

// const apiHighlights = [
//     { label: '任务提交', value: 'POST /api/tasks' },
//     { label: '会话查询', value: 'GET /api/sessions/:id' },
//     { label: '激励记录', value: 'GET /api/incentives/:account' },
// ];

export default function DevelopersPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleStartBuild = async () => {
        try {
            setLoading(true);
            message.loading('正在调度最佳资源...', 0);

            const response = await fetch(`${API_BASE_URL}/api/host/best`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            message.destroy();

            if (data.success && data.bestHostIp) {
                // 将 bestHostIp 保存到 localStorage
                localStorage.setItem('bestHostIp', data.bestHostIp);
                message.success(`已找到最佳主机: ${data.bestHostIp}`);
                // 导航到 start 页面
                router.push('/developers/start');
            } else {
                message.error(data.message || '未找到可用主机');
            }
        } catch (error: any) {
            message.destroy();
            message.error(`获取最佳主机失败: ${error.message || '网络错误'}`);
            console.error('获取最佳主机时发生错误:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadExample = () => {
        const link = document.createElement('a');
        link.href = '/api/download-compose';
        link.download = 'docker-compose.yml';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('开始下载部署示例文件');
    };

    return (
        <PortalLayout>
            <div className={styles.portalContent}>
                <section className={styles.hero}>
                    <div className={styles.heroBadge}>
                        <CodeOutlined /> 应用开发者中心
                    </div>
                    <Title level={2} className={styles.heroTitle}>
                        国产TEE · 机密虚拟机 · 容器化应用程序一键部署
                    </Title>
                    <Paragraph className={styles.heroSubtitle}>
                        通过安全调度算法选择最佳资源地址，一键部署属于自己的应用程序，获得定制化的安全计算服务体验。
                    </Paragraph>
                    <div className={styles.heroActions}>
                        <Button
                            type="primary"
                            size="large"
                            loading={loading}
                            onClick={handleStartBuild}
                        >
                            开始构建{/* 调度最佳资源 */}
                        </Button>
                        <Button
                            size="large"
                            onClick={handleDownloadExample}
                        >
                            部署示例
                        </Button>
                    </div>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        资源列表
                    </Title>
                    <Row gutter={[24, 24]}>
                        {sdkList.map((sdk) => (
                            <Col xs={24} md={8} key={sdk.name}>
                                <Card className={styles.portalCard}>
                                    <Title level={4} className={developersStyles.developersCardTitle}>
                                        {sdk.name}
                                    </Title>
                                    <Paragraph className={developersStyles.developersCardVersion}>{sdk.version}</Paragraph>
                                    <Paragraph className={developersStyles.developersCardDesc}>{sdk.desc}</Paragraph>
                                    <Button type="link" className={developersStyles.developersCardLink}>
                                        资源监控
                                    </Button>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        快速入门
                    </Title>
                    <Steps
                        className={developersStyles.developersSteps}
                        direction="vertical"
                        items={quickStartSteps.map((s, index) => ({
                            title: `Step ${index + 1}`,
                            description: s,
                        }))}
                    />
                </section>

                {/* <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        RPC API
                    </Title>
                    <Row gutter={[24, 24]}>
                        {apiHighlights.map((api) => (
                            <Col xs={24} md={8} key={api.label}>
                                <Card className={styles.portalCard}>
                                    <Title level={4} style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <ApiOutlined /> {api.label}
                                    </Title>
                                    <Paragraph className={styles.sectionDescription} style={{ marginBottom: 0 }}>
                                        {api.value}
                                    </Paragraph>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </section> */}
            </div>
        </PortalLayout>
    );
}
