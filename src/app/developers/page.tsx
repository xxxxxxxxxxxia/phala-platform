'use client';

import React from 'react';
import { Button, Card, Col, Row, Steps, Typography } from 'antd';
import { CodeOutlined, ApiOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from '../portal.module.css';

const { Title, Paragraph } = Typography;

const sdkList = [
    { name: 'Phala JS SDK', version: 'v0.5.x', desc: '在浏览器或 Node.js 中快速调度 TEE 任务。' },
    { name: 'Rust Worker Toolkit', version: 'v1.2.x', desc: '面向链上合约与 Worker 扩展的工具集。' },
    { name: 'REST OpenAPI', version: '2025.04', desc: '通过 HTTP / WebSocket 访问调度中间件。' },
];

const quickStartSteps = [
    '连接测试网，完成账户绑定与 API Key 申请',
    '部署示例 Worker 或绑定已存在的计算资源',
    '通过 SDK 发送计算任务并订阅事件',
    '在门户查看日志、度量与奖励',
];

const apiHighlights = [
    { label: '任务提交', value: 'POST /api/tasks' },
    { label: '会话查询', value: 'GET /api/sessions/:id' },
    { label: '激励记录', value: 'GET /api/incentives/:account' },
];

export default function DevelopersPage() {
    return (
        <PortalLayout>
            <div className={styles.portalContent}>
                <section className={styles.hero}>
                    <div className={styles.heroBadge}>
                        <CodeOutlined /> 应用开发者中心
                    </div>
                    <Title level={2} className={styles.heroTitle}>
                        SDK · API · 工程模板一站式交付
                    </Title>
                    <Paragraph className={styles.heroSubtitle}>
                        通过官方 SDK、OpenAPI 以及 CLI 工具，几分钟内完成链计算集成，获得端到端的调试、监控与交付体验。
                    </Paragraph>
                    <div className={styles.heroActions}>
                        <Button type="primary" size="large">
                            立即下载 SDK
                        </Button>
                        <Button size="large">
                            查看 API 文档
                        </Button>
                    </div>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        开发套件
                    </Title>
                    <Row gutter={[24, 24]}>
                        {sdkList.map((sdk) => (
                            <Col xs={24} md={8} key={sdk.name}>
                                <Card className={styles.portalCard}>
                                    <Title level={4} style={{ color: '#fff' }}>
                                        {sdk.name}
                                    </Title>
                                    <Paragraph style={{ color: '#9ad0ff' }}>{sdk.version}</Paragraph>
                                    <Paragraph style={{ color: 'rgba(255,255,255,0.75)' }}>{sdk.desc}</Paragraph>
                                    <Button type="link" style={{ padding: 0 }}>
                                        查看示例
                                    </Button>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        快速上手流程
                    </Title>
                    <Steps
                        className={styles.stepsWhite}
                        direction="vertical"
                        items={quickStartSteps.map((s, index) => ({
                            title: `Step ${index + 1}`,
                            description: s,
                        }))}
                    />
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        核心 API 摘要
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
                </section>
            </div>
        </PortalLayout>
    );
}
