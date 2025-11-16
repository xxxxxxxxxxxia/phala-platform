'use client';

import React from 'react';
import { Button, Card, Col, Row, Tag, Typography } from 'antd';
import {
    SafetyCertificateOutlined,
    CloudServerOutlined,
    CodeOutlined,
    BulbOutlined,
    RadarChartOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from './portal.module.css';

const { Title, Paragraph } = Typography;

const entryCards = [
    {
        title: '管理控制台',
        description: '进入链计算管理端，统一查看链上链下计算资源、调度策略以及安全告警。',
        href: '/management/login',
        actionText: '进入管理端',
        icon: <SafetyCertificateOutlined />,
        tag: '需要登录',
    },
    {
        title: '资源提供者中心',
        description: '为 Phala Worker / TEE 节点提供端到端的部署清单、诊断工具与激励发放视图。',
        href: '/providers',
        actionText: '查看指南',
        icon: <CloudServerOutlined />,
    },
    {
        title: '应用开发者中心',
        description: '获取 SDK、API、示例工程与调试工具，快速对接链计算能力。',
        href: '/developers',
        actionText: '开始构建',
        icon: <CodeOutlined />,
    },
    {
        title: '应用场景与方案',
        description: '浏览隐私计算、AI 智能体等行业场景的最佳实践与建设路径。',
        href: '/scenarios',
        actionText: '探索方案',
        icon: <BulbOutlined />,
    },
    {
        title: '链上可视化大屏',
        description: '参照 Polkadot 风格的大屏模板，展示实时网络指标与算力态势。',
        href: '/polkadot-wall',
        actionText: '立即预览',
        icon: <RadarChartOutlined />,
    },
];

const heroStats = [
    { label: '活跃计算节点', value: '120+' },
    { label: '接入应用', value: '35' },
    { label: 'TEE 调用次数', value: '2.6M' },
];

const capabilityHighlights = [
    {
        title: '可信执行 + 多方安全',
        description: '以 TEE + zk 技术栈保障数据密态处理与跨域可信协同。',
    },
    {
        title: '一体化调度与监控',
        description: '链上任务、链下算力、激励与健康度统一编排，秒级可视。',
    },
    {
        title: '全角色门户',
        description: '管理员、资源方、开发者与场景用户各自拥有专属体验。',
    },
];

export default function PortalPage() {
    return (
        <PortalLayout>
            <div className={styles.portalContent}>
                <section className={styles.hero}>
                    <div className={styles.heroBadge}>
                        链计算 · 隐私计算 · TEE
                    </div>
                    <Title level={1} className={styles.heroTitle}>
                        构建下一代 <span className={styles.heroHighlight}>隐私计算门户</span>
                    </Title>
                    <Paragraph className={styles.heroSubtitle}>
                        连接区块链、TEE 与多方应用生态，为管理员、资源提供方、应用开发者以及业务场景方提供一站式入口，快速启用可信计算能力。
                    </Paragraph>
                    <div className={styles.heroActions}>
                        <Link href="/management/login">
                            <Button type="primary" size="large">
                                进入管理端
                            </Button>
                        </Link>
                        <Link href="/developers">
                            <Button size="large">
                                面向开发者
                            </Button>
                        </Link>
                    </div>
                    <div className={styles.heroStats}>
                        {heroStats.map((stat) => (
                            <div key={stat.label} className={styles.heroStat}>
                                <div className={styles.heroStatValue}>{stat.value}</div>
                                <div className={styles.heroStatLabel}>{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className={styles.cardsSection}>
                    <Title level={3} className={styles.sectionTitle}>
                        角色化入口
                    </Title>
                    <Paragraph className={styles.sectionDescription}>
                        五大入口覆盖核心角色，点击即达，快速定位到对应任务流。
                    </Paragraph>
                    <Row gutter={[24, 24]}>
                        {entryCards.map((card) => (
                            <Col xs={24} md={12} xl={8} key={card.title}>
                                <Card hoverable className={styles.portalCard}>
                                    <div className={styles.cardIcon}>{card.icon}</div>
                                    <Title level={4} className={styles.cardTitle}>
                                        {card.title}
                                    </Title>
                                    <Paragraph className={styles.cardDescription}>
                                        {card.description}
                                    </Paragraph>
                                    <div className={styles.cardFooter}>
                                        {card.tag && <Tag className={styles.cardTag}>{card.tag}</Tag>}
                                        <Link href={card.href}>
                                            <Button type="primary">{card.actionText}</Button>
                                        </Link>
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        平台核心特性
                    </Title>
                    <Paragraph className={styles.sectionDescription}>
                        覆盖可信计算、算力调度、生态协同三大维度，支撑从资源供给到业务落地的完整闭环。
                    </Paragraph>
                    <Row gutter={[24, 24]}>
                        {capabilityHighlights.map((item) => (
                            <Col xs={24} md={8} key={item.title}>
                                <Card className={styles.portalCard} bordered={false}>
                                    <Title level={4} className={styles.cardTitle}>
                                        {item.title}
                                    </Title>
                                    <Paragraph className={styles.cardDescription}>
                                        {item.description}
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
