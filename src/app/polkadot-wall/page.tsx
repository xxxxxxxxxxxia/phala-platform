'use client';

import React from 'react';
import { Card, Col, Row, Typography, Button } from 'antd';
import { RadarChartOutlined, EyeOutlined } from '@ant-design/icons';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from '../portal.module.css';

const { Title, Paragraph } = Typography;

const placeholderMetrics = [
    { label: '区块高度', value: '#8,234,112' },
    { label: '在线 Worker', value: '162' },
    { label: '平均出块', value: '12.3 秒' },
    { label: '激励发放', value: '1,240 PHA / h' },
];

export default function PolkadotWallPage() {
    return (
        <PortalLayout>
            <div className={styles.portalContent}>
                <section className={styles.hero}>
                    <div className={styles.heroBadge}>
                        <RadarChartOutlined /> 大屏占位
                    </div>
                    <Title level={2} className={styles.heroTitle}>
                        链上态势可视化大屏
                    </Title>
                    <Paragraph className={styles.heroSubtitle}>
                        借鉴 Polkadot 风格，展示链上链下关键指标、拓扑态势与激励状态，支持入驻线下展厅或指挥中心。
                    </Paragraph>
                    <div className={styles.heroActions}>
                        <Button type="primary" icon={<EyeOutlined />} size="large">
                            预览原型
                        </Button>
                        <Button size="large">下载方案</Button>
                    </div>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        即将上线
                    </Title>
                    <Paragraph className={styles.sectionDescription}>
                        当前展示为预设指标与布局示例，可根据实际数据源进行适配，支持 4K / 超宽屏渲染。
                    </Paragraph>
                    <Row gutter={[24, 24]}>
                        {placeholderMetrics.map((metric) => (
                            <Col xs={24} md={6} key={metric.label}>
                                <Card className={styles.portalCard}>
                                    <div className={styles.heroStatValue}>{metric.value}</div>
                                    <div className={styles.heroStatLabel}>{metric.label}</div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                    <div className={styles.placeholderPanel} style={{ marginTop: 32 }}>
                        <div className={styles.placeholderTitle}>实时可视化区域</div>
                        <Paragraph className={styles.sectionDescription} style={{ marginBottom: 0 }}>
                            这里将嵌入动态图表、拓扑网络、Worker 分布与告警条目。可与后端 WebSocket/GraphQL 数据流打通。
                        </Paragraph>
                    </div>
                </section>
            </div>
        </PortalLayout>
    );
}
