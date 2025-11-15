'use client';

import React from 'react';
import { Card, Col, List, Row, Timeline, Typography, Button } from 'antd';
import { CloudServerOutlined, FileTextOutlined, ThunderboltOutlined, GiftOutlined } from '@ant-design/icons';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from '../portal.module.css';

const { Title, Paragraph, Text } = Typography;

const deployChecklist = [
    '准备 SGX / TDX 能力的服务器或可信云主机',
    '安装 Phala Worker 运行环境与必要依赖',
    '配置与链上账户绑定的安全证书与密钥',
    '接入监控探针并完成巡检报告上传',
];

const incentiveItems = [
    { label: '激励账号', value: '5FHneW46xGX...ciq5t' },
    { label: '近 7 日奖励', value: '2,430 PHA' },
    { label: '节点可信度', value: '98.6%' },
    { label: '待处理告警', value: '0' },
];

const operations = [
    { title: 'Worker 部署包', description: '下载最新的 Worker 镜像与配置模板，支持容器化或裸金属。' },
    { title: '巡检与诊断工具', description: '实时查看健康度、远程日志、TEE 远程证明状态。' },
    { title: '收益与激励看板', description: '跟踪奖励发放节奏、收益结算及惩罚策略。' },
];

export default function ProvidersPage() {
    return (
        <PortalLayout>
            <div className={styles.portalContent}>
                <section className={styles.hero}>
                    <div className={styles.heroBadge}>
                        <CloudServerOutlined /> 资源提供者专属
                    </div>
                    <Title level={2} className={styles.heroTitle}>
                        Worker 接入与激励监控中心
                    </Title>
                    <Paragraph className={styles.heroSubtitle}>
                        统一交付部署清单、运行手册与激励数据，帮助资源提供者快速上线、稳定运营、透明领取收益。
                    </Paragraph>
                    <div className={styles.heroStats}>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatValue}>48</div>
                            <div className={styles.heroStatLabel}>已接入资源方</div>
                        </div>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatValue}>162</div>
                            <div className={styles.heroStatLabel}>在网 Worker</div>
                        </div>
                        <div className={styles.heroStat}>
                            <div className={styles.heroStatValue}>3</div>
                            <div className={styles.heroStatLabel}>待审核节点</div>
                        </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        快速部署清单
                    </Title>
                    <Paragraph className={styles.sectionDescription}>
                        按照以下步骤即可完成 Worker 节点上线，系统将自动校验配置并生成巡检报告。
                    </Paragraph>
                    <Row gutter={[24, 24]}>
                        <Col xs={24} md={14}>
                            <Card className={styles.portalCard}>
                                <Timeline
                                    items={deployChecklist.map((item, idx) => ({
                                        color: idx === deployChecklist.length - 1 ? 'green' : 'blue',
                                        children: <Text style={{ color: '#fff' }}>{item}</Text>,
                                    }))}
                                />
                                <Button type="primary" icon={<ThunderboltOutlined />} style={{ marginTop: 24 }}>
                                    下载部署手册
                                </Button>
                            </Card>
                        </Col>
                        <Col xs={24} md={10}>
                            <Card className={styles.portalCard}>
                                <Title level={4} style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <GiftOutlined /> 激励摘要
                                </Title>
                                <div className={styles.infoGrid} style={{ marginTop: 16 }}>
                                    {incentiveItems.map((item) => (
                                        <div key={item.label} className={styles.infoCard}>
                                            <div className={styles.infoLabel}>{item.label}</div>
                                            <div className={styles.infoValue}>{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        常用资源
                    </Title>
                    <Row gutter={[24, 24]}>
                        {operations.map((op) => (
                            <Col xs={24} md={8} key={op.title}>
                                <Card className={styles.portalCard}>
                                    <div className={styles.cardIcon}>
                                        <FileTextOutlined />
                                    </div>
                                    <Title level={4} style={{ color: '#fff' }}>
                                        {op.title}
                                    </Title>
                                    <Paragraph style={{ color: 'rgba(255,255,255,0.75)' }}>
                                        {op.description}
                                    </Paragraph>
                                    <Button type="link" style={{ padding: 0 }}>
                                        立即查看
                                    </Button>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        激励发放计划
                    </Title>
                    <Paragraph className={styles.sectionDescription}>
                        系统会在结算周期后自动推送奖励明细，同时可导出对账单。
                    </Paragraph>
                    <Card className={styles.portalCard}>
                        <List
                            className={styles.list}
                            dataSource={[
                                { label: '本周期奖励', value: '预计 6 月 12 日发放' },
                                { label: '支付网络', value: 'Polkadot / Khala' },
                                { label: '收益系数', value: '1.12（根据可靠性加权）' },
                                { label: '加速条件', value: '完成 100% 巡检与 SLA' },
                            ]}
                            renderItem={(item) => (
                                <List.Item className={styles.listItem}>
                                    <span className={styles.listLabel}>{item.label}</span>
                                    <span className={styles.listValue}>{item.value}</span>
                                </List.Item>
                            )}
                        />
                    </Card>
                </section>
            </div>
        </PortalLayout>
    );
}
