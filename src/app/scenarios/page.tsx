'use client';

import React from 'react';
import { Card, Col, Row, Typography, Tag } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from '../portal.module.css';

const { Title, Paragraph } = Typography;

const scenarioCards = [
    {
        title: '隐私计算 · 金融风控',
        description: '利用 TEE 安全共享多家机构的风控数据，生成联合模型而不泄露原始信息。',
        tags: ['TEE', '多方协作', '实时评分'],
    },
    {
        title: 'AI 智能体训练',
        description: '对接链计算推理能力，让模型在可信环境中访问数据集并输出审计可追踪的结果。',
        tags: ['智能体', '审计', '可信推理'],
    },
    {
        title: '工业智造 · 边云协同',
        description: '边缘 Worker 收集设备数据，云端链计算负责汇聚和调度，保障数据不出厂区明文。',
        tags: ['边缘', '实时监控', 'SLA'],
    },
];

export default function ScenariosPage() {
    return (
        <PortalLayout>
            <div className={styles.portalContent}>
                <section className={styles.hero}>
                    <div className={styles.heroBadge}>
                        <BulbOutlined /> 场景演示
                    </div>
                    <Title level={2} className={styles.heroTitle}>
                        典型行业落地蓝图
                    </Title>
                    <Paragraph className={styles.heroSubtitle}>
                        展示隐私计算、AI 智能体与行业解决方案的端到端设计思路，帮助业务方快速对齐目标与建设路线。
                    </Paragraph>
                </section>

                <section className={styles.section}>
                    <Row gutter={[24, 24]}>
                        {scenarioCards.map((scenario) => (
                            <Col xs={24} md={8} key={scenario.title}>
                                <Card className={styles.portalCard}>
                                    <Title level={4} style={{ color: '#fff' }}>
                                        {scenario.title}
                                    </Title>
                                    <Paragraph style={{ color: 'rgba(255,255,255,0.75)' }}>
                                        {scenario.description}
                                    </Paragraph>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {scenario.tags.map((tag) => (
                                            <Tag key={tag} className={styles.cardTag}>
                                                {tag}
                                            </Tag>
                                        ))}
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        交付方式
                    </Title>
                    <Paragraph className={styles.sectionDescription}>
                        支持“模板 + 组件 + 服务”三位一体交付，既可快速 PoC，也支持大规模生产部署。
                    </Paragraph>
                    <Row gutter={[24, 24]}>
                        {['方案模板库', '组件市场', '咨询与共创', '运营支持'].map((title, idx) => (
                            <Col xs={24} md={6} key={title}>
                                <Card className={styles.portalCard}>
                                    <Title level={5} style={{ color: '#fff' }}>
                                        {title}
                                    </Title>
                                    <Paragraph style={{ color: 'rgba(255,255,255,0.75)' }}>
                                        {[
                                            '预置隐私计算、AI 原生、行业场景等 Blueprint。',
                                            '可信数据接入、模型调用、激励模块可自由组合。',
                                            '专家团队提供业务评估与联合创新服务。',
                                            '覆盖监控、SLA、激励及生态推广。',
                                        ][idx]}
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
