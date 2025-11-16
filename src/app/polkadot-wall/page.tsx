'use client';

import React, { useState, useEffect } from 'react';
import { Row, Col, Statistic, Typography, Tag, Table, Spin, Empty } from 'antd';
import {
    DesktopOutlined,
    GlobalOutlined,
    SafetyCertificateOutlined,
    TrophyOutlined,
    FileProtectOutlined,
    KeyOutlined,
    ThunderboltOutlined,
    BlockOutlined,
    TransactionOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons';
import DataCard from '@/components/DataCard';
import dynamic from 'next/dynamic';
import styles from './dashboard.module.css';

const { Title, Text } = Typography;

// 动态导入图表组件
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface DashboardData {
    blockchain: {
        blockNumber: number;
        blockHash: string;
        avgBlockTime: number;
        consensusNodes: number;
    };
    workers: {
        total: number;
        online: number;
        offline: number;
        unresponsive: number;
        byTeeType: {
            SGX: { total: number; online: number; offline: number };
            CSV: { total: number; online: number; offline: number };
            AMD: { total: number; online: number; offline: number };
        };
    };
    contracts: {
        total: number;
        active: number;
        byType: { [key: string]: number };
    };
    incentives: {
        totalAmount: number;
        totalRewards: number;
        averageScore: number;
    };
    system: {
        health: number;
        uptime: number;
    };
}

export default function PolkadotWallPage() {
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [workerMonitorData, setWorkerMonitorData] = useState<any>(null);
    const [incentiveData, setIncentiveData] = useState<any>(null);
    const [blocks, setBlocks] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [keyRotationData, setKeyRotationData] = useState<any>(null);

    // 更新时间
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // 加载数据
    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadDashboardData, 10000); // 每10秒刷新
        return () => clearInterval(interval);
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);

            // 并行加载所有数据，使用 allSettled 确保即使某些请求失败，其他请求仍能完成
            const results = await Promise.allSettled([
                fetch('/api/dashboard/summary').catch(err => {
                    console.warn('Failed to fetch summary:', err);
                    return null;
                }),
                fetch('/api/dashboard/workers/monitor?teeType=all').catch(err => {
                    console.warn('Failed to fetch worker monitor:', err);
                    return null;
                }),
                fetch('/api/dashboard/incentives/summary').catch(err => {
                    console.warn('Failed to fetch incentives:', err);
                    return null;
                }),
                fetch('/api/dashboard/blocks/latest?limit=5').catch(err => {
                    console.warn('Failed to fetch blocks:', err);
                    return null;
                }),
                fetch('/api/dashboard/transactions/latest?limit=5').catch(err => {
                    console.warn('Failed to fetch transactions:', err);
                    return null;
                }),
                fetch('/api/dashboard/key-rotation/stats').catch(err => {
                    console.warn('Failed to fetch key rotation:', err);
                    return null;
                }),
            ]);

            // 处理 summary 数据
            if (results[0].status === 'fulfilled' && results[0].value && results[0].value.ok) {
                try {
                    const summary = await results[0].value.json();
                    if (summary.success) {
                        setDashboardData(summary.data);
                    }
                } catch (e) {
                    console.warn('Failed to parse summary data:', e);
                }
            }

            // 处理 worker monitor 数据
            if (results[1].status === 'fulfilled' && results[1].value && results[1].value.ok) {
                try {
                    const workerData = await results[1].value.json();
                    if (workerData.success) {
                        setWorkerMonitorData(workerData.data);
                    }
                } catch (e) {
                    console.warn('Failed to parse worker monitor data:', e);
                }
            }

            // 处理 incentive 数据
            if (results[2].status === 'fulfilled' && results[2].value && results[2].value.ok) {
                try {
                    const incentive = await results[2].value.json();
                    if (incentive.success) {
                        setIncentiveData(incentive.data);
                    }
                } catch (e) {
                    console.warn('Failed to parse incentive data:', e);
                }
            }

            // 处理 blocks 数据
            if (results[3].status === 'fulfilled' && results[3].value && results[3].value.ok) {
                try {
                    const blocksData = await results[3].value.json();
                    if (blocksData.success) {
                        setBlocks(blocksData.data.blocks || []);
                    }
                } catch (e) {
                    console.warn('Failed to parse blocks data:', e);
                }
            }

            // 处理 transactions 数据
            if (results[4].status === 'fulfilled' && results[4].value && results[4].value.ok) {
                try {
                    const txData = await results[4].value.json();
                    if (txData.success) {
                        setTransactions(txData.data.transactions || []);
                    }
                } catch (e) {
                    console.warn('Failed to parse transactions data:', e);
                }
            }

            // 处理 key rotation 数据
            if (results[5].status === 'fulfilled' && results[5].value && results[5].value.ok) {
                try {
                    const rotation = await results[5].value.json();
                    if (rotation.success) {
                        setKeyRotationData(rotation.data);
                    }
                } catch (e) {
                    console.warn('Failed to parse key rotation data:', e);
                }
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            // 即使出错也设置默认值，确保页面可以正常显示
            // 注意：这里不检查 dashboardData，因为它在函数作用域内不可用
            // 如果所有请求都失败，至少设置默认值让页面可以渲染
        } finally {
            setLoading(false);
        }
    };

    // 格式化时间
    const formatTime = (date: Date) => {
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    // Worker 监控表格列
    const workerColumns = [
        {
            title: 'Worker ID',
            dataIndex: 'name',
            key: 'name',
            width: 100,
            render: (text: string) => <Text style={{ color: '#fff', fontSize: '11px' }} ellipsis>{text}</Text>,
        },
        {
            title: 'TEE类型',
            dataIndex: 'teeType',
            key: 'teeType',
            width: 70,
            render: (type: string) => {
                const colors: { [key: string]: string } = {
                    SGX: 'blue',
                    CSV: 'green',
                    AMD: 'orange',
                };
                return <Tag color={colors[type] || 'default'} style={{ fontSize: '11px', padding: '0 6px', margin: 0 }}>{type}</Tag>;
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 70,
            render: (status: string) => {
                const colorMap: { [key: string]: string } = {
                    online: 'success',
                    offline: 'error',
                    unresponsive: 'warning',
                };
                const textMap: { [key: string]: string } = {
                    online: '在线',
                    offline: '离线',
                    unresponsive: '无响应',
                };
                return <Tag color={colorMap[status]} style={{ fontSize: '11px', padding: '0 6px', margin: 0 }}>{textMap[status] || status}</Tag>;
            },
        },
        {
            title: '评分',
            dataIndex: 'initialScore',
            key: 'initialScore',
            width: 60,
            render: (score: number) => <Text style={{ color: '#fff', fontSize: '11px' }}>{score || 0}</Text>,
        },
    ];

    // 区块表格列
    const blockColumns = [
        {
            title: '区块号',
            dataIndex: 'number',
            key: 'number',
            width: 90,
            render: (num: number) => <Text style={{ color: '#fff', fontSize: '11px' }}>#{num}</Text>,
        },
        {
            title: '交易数',
            dataIndex: 'transactionCount',
            key: 'transactionCount',
            width: 70,
            render: (count: number) => <Text style={{ color: '#fff', fontSize: '11px' }}>{count}</Text>,
        },
        {
            title: '时间',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 100,
            render: (ts: number) => (
                <Text style={{ color: '#fff', fontSize: '11px' }}>
                    {new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
            ),
        },
    ];

    // 交易表格列
    const transactionColumns = [
        {
            title: '交易哈希',
            dataIndex: 'hash',
            key: 'hash',
            width: 120,
            render: (hash: string) => (
                <Text style={{ color: '#fff', fontSize: '10px' }} ellipsis>
                    {hash.substring(0, 12)}...
                </Text>
            ),
        },
        {
            title: '区块',
            dataIndex: 'blockNumber',
            key: 'blockNumber',
            width: 70,
            render: (num: number) => <Text style={{ color: '#fff', fontSize: '11px' }}>#{num}</Text>,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 50,
            render: (status: string) => (
                <Tag color={status === 'success' ? 'success' : 'error'} style={{ fontSize: '11px', padding: '0 6px', margin: 0 }}>
                    {status === 'success' ? '成功' : '失败'}
                </Tag>
            ),
        },
    ];

    // 准备图表数据
    const workerDistributionData = dashboardData
        ? [
            { type: 'SGX', value: dashboardData.workers.byTeeType.SGX.total },
            { type: 'CSV', value: dashboardData.workers.byTeeType.CSV.total },
            { type: 'AMD', value: dashboardData.workers.byTeeType.AMD.total },
        ].filter((item) => item.value > 0)
        : [];

    const rewardDistributionData =
        incentiveData?.rewardDistribution?.map((item: any) => ({
            type: item.type,
            value: item.amount,
        })) || [];

    // ECharts 配置
    const workerDistributionOption = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            textStyle: { color: '#fff' },
        },
        legend: {
            bottom: 0,
            textStyle: { color: '#fff' },
        },
        series: [
            {
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#0f1022',
                    borderWidth: 2,
                },
                label: {
                    show: true,
                    color: '#fff',
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold',
                    },
                },
                data: workerDistributionData.map((item) => ({
                    value: item.value,
                    name: item.type,
                })),
            },
        ],
    };

    if (loading && !dashboardData) {
        return (
            <div className={styles.dashboardContainer}>
                <div className={styles.loadingContainer}>
                    <Spin size="large" />
                    <Text style={{ color: '#fff', marginTop: 16, display: 'block' }}>加载数据中...</Text>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.dashboardContainer}>
            {/* 顶部标题栏 */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <div className={styles.heroBadge}>
                        <BlockOutlined /> 链上态势可视化大屏
                    </div>
                    <Title level={2} className={styles.title}>
                        Phala Platform 数据大屏
                    </Title>
                    <Text className={styles.subtitle}>实时展示链上链下关键指标、拓扑态势与激励状态</Text>
                </div>
                <div className={styles.headerRight}>
                    <ClockCircleOutlined style={{ color: '#00e5ff' }} />
                    <Text className={styles.timeText}>{formatTime(currentTime)}</Text>
                </div>
            </div>

            {/* 主要内容区域 */}
            <div className={styles.content}>
                {/* 左侧列 */}
                <div className={styles.leftColumn}>
                    {/* Worker资源数据 */}
                    <DataCard
                        title="Worker资源数据"
                        titleIcon={<DesktopOutlined />}
                        className={styles.dataCard}
                    >
                        <div className={styles.statRow4}>
                            <Statistic
                                title="总节点数"
                                value={dashboardData?.workers.total || 0}
                                prefix={<GlobalOutlined />}
                                valueStyle={{ color: '#00e5ff', fontSize: '14px' }}
                            />
                            <Statistic
                                title="在线节点"
                                value={dashboardData?.workers.online || 0}
                                prefix={<GlobalOutlined />}
                                valueStyle={{ color: '#52c41a', fontSize: '14px' }}
                            />
                            <Statistic
                                title="SGX节点"
                                value={dashboardData?.workers.byTeeType.SGX.online || 0}
                                suffix={`/ ${dashboardData?.workers.byTeeType.SGX.total || 0}`}
                                valueStyle={{ color: '#1890ff', fontSize: '14px' }}
                            />
                            <Statistic
                                title="CSV节点"
                                value={dashboardData?.workers.byTeeType.CSV.online || 0}
                                suffix={`/ ${dashboardData?.workers.byTeeType.CSV.total || 0}`}
                                valueStyle={{ color: '#52c41a', fontSize: '14px' }}
                            />
                        </div>
                        {workerMonitorData?.workers && workerMonitorData.workers.length > 0 && (
                            <div className={styles.tableContainer}>
                                <Table
                                    dataSource={workerMonitorData.workers.slice(0, 3)}
                                    columns={workerColumns}
                                    pagination={false}
                                    size="small"
                                    className={styles.table}
                                />
                            </div>
                        )}
                    </DataCard>

                    {/* Worker状态统计 */}
                    <DataCard
                        title="Worker状态统计"
                        titleIcon={<SafetyCertificateOutlined />}
                        className={styles.dataCard}
                    >
                        <div className={styles.statRow3}>
                            <Statistic
                                title="在线"
                                value={workerMonitorData?.summary?.online || 0}
                                valueStyle={{ color: '#52c41a', fontSize: '14px' }}
                            />
                            <Statistic
                                title="离线"
                                value={workerMonitorData?.summary?.offline || 0}
                                valueStyle={{ color: '#ff4d4f', fontSize: '14px' }}
                            />
                            <Statistic
                                title="无响应"
                                value={workerMonitorData?.summary?.unresponsive || 0}
                                valueStyle={{ color: '#faad14', fontSize: '14px' }}
                            />
                        </div>
                    </DataCard>

                    {/* 激励数据 */}
                    <DataCard
                        title="激励数据"
                        titleIcon={<TrophyOutlined />}
                        className={styles.dataCard}
                    >
                        <div className={styles.statRow}>
                            <Statistic
                                title="总激励金额"
                                value={incentiveData?.totalAmount || 0}
                                precision={2}
                                suffix="PHA"
                                valueStyle={{ color: '#faad14', fontSize: '14px' }}
                            />
                            <Statistic
                                title="平均评分"
                                value={incentiveData?.averageScore || 0}
                                precision={1}
                                valueStyle={{ color: '#52c41a', fontSize: '14px' }}
                            />
                        </div>
                        {rewardDistributionData.length > 0 && (
                            <div className={styles.chartContainer} style={{ height: '140px' }}>
                                <ReactECharts
                                    option={{
                                        ...workerDistributionOption,
                                        series: [
                                            {
                                                ...workerDistributionOption.series[0],
                                                data: rewardDistributionData.map((item: any) => ({
                                                    value: item.value,
                                                    name: item.type,
                                                })),
                                            },
                                        ],
                                    }}
                                    style={{ height: '100%', width: '100%' }}
                                />
                            </div>
                        )}
                    </DataCard>
                </div>

                {/* 中间主区域 */}
                <div className={styles.centerColumn}>
                    {/* 核心指标 */}
                    <DataCard
                        title="核心指标"
                        titleIcon={<BlockOutlined />}
                        className={styles.dataCard}
                    >
                        <Row gutter={[12, 12]}>
                            <Col span={6}>
                                <Statistic
                                    title="区块高度"
                                    value={dashboardData?.blockchain.blockNumber || 0}
                                    prefix={<BlockOutlined />}
                                    valueStyle={{ color: '#00e5ff', fontSize: '20px' }}
                                />
                            </Col>
                            <Col span={6}>
                                <Statistic
                                    title="出块间隔"
                                    value={dashboardData?.blockchain.avgBlockTime || 0}
                                    precision={2}
                                    suffix="秒"
                                    valueStyle={{ color: '#faad14', fontSize: '20px' }}
                                />
                            </Col>
                            <Col span={6}>
                                <Statistic
                                    title="系统健康度"
                                    value={dashboardData?.system.health || 0}
                                    suffix="%"
                                    valueStyle={{ color: '#52c41a', fontSize: '20px' }}
                                />
                            </Col>
                            <Col span={6}>
                                <Statistic
                                    title="共识节点"
                                    value={dashboardData?.blockchain.consensusNodes || 0}
                                    valueStyle={{ color: '#1890ff', fontSize: '20px' }}
                                />
                            </Col>
                        </Row>

                        {/* Worker分布饼图 */}
                        {workerDistributionData.length > 0 && (
                            <div className={styles.chartContainer} style={{ marginTop: 12, height: '200px' }}>
                                <ReactECharts
                                    option={{
                                        ...workerDistributionOption,
                                        legend: {
                                            ...workerDistributionOption.legend,
                                            textStyle: { color: '#fff', fontSize: 12 },
                                        },
                                    }}
                                    style={{ height: '100%', width: '100%' }}
                                />
                            </div>
                        )}
                    </DataCard>

                    {/* 区块浏览器 */}
                    <DataCard
                        title="区块浏览器"
                        titleIcon={<TransactionOutlined />}
                        className={styles.dataCard}
                    >
                        <Row gutter={[12, 12]}>
                            <Col span={12}>
                                <Title level={5} style={{ color: '#fff', marginBottom: 8, fontSize: '14px' }}>
                                    最新区块
                                </Title>
                                {blocks.length > 0 ? (
                                    <div className={styles.tableContainer}>
                                        <Table
                                            dataSource={blocks.slice(0, 3)}
                                            columns={blockColumns}
                                            pagination={false}
                                            size="small"
                                            className={styles.table}
                                        />
                                    </div>
                                ) : (
                                    <Empty description="暂无数据" style={{ color: '#fff' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                )}
                            </Col>
                            <Col span={12}>
                                <Title level={5} style={{ color: '#fff', marginBottom: 8, fontSize: '14px' }}>
                                    最新交易
                                </Title>
                                {transactions.length > 0 ? (
                                    <div className={styles.tableContainer}>
                                        <Table
                                            dataSource={transactions.slice(0, 3)}
                                            columns={transactionColumns}
                                            pagination={false}
                                            size="small"
                                            className={styles.table}
                                        />
                                    </div>
                                ) : (
                                    <Empty description="暂无数据" style={{ color: '#fff' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                )}
                            </Col>
                        </Row>
                    </DataCard>
                </div>

                {/* 右侧列 */}
                <div className={styles.rightColumn}>
                    {/* 密钥轮换 */}
                    <DataCard
                        title="密钥轮换"
                        titleIcon={<KeyOutlined />}
                        className={styles.dataCard}
                    >
                        <div className={styles.statRow3}>
                            <Statistic
                                title="总密钥数"
                                value={keyRotationData?.totalKeys || 0}
                                valueStyle={{ color: '#722ed1', fontSize: '14px' }}
                            />
                            <Statistic
                                title="活跃密钥"
                                value={keyRotationData?.activeKeys || 0}
                                valueStyle={{ color: '#52c41a', fontSize: '14px' }}
                            />
                            <Statistic
                                title="轮换中"
                                value={keyRotationData?.rotatingKeys || 0}
                                valueStyle={{ color: '#faad14', fontSize: '14px' }}
                            />
                        </div>
                        <div className={styles.infoBox} style={{ marginTop: '8px', padding: '8px 12px' }}>
                            <Text style={{ color: '#fff', fontSize: '11px' }}>
                                下次轮换: 区块 #{keyRotationData?.nextRotation?.estimatedBlock || 0}
                            </Text>
                        </div>
                    </DataCard>

                    {/* 服务调度 */}
                    <DataCard
                        title="服务调度"
                        titleIcon={<ThunderboltOutlined />}
                        className={styles.dataCard}
                    >
                        <div className={styles.statRow}>
                            <Statistic
                                title="资源利用率"
                                value={workerMonitorData?.summary?.systemHealth || 0}
                                suffix="%"
                                valueStyle={{ color: '#13c2c2', fontSize: '14px' }}
                            />
                            <Statistic
                                title="平均响应时间"
                                value={workerMonitorData?.summary?.averageResponseTime || 0}
                                suffix="ms"
                                valueStyle={{ color: '#faad14', fontSize: '14px' }}
                            />
                        </div>
                    </DataCard>

                    {/* 合约数据 */}
                    <DataCard
                        title="合约数据"
                        titleIcon={<FileProtectOutlined />}
                        className={styles.dataCard}
                    >
                        <div className={styles.statRow}>
                            <Statistic
                                title="总合约数"
                                value={dashboardData?.contracts.total || 0}
                                valueStyle={{ color: '#722ed1', fontSize: '14px' }}
                            />
                            <Statistic
                                title="活跃合约"
                                value={dashboardData?.contracts.active || 0}
                                valueStyle={{ color: '#52c41a', fontSize: '14px' }}
                            />
                        </div>
                        <div className={styles.tagContainer}>
                            {Object.entries(dashboardData?.contracts.byType || {}).map(([type, count]) => (
                                <Tag key={type} color="purple" style={{ marginBottom: 8 }}>
                                    {type}: {count as number}
                                </Tag>
                            ))}
                        </div>
                    </DataCard>
                </div>
            </div>
        </div>
    );
}
