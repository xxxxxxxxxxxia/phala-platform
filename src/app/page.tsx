'use client';

import React, { useEffect } from 'react';
import { Button, Card, Col, Row, Tag, Typography } from 'antd';
import {
    SafetyCertificateOutlined,
    CloudServerOutlined,
    CodeOutlined,
    BulbOutlined,
    RadarChartOutlined,
    SettingOutlined,
    SwapOutlined,
    DatabaseOutlined,
    RobotOutlined,
    RightOutlined,
    ThunderboltOutlined,
    TrophyOutlined,
    FileProtectOutlined,
    KeyOutlined,
    MonitorOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from './portal.module.css';

const { Title, Paragraph } = Typography;

const entryCards = [
    {
        title: '管理控制台',
        description: '进入链计算平台管理端，统一查看链上链下计算资源及其他相关信息。',
        href: '/management/login',
        actionText: '进入管理端',
        icon: <SafetyCertificateOutlined />,
        tag: '需要登录',
    },
    {
        title: '资源提供者中心',
        description: '为准备接入的 Worker 节点拥有者提供部署清单、运行手册与配置指南。',
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
        href: '#scenarios',
        actionText: '探索方案',
        icon: <BulbOutlined />,
    },
    {
        title: '链上可视化大屏',
        description: '参照主流区块浏览器风格的大屏模板，展示实时网络指标与算力态势。',
        href: '/polkadot-wall',
        actionText: '立即预览',
        icon: <RadarChartOutlined />,
    },
];

// 平台核心功能模块
const coreFeatures = [
    {
        title: '可信验证',
        description: '基于TEE技术的可信执行环境验证，保障计算过程的安全性与隐私性',
        icon: <SafetyCertificateOutlined />,
        color: '#52c41a',
        href: '/management/tee-verification',
    },
    {
        title: '安全调度',
        description: '智能计算资源调度系统，实现任务的高效分配与负载均衡',
        icon: <ThunderboltOutlined />,
        color: '#1890ff',
        href: '/management/scheduling',
    },
    {
        title: '激励机制',
        description: '完善的激励与奖励机制，促进网络参与者的积极性与贡献度',
        icon: <TrophyOutlined />,
        color: '#faad14',
        href: '/management/incentives',
    },
    {
        title: '隐私合约',
        description: '支持隐私保护的智能合约部署与执行，确保数据安全与算法保密',
        icon: <FileProtectOutlined />,
        color: '#722ed1',
        href: '/management/contracts',
    },
    {
        title: '密钥管理',
        description: '安全的密钥轮换与管理机制，保障系统长期安全运行',
        icon: <KeyOutlined />,
        color: '#eb2f96',
        href: '/management/key-rotation',
    },
    {
        title: '响应监控',
        description: '实时监控Worker节点响应状态，及时发现并处理异常情况',
        icon: <MonitorOutlined />,
        color: '#13c2c2',
        href: '/management/monitoring',
    },
];

const capabilityHighlights = [
    {
        title: '可信执行',
        description: 'TEE技术栈保障数据密态处理与跨域可信协同。',
    },
    {
        title: '一体化调度与监控',
        description: '链上任务、链下算力、激励与健康度统一编排，可视直观。',
    },
    {
        title: '全角色门户',
        description: '管理员、资源方、开发者等各自拥有专属体验。',
    },
];

const scenarioCards = [
    {
        title: '中移开放中继跨链服务平台',
        description: '利用联盟TEE计算构建安全可信的跨链中继节点,保障跨链交易的隐私性与正确性,促进多链生态互联互通。',
        icon: <SwapOutlined />,
        buttonText: '访问平台',
        buttonLink: '#',
    },
    {
        title: '可信数据计算',
        description: '为政府和企业提供安全的数据共享与融合计算环境,在保护数据主权和隐私的前提下,释放数据要素价值。',
        icon: <DatabaseOutlined />,
        buttonText: '了解更多',
        buttonLink: '#',
    },
    {
        title: '中小企业可信安全分布智能体服务平台',
        description: '赋能中小企业构建和部署可信的分布式AI智能体,保障模型训练与推理过程中的数据安全与算法知识产权。',
        icon: <RobotOutlined />,
        buttonText: '了解更多',
        buttonLink: '#',
    },
];

export default function PortalPage() {

    useEffect(() => {
        // 处理锚点跳转的平滑滚动
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash) {
                // 等待 DOM 完全渲染后再滚动
                setTimeout(() => {
                    const element = document.querySelector(hash);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 300);
            }
        };

        // 初始加载时检查 hash（包括从其他页面跳转过来的情况）
        if (window.location.hash) {
            // 如果 URL 中有 hash，等待页面完全加载后再滚动
            setTimeout(handleHashChange, 100);
        }

        // 监听 hash 变化
        window.addEventListener('hashchange', handleHashChange);

        // 监听 popstate（浏览器前进后退）
        window.addEventListener('popstate', handleHashChange);

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
            window.removeEventListener('popstate', handleHashChange);
        };
    }, []);

    // 处理卡片点击时的锚点跳转
    const handleCardClick = (href: string, e: React.MouseEvent) => {
        if (href.startsWith('#')) {
            e.preventDefault();
            const element = document.querySelector(href);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // 更新 URL hash
                window.history.pushState(null, '', href);
            }
        }
    };

    return (
        <PortalLayout>
            <div className={styles.portalContent}>
                <section className={styles.hero}>
                    <div className={styles.heroBadge}>
                        链计算 · TEE
                    </div>
                    <Title level={1} className={styles.heroTitle}>
                        构建下一代 <span className={styles.heroHighlight}>分布式、高可信、多链接的先进计算平台</span>
                    </Title>
                    <Paragraph className={styles.heroSubtitle}>
                        连接区块链、TEE 与多方应用生态，为管理员、资源提供方、应用开发者以及业务场景提供一站式入口，快速启用可信计算能力。
                    </Paragraph>
                    <div className={styles.heroActions}>
                        <Link href="/management/login">
                            <Button type="primary" size="large" style={{ background: '#2563eb', borderColor: '#2563eb' }}>
                                进入管理端
                            </Button>
                        </Link>
                        <Link href="/developers">
                            <Button size="large" style={{ background: '#ffffff', borderColor: '#e5e7eb', color: '#1f2937' }}>
                                面向开发者
                            </Button>
                        </Link>
                    </div>

                    {/* 角色化入口 */}
                    <div style={{ marginTop: '48px' }}>
                        <Row gutter={[24, 24]} justify="center">
                            {entryCards.map((card) => (
                                <Col xs={24} sm={12} md={8} lg={6} xl={4} key={card.title}>
                                    {card.href.startsWith('#') ? (
                                        <Card
                                            hoverable
                                            className={styles.portalCard}
                                            onClick={(e) => handleCardClick(card.href, e)}
                                            style={{
                                                height: '100%',
                                                textAlign: 'center',
                                                display: 'flex',
                                                flexDirection: 'column',
                                            }}
                                            bodyStyle={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                flex: 1,
                                                padding: '24px',
                                            }}
                                        >
                                            <div style={{
                                                width: 48,
                                                height: 48,
                                                borderRadius: 12,
                                                background: '#eff6ff',
                                                border: '1px solid #dbeafe',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                margin: '0 auto 16px',
                                                fontSize: '24px',
                                                color: '#2563eb'
                                            }}>
                                                {card.icon}
                                            </div>
                                            <Title level={5} style={{
                                                fontSize: 16,
                                                fontWeight: 600,
                                                color: '#1f2937',
                                                marginBottom: 8,
                                                marginTop: 0
                                            }}>
                                                {card.title}
                                            </Title>
                                            <Paragraph style={{
                                                fontSize: 14,
                                                color: '#6b7280',
                                                marginBottom: 0,
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                justifyContent: 'center',
                                                minHeight: 48
                                            }}>
                                                {card.description}
                                            </Paragraph>
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'center',
                                                gap: 8,
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                                marginTop: '16px'
                                            }}>
                                                {card.tag && (
                                                    <Tag style={{
                                                        background: '#eff6ff',
                                                        color: '#2563eb',
                                                        border: '1px solid #bfdbfe',
                                                        margin: 0
                                                    }}>
                                                        {card.tag}
                                                    </Tag>
                                                )}
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    style={{
                                                        background: '#2563eb',
                                                        borderColor: '#2563eb'
                                                    }}
                                                >
                                                    {card.actionText}
                                                </Button>
                                            </div>
                                        </Card>
                                    ) : (
                                        <Link href={card.href} style={{ height: '100%', display: 'block' }}>
                                            <Card
                                                hoverable
                                                className={styles.portalCard}
                                                style={{
                                                    height: '100%',
                                                    textAlign: 'center',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                }}
                                                bodyStyle={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    flex: 1,
                                                    padding: '24px',
                                                }}
                                            >
                                                <div style={{
                                                    width: 48,
                                                    height: 48,
                                                    borderRadius: 12,
                                                    background: '#eff6ff',
                                                    border: '1px solid #dbeafe',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    margin: '0 auto 16px',
                                                    fontSize: '24px',
                                                    color: '#2563eb'
                                                }}>
                                                    {card.icon}
                                                </div>
                                                <Title level={5} style={{
                                                    fontSize: 16,
                                                    fontWeight: 600,
                                                    color: '#1f2937',
                                                    marginBottom: 8,
                                                    marginTop: 0
                                                }}>
                                                    {card.title}
                                                </Title>
                                                <Paragraph style={{
                                                    fontSize: 14,
                                                    color: '#6b7280',
                                                    marginBottom: 0,
                                                    flex: 1,
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    justifyContent: 'center',
                                                    minHeight: 48
                                                }}>
                                                    {card.description}
                                                </Paragraph>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    gap: 8,
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                    marginTop: '16px'
                                                }}>
                                                    {card.tag && (
                                                        <Tag style={{
                                                            background: '#eff6ff',
                                                            color: '#2563eb',
                                                            border: '1px solid #bfdbfe',
                                                            margin: 0
                                                        }}>
                                                            {card.tag}
                                                        </Tag>
                                                    )}
                                                    <Button
                                                        type="primary"
                                                        size="small"
                                                        style={{
                                                            background: '#2563eb',
                                                            borderColor: '#2563eb'
                                                        }}
                                                    >
                                                        {card.actionText}
                                                    </Button>
                                                </div>
                                            </Card>
                                        </Link>
                                    )}
                                </Col>
                            ))}
                        </Row>
                    </div>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        平台核心功能
                    </Title>
                    <Paragraph className={styles.sectionDescription}>
                        覆盖可信计算、资源调度、激励机制、隐私保护等核心能力，构建完整的隐私计算生态体系。
                    </Paragraph>
                    <Row gutter={[24, 24]}>
                        {coreFeatures.map((feature) => (
                            <Col xs={24} sm={12} md={8} key={feature.title}>
                                <Link href={feature.href}>
                                    <Card
                                        className={styles.portalCard}
                                        hoverable
                                        style={{
                                            height: '100%',
                                            textAlign: 'center',
                                            transition: 'all 0.3s ease',
                                        }}
                                    >
                                        <div style={{
                                            width: 64,
                                            height: 64,
                                            borderRadius: 16,
                                            background: '#eff6ff',
                                            border: '1px solid #dbeafe',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 20px',
                                            fontSize: '32px',
                                            color: '#2563eb',
                                        }}>
                                            {feature.icon}
                                        </div>
                                        <Title level={4} className={styles.cardTitle} style={{ marginBottom: 12 }}>
                                            {feature.title}
                                        </Title>
                                        <Paragraph className={styles.cardDescription} style={{ marginBottom: 0 }}>
                                            {feature.description}
                                        </Paragraph>
                                    </Card>
                                </Link>
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

                <section id="scenarios" className={styles.section}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        marginBottom: 32
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px'
                        }}>
                            <SettingOutlined style={{ fontSize: 24, color: '#2563eb', lineHeight: '1' }} />
                        </div>
                        <Title level={3} className={styles.sectionTitle} style={{ margin: 0, lineHeight: '1.2' }}>
                            三大核心应用场景
                        </Title>
                    </div>
                    <Row gutter={[24, 24]}>
                        {scenarioCards.map((scenario) => (
                            <Col xs={24} md={8} key={scenario.title}>
                                <Card className={styles.portalCard} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: 12,
                                            background: '#eff6ff',
                                            border: '1px solid #dbeafe',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            margin: '0 auto 16px',
                                            color: '#2563eb'
                                        }}>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '28px',
                                                lineHeight: '1',
                                                width: '28px',
                                                height: '28px'
                                            }}>
                                                {scenario.icon}
                                            </div>
                                        </div>
                                        <Title level={4} style={{ color: '#1f2937', marginBottom: 12, textAlign: 'center' }}>
                                            {scenario.title}
                                        </Title>
                                        <Paragraph style={{ color: '#6b7280', marginBottom: 24, minHeight: 60, textAlign: 'center' }}>
                                            {scenario.description}
                                        </Paragraph>
                                    </div>
                                    <div style={{ marginTop: 'auto' }}>
                                        <Button
                                            type="primary"
                                            style={{
                                                background: '#2563eb',
                                                borderColor: '#2563eb',
                                                width: '100%'
                                            }}
                                            href={scenario.buttonLink}
                                        >
                                            {scenario.buttonText} <RightOutlined />
                                        </Button>
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </section>
            </div>
        </PortalLayout>
    );
}
