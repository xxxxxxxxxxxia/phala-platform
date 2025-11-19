'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Row, Col, Statistic, Typography, Tag, Table, Spin, Empty, Tooltip, Select, Input, Button } from 'antd';
import {
    DesktopOutlined,
    GlobalOutlined,
    TrophyOutlined,
    FileProtectOutlined,
    KeyOutlined,
    ThunderboltOutlined,
    BlockOutlined,
    TransactionOutlined,
    ClockCircleOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import Image from 'next/image';
import DataCard from '@/components/DataCard';
import dynamic from 'next/dynamic';
import styles from './dashboard.module.css';
import '@ant-design/v5-patch-for-react-19';

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

type BatchKey = 'summary' | 'blocks' | 'transactions' | 'workers' | 'incentives' | 'keyRotation';

interface BatchConfig {
    key: BatchKey;
    label: string;
    enabled: boolean;
    request: () => Promise<Response>;
}

type BatchResult =
    | { status: 'fulfilled'; response: Response }
    | { status: 'rejected'; error: unknown }
    | { status: 'skipped'; reason?: string };

type BatchResultMap = Partial<Record<BatchKey, BatchResult>>;

type ExplorerSearchType = 'block' | 'transaction' | 'account';

interface ExplorerBlockDetail {
    blockNumber: number;
    hash: string;
    parentHash: string;
    stateRoot: string;
    extrinsicsRoot: string;
    status: string;
    timestamp: number;
    collator: string;
    extrinsics: Array<{
        index: number;
        hash: string;
        method: string;
        signer: string;
    }>;
}

interface ExplorerTransactionDetail {
    hash: string;
    blockHash: string;
    blockNumber: number;
    timestamp: number;
    method: string;
    signer: string;
    args: any[];
    status: string;
}

interface ExplorerAccountDetail {
    account: {
        address: string;
        nonce: number;
        free: string;
        freeFormatted: string;
        reserved: string;
        reservedFormatted: string;
        miscFrozen: string;
        miscFrozenFormatted: string;
        feeFrozen: string;
        feeFrozenFormatted: string;
    };
    transactions: {
        items: Array<{
            hash: string;
            blockNumber: number;
            blockHash: string;
            timestamp: number;
            method: string;
            status: string;
            args: any[];
        }>;
        page: number;
        hasMore: boolean;
    };
}

type ExplorerSearchResult =
    | { type: 'block'; data: ExplorerBlockDetail }
    | { type: 'transaction'; data: ExplorerTransactionDetail }
    | { type: 'account'; data: ExplorerAccountDetail };

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

const truncateMiddle = (value?: string, prefix = 6, suffix = 4) => {
    if (!value) return '--';
    if (value.length <= prefix + suffix) {
        return value;
    }
    return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
};

export default function PolkadotWallPage() {
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [workerMonitorData, setWorkerMonitorData] = useState<any>(null);
    const [incentiveData, setIncentiveData] = useState<any>(null);
    const [blocks, setBlocks] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [keyRotationData, setKeyRotationData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const isInitialLoad = useRef(true);
    const [explorerView, setExplorerView] = useState<'overview' | 'blocks' | 'transactions'>('overview');
    const [searchType, setSearchType] = useState<ExplorerSearchType>('block');
    const [searchValue, setSearchValue] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResult, setSearchResult] = useState<ExplorerSearchResult | null>(null);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [searchPage, setSearchPage] = useState(1);
    const lastSearchValueRef = useRef('');
    const lastSuccessfulDataRef = useRef<{
        summary: DashboardData | null;
        workers: any;
        incentives: any;
        blocks: any[];
        transactions: any[];
        keyRotation: any;
    }>({
        summary: null,
        workers: null,
        incentives: null,
        blocks: [],
        transactions: [],
        keyRotation: null,
    });

    const [autoRefresh, setAutoRefresh] = useState(false);
    const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const KEY_SAMPLE_PAGE_SIZE = 2;
    const WORKER_PAGE_SIZE = 2;
    const INCENTIVE_ACCOUNT_PAGE_SIZE = 3;
    const [keySamplePage, setKeySamplePage] = useState(1);
    const [workerPage, setWorkerPage] = useState(1);
    const [incentiveAccountPage, setIncentiveAccountPage] = useState(1);
    const [isHydrated, setIsHydrated] = useState(false);

    // 更新时间
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // 标记客户端已完成 Hydration，避免 SSR/CSR 时间不一致
    useEffect(() => {
        setIsHydrated(true);
    }, []);


    const loadDashboardData = useCallback(async () => {
        console.log('🔍 [Dashboard] 开始加载数据...', { isInitialLoad: isInitialLoad.current });
        try {
            if (isInitialLoad.current) {
                setLoading(true);
            }
            setError(null); // 每次尝试时重置错误

            console.log('📡 [Dashboard] 发起 API 请求...');
            const isDev = process.env.NODE_ENV === 'development';

            const requestSequence: BatchConfig[] = [
                {
                    key: 'summary',
                    label: 'Summary',
                    enabled: true,
                    request: () => fetch('/api/dashboard/summary'),
                },
                {
                    key: 'blocks',
                    label: 'Blocks',
                    enabled: true,
                    request: () => fetch('/api/dashboard/blocks/latest?limit=15'),
                },
                {
                    key: 'transactions',
                    label: 'Transactions',
                    enabled: true,
                    request: () => fetch('/api/dashboard/transactions/latest?limit=15'),
                },
                {
                    key: 'workers',
                    label: 'Worker Monitor',
                    enabled: true,
                    request: () => fetch('/api/dashboard/workers/monitor?teeType=all'),
                },
                {
                    key: 'incentives',
                    label: 'Incentives',
                    enabled: true,
                    request: () => fetch('/api/dashboard/incentives/summary'),
                },
                {
                    key: 'keyRotation',
                    label: 'Key Rotation',
                    enabled: true,
                    request: () => fetch('/api/dashboard/key-rotation/stats'),
                },
            ];

            const runSequentialRequests = async (): Promise<BatchResultMap> => {
                const seqResults: BatchResultMap = {};
                let dependencyBroken = false;
                const throttleDelay = isDev ? 800 : 0;

                for (const config of requestSequence) {
                    if (!config.enabled) {
                        seqResults[config.key] = { status: 'skipped', reason: 'disabled-in-dev' };
                        console.log(`⏭️ [Dashboard] ${config.label} 已跳过 (dev=${isDev})`);
                        continue;
                    }
                    if (dependencyBroken) {
                        seqResults[config.key] = { status: 'skipped', reason: 'previous-request-failed' };
                        console.warn(`🚫 [Dashboard] 因上一个请求失败，跳过 ${config.label}`);
                        continue;
                    }

                    console.log(`🌀 [Dashboard] 开始请求 ${config.label}`);
                    try {
                        const response = await config.request();
                        if (!response.ok) {
                            seqResults[config.key] = { status: 'rejected', error: new Error(`HTTP ${response.status}`) };
                            dependencyBroken = true;
                            console.warn(`❌ [Dashboard] ${config.label} 响应异常，状态码 ${response.status}`);
                        } else {
                            seqResults[config.key] = { status: 'fulfilled', response };
                            console.log(`✅ [Dashboard] ${config.label} 请求完成`, {
                                status: response.status,
                            });
                        }
                    } catch (err) {
                        seqResults[config.key] = { status: 'rejected', error: err };
                        dependencyBroken = true;
                        console.warn(`❌ [Dashboard] ${config.label} 请求失败`, err);
                    }

                    if (!dependencyBroken && throttleDelay > 0) {
                        console.log(`⏳ [Dashboard] 开发模式延迟 ${throttleDelay}ms 后继续下一请求`);
                        await new Promise((resolve) => setTimeout(resolve, throttleDelay));
                    }
                }

                return seqResults;
            };

            const results = await runSequentialRequests();

            console.log('📊 [Dashboard] API 请求结果概览:', results);

            let hasSuccessfulData = false; // 标志位，检查是否至少有一个请求成功

            const useCachedData = <T,>(
                cachedValue: T | null | undefined,
                setter: React.Dispatch<React.SetStateAction<T>>,
                label: string
            ) => {
                if (cachedValue !== null && cachedValue !== undefined) {
                    console.log(`♻️ [Dashboard] ${label} 使用缓存数据`);
                    setter(cachedValue);
                    return true;
                }
                return false;
            };

            const summaryResult = results.summary;
            if (summaryResult?.status === 'fulfilled' && summaryResult.response.ok) {
                try {
                    const summary = await summaryResult.response.json();
                    console.log('✅ [Dashboard] Summary API 响应:', {
                        success: summary.success,
                        hasData: !!summary.data,
                        blockNumber: summary.data?.blockchain?.blockNumber,
                        totalWorkers: summary.data?.workers?.total,
                        onlineWorkers: summary.data?.workers?.online,
                        dataKeys: summary.data ? Object.keys(summary.data) : []
                    });

                    if (summary.success) {
                        console.log('📦 [Dashboard] 设置 dashboardData:', summary.data);
                        setDashboardData(summary.data);
                        lastSuccessfulDataRef.current.summary = summary.data;
                        hasSuccessfulData = true;
                    } else if (useCachedData(lastSuccessfulDataRef.current.summary, setDashboardData, 'Summary')) {
                        hasSuccessfulData = true;
                    } else {
                        console.warn('⚠️ [Dashboard] Summary API 返回 success: false', summary);
                    }
                } catch (e) {
                    console.warn('❌ [Dashboard] Failed to parse summary data:', e);
                    if (useCachedData(lastSuccessfulDataRef.current.summary, setDashboardData, 'Summary')) {
                        hasSuccessfulData = true;
                    }
                }
            } else if (!useCachedData(lastSuccessfulDataRef.current.summary, setDashboardData, 'Summary')) {
                console.warn('⚠️ [Dashboard] Summary API 请求失败或被跳过');
            } else {
                hasSuccessfulData = true;
            }

            const workerResult = results.workers;
            if (workerResult?.status === 'fulfilled' && workerResult.response.ok) {
                try {
                    const workerData = await workerResult.response.json();
                    console.log('✅ [Dashboard] Worker Monitor API 响应:', {
                        success: workerData.success,
                        hasData: !!workerData.data,
                        workersCount: workerData.data?.workers?.length,
                        summary: workerData.data?.summary
                    });

                    if (workerData.success) {
                        console.log('📦 [Dashboard] 设置 workerMonitorData:', workerData.data);
                        setWorkerMonitorData(workerData.data);
                        lastSuccessfulDataRef.current.workers = workerData.data;
                        hasSuccessfulData = true;
                    } else if (useCachedData(lastSuccessfulDataRef.current.workers, setWorkerMonitorData, 'Worker Monitor')) {
                        hasSuccessfulData = true;
                    }
                } catch (e) {
                    console.warn('❌ [Dashboard] Failed to parse worker monitor data:', e);
                    if (useCachedData(lastSuccessfulDataRef.current.workers, setWorkerMonitorData, 'Worker Monitor')) {
                        hasSuccessfulData = true;
                    }
                }
            } else if (useCachedData(lastSuccessfulDataRef.current.workers, setWorkerMonitorData, 'Worker Monitor')) {
                hasSuccessfulData = true;
            } else if (workerResult && workerResult.status !== 'skipped') {
                console.warn('⚠️ [Dashboard] Worker Monitor API 请求失败');
            }

            const incentiveResult = results.incentives;
            if (incentiveResult?.status === 'fulfilled' && incentiveResult.response.ok) {
                try {
                    const incentive = await incentiveResult.response.json();
                    console.log('✅ [Dashboard] Incentives API 响应:', {
                        success: incentive.success,
                        hasData: !!incentive.data,
                        totalAmount: incentive.data?.totalAmount,
                        averageScore: incentive.data?.averageScore
                    });

                    if (incentive.success) {
                        console.log('📦 [Dashboard] 设置 incentiveData:', incentive.data);
                        setIncentiveData(incentive.data);
                        lastSuccessfulDataRef.current.incentives = incentive.data;
                        hasSuccessfulData = true;
                    } else if (useCachedData(lastSuccessfulDataRef.current.incentives, setIncentiveData, 'Incentives')) {
                        hasSuccessfulData = true;
                    }
                } catch (e) {
                    console.warn('❌ [Dashboard] Failed to parse incentive data:', e);
                    if (useCachedData(lastSuccessfulDataRef.current.incentives, setIncentiveData, 'Incentives')) {
                        hasSuccessfulData = true;
                    }
                }
            } else if (useCachedData(lastSuccessfulDataRef.current.incentives, setIncentiveData, 'Incentives')) {
                hasSuccessfulData = true;
            } else if (incentiveResult && incentiveResult.status !== 'skipped') {
                console.warn('⚠️ [Dashboard] Incentives API 请求失败');
            }

            const blocksResult = results.blocks;
            if (blocksResult?.status === 'fulfilled' && blocksResult.response.ok) {
                try {
                    const blocksData = await blocksResult.response.json();
                    console.log('✅ [Dashboard] Blocks API 响应:', {
                        success: blocksData.success,
                        blocksCount: blocksData.data?.blocks?.length
                    });

                    if (blocksData.success) {
                        console.log('📦 [Dashboard] 设置 blocks:', blocksData.data.blocks);
                        setBlocks(blocksData.data.blocks || []);
                        lastSuccessfulDataRef.current.blocks = blocksData.data.blocks || [];
                        hasSuccessfulData = true;
                    } else if (useCachedData(lastSuccessfulDataRef.current.blocks, setBlocks, 'Blocks')) {
                        hasSuccessfulData = true;
                    }
                } catch (e) {
                    console.warn('❌ [Dashboard] Failed to parse blocks data:', e);
                    if (useCachedData(lastSuccessfulDataRef.current.blocks, setBlocks, 'Blocks')) {
                        hasSuccessfulData = true;
                    }
                }
            } else if (useCachedData(lastSuccessfulDataRef.current.blocks, setBlocks, 'Blocks')) {
                hasSuccessfulData = true;
            } else if (blocksResult && blocksResult.status !== 'skipped') {
                console.warn('⚠️ [Dashboard] Blocks API 请求失败');
            }

            const txResult = results.transactions;
            if (txResult?.status === 'fulfilled' && txResult.response.ok) {
                try {
                    const txData = await txResult.response.json();
                    console.log('✅ [Dashboard] Transactions API 响应:', {
                        success: txData.success,
                        transactionsCount: txData.data?.transactions?.length
                    });

                    if (txData.success) {
                        console.log('📦 [Dashboard] 设置 transactions:', txData.data.transactions);
                        setTransactions(txData.data.transactions || []);
                        lastSuccessfulDataRef.current.transactions = txData.data.transactions || [];
                        hasSuccessfulData = true;
                    } else if (useCachedData(lastSuccessfulDataRef.current.transactions, setTransactions, 'Transactions')) {
                        hasSuccessfulData = true;
                    }
                } catch (e) {
                    console.warn('❌ [Dashboard] Failed to parse transactions data:', e);
                    if (useCachedData(lastSuccessfulDataRef.current.transactions, setTransactions, 'Transactions')) {
                        hasSuccessfulData = true;
                    }
                }
            } else if (useCachedData(lastSuccessfulDataRef.current.transactions, setTransactions, 'Transactions')) {
                hasSuccessfulData = true;
            } else if (txResult && txResult.status !== 'skipped') {
                console.warn('⚠️ [Dashboard] Transactions API 请求失败');
            }

            const rotationResult = results.keyRotation;
            if (rotationResult?.status === 'fulfilled' && rotationResult.response.ok) {
                try {
                    const rotation = await rotationResult.response.json();
                    console.log('✅ [Dashboard] Key Rotation API 响应:', {
                        success: rotation.success,
                        hasData: !!rotation.data
                    });

                    if (rotation.success) {
                        console.log('📦 [Dashboard] 设置 keyRotationData:', rotation.data);
                        setKeyRotationData(rotation.data);
                        lastSuccessfulDataRef.current.keyRotation = rotation.data;
                        hasSuccessfulData = true;
                    } else if (useCachedData(lastSuccessfulDataRef.current.keyRotation, setKeyRotationData, 'Key Rotation')) {
                        hasSuccessfulData = true;
                    }
                } catch (e) {
                    console.warn('❌ [Dashboard] Failed to parse key rotation data:', e);
                    if (useCachedData(lastSuccessfulDataRef.current.keyRotation, setKeyRotationData, 'Key Rotation')) {
                        hasSuccessfulData = true;
                    }
                }
            } else if (useCachedData(lastSuccessfulDataRef.current.keyRotation, setKeyRotationData, 'Key Rotation')) {
                hasSuccessfulData = true;
            } else if (rotationResult && rotationResult.status !== 'skipped') {
                console.warn('⚠️ [Dashboard] Key Rotation API 请求失败');
            }

            console.log('📈 [Dashboard] 数据加载完成:', {
                hasSuccessfulData,
                isInitialLoad: isInitialLoad.current
            });

            if (hasSuccessfulData && isInitialLoad.current) {
                isInitialLoad.current = false;
            }

            if (!hasSuccessfulData) {
                setError('暂无可用数据，请稍后重试。');
                return;
            }
        } catch (error) {
            console.error('❌ [Dashboard] Failed to load dashboard data:', error);
            setError('加载过程中发生严重错误。');
            // 即使出错也设置默认值，确保页面可以正常显示
            // 注意：这里不检查 dashboardData，因为它在函数作用域内不可用
            // 如果所有请求都失败，至少设置默认值让页面可以渲染
        } finally {
            setLoading(false);
            console.log('🏁 [Dashboard] 数据加载流程结束');
        }
    }, [setBlocks, setDashboardData, setError, setIncentiveData, setKeyRotationData, setLoading, setTransactions, setWorkerMonitorData]); // 3. 依赖改为所有 setters (它们是稳定的)

    // 首次加载一次
    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    // 自动刷新：根据 autoRefresh 开关控制后续轮询（方案 B：切到自动不立刻请求）
    useEffect(() => {
        const interval = 100000; // 保持与之前相同的间隔

        const schedule = () => {
            if (!autoRefresh) return;
            autoRefreshTimerRef.current = setTimeout(async () => {
                await loadDashboardData();
                schedule();
            }, interval);
        };

        if (autoRefresh) {
            schedule();
        } else if (autoRefreshTimerRef.current) {
            clearTimeout(autoRefreshTimerRef.current);
            autoRefreshTimerRef.current = null;
        }

        return () => {
            if (autoRefreshTimerRef.current) {
                clearTimeout(autoRefreshTimerRef.current);
                autoRefreshTimerRef.current = null;
            }
        };
    }, [autoRefresh, loadDashboardData]);

    // Worker 监控表格列
    const workerColumns = useMemo(() => ([
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
                return <Tag color={colorMap[status]} style={{ fontSize: '11px', padding: '0 8px', margin: 0, minWidth: '60px', textAlign: 'center', display: 'inline-block' }}>{textMap[status] || status}</Tag>;
            },
        },
        {
            title: '评分',
            dataIndex: 'initialScore',
            key: 'initialScore',
            width: 60,
            render: (score: number) => <Text style={{ color: '#fff', fontSize: '11px' }}>{score || 0}</Text>,
        },
    ]), []);

    // 区块表格列
    const blockColumns = useMemo(() => ([
        {
            title: '区块号',
            dataIndex: 'number',
            key: 'number',
            width: 70,
            render: (num: number) => <Text style={{ color: '#fff', fontSize: '11px' }}>#{num}</Text>,
        },
        {
            title: '交易数',
            dataIndex: 'transactionCount',
            key: 'transactionCount',
            width: 60,
            render: (count: number) => <Text style={{ color: '#fff', fontSize: '11px' }}>{count}</Text>,
        },
        {
            title: '时间',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 90,
            render: (ts: number) => (
                <Text style={{ color: '#fff', fontSize: '11px' }}>
                    {new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
            ),
        },
        {
            title: '区块哈希',
            dataIndex: 'hash',
            key: 'hash',
            width: 150,
            render: (hash: string) => (
                <Tooltip title={hash}>
                    <Text style={{ color: '#fff', fontSize: '10px' }} ellipsis>
                        {truncateMiddle(hash, 10, 6)}
                    </Text>
                </Tooltip>
            ),
        },
    ]), []);

    // 交易表格列
    const transactionColumns = useMemo(() => ([
        {
            title: '交易哈希',
            dataIndex: 'hash',
            key: 'hash',
            width: 120,
            render: (hash: string) => (
                <Tooltip title={hash}>
                    <Text style={{ color: '#fff', fontSize: '10px' }} ellipsis>
                        {truncateMiddle(hash, 10, 6)}
                    </Text>
                </Tooltip>
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
            title: 'From',
            dataIndex: 'from',
            key: 'from',
            width: 120,
            render: (from: string) => (
                <Tooltip title={from}>
                    <Text style={{ color: '#fff', fontSize: '10px' }} ellipsis>
                        {truncateMiddle(from || 'System', 8, 6)}
                    </Text>
                </Tooltip>
            ),
        },
        {
            title: 'To',
            dataIndex: 'to',
            key: 'to',
            width: 120,
            render: (to: string) => (
                <Tooltip title={to}>
                    <Text style={{ color: '#fff', fontSize: '10px' }} ellipsis>
                        {truncateMiddle(to || 'System', 8, 6)}
                    </Text>
                </Tooltip>
            ),
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
    ]), []);

    const compactRowClass = useCallback((_: any, index?: number) => {
        const variant = (index ?? 0) % 2 === 0 ? styles.compactRowEven : styles.compactRowOdd;
        return `${styles.compactRow} ${variant}`;
    }, []);

    // 准备图表数据
    const workerDistributionData = useMemo(() => (dashboardData
        ? [
            { type: 'SGX', value: dashboardData.workers.byTeeType.SGX.total },
            { type: 'CSV', value: dashboardData.workers.byTeeType.CSV.total },
            { type: 'AMD', value: dashboardData.workers.byTeeType.AMD.total },
        ].filter((item) => item.value > 0)
        : []), [dashboardData]);

    const rewardDistributionData = useMemo(() => (
        incentiveData?.rewardDistribution?.map((item: any) => ({
            type: item.type,
            value: item.amount,
        })) || []
    ), [incentiveData]);

    const workerTypeChips = useMemo(() => {
        const tee = dashboardData?.workers?.byTeeType;
        if (!tee) return [];
        return [
            { key: 'SGX', label: 'SGX', total: tee.SGX.total, online: tee.SGX.online },
            { key: 'CSV', label: 'CSV', total: tee.CSV.total, online: tee.CSV.online },
            { key: 'AMD', label: 'AMD', total: tee.AMD.total, online: tee.AMD.online },
        ].filter((item) => item.total > 0);
    }, [dashboardData]);

    const incentiveAccounts = useMemo(() => (
        incentiveData?.accounts || []
    ), [incentiveData]);

    const workerList = workerMonitorData?.workers || [];
    const workerStatusDistribution = useMemo(() => workerList.reduce((acc: { [key: string]: number }, worker: any) => {
        const key = worker.status || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, { online: 0, offline: 0, unresponsive: 0 }), [workerList]);
    const workerCount = workerList.length;
    const shouldPaginateWorkers = workerCount > 2;
    const workerTotalPages = Math.max(1, Math.ceil(workerCount / WORKER_PAGE_SIZE));
    const workerTableData = useMemo(() => {
        if (!workerCount) return [];
        if (shouldPaginateWorkers) {
            const start = (workerPage - 1) * WORKER_PAGE_SIZE;
            return workerList.slice(start, start + WORKER_PAGE_SIZE);
        }
        return workerList;
    }, [workerCount, shouldPaginateWorkers, workerPage, workerList]);

    const incentiveAccountCount = incentiveAccounts.length;
    const incentiveAccountTotalPages = Math.max(1, Math.ceil(((incentiveAccountCount || 1)) / INCENTIVE_ACCOUNT_PAGE_SIZE));
    const shouldPaginateAccounts = incentiveAccountCount > INCENTIVE_ACCOUNT_PAGE_SIZE;
    const displayedIncentiveAccounts = useMemo(() => {
        if (!incentiveAccountCount) return [];
        const start = (incentiveAccountPage - 1) * INCENTIVE_ACCOUNT_PAGE_SIZE;
        return incentiveAccounts.slice(start, start + INCENTIVE_ACCOUNT_PAGE_SIZE);
    }, [incentiveAccountCount, incentiveAccountPage, incentiveAccounts]);

    const recentRotations = useMemo(() => (
        (keyRotationData?.rotationHistory || []).slice(-3).reverse()
    ), [keyRotationData]);

    const totalIncentiveAccounts = incentiveData?.accountSummary?.totalAccounts || incentiveAccounts.length;
    const totalRewardFormatted = incentiveData?.accountSummary?.totalRewardFormatted;
    const keySamples = keyRotationData?.overview?.keySamples || [];
    const pendingMessages = keyRotationData?.overview?.pendingMessages ?? 0;
    const gatekeeperKeys = keyRotationData?.overview?.gatekeeperKeys ?? 0;

    const pagedKeySamples = useMemo(() => {
        if (!keySamples.length) return [];
        const start = (keySamplePage - 1) * KEY_SAMPLE_PAGE_SIZE;
        return keySamples.slice(start, start + KEY_SAMPLE_PAGE_SIZE);
    }, [keySamples, keySamplePage, KEY_SAMPLE_PAGE_SIZE]);

    const keySampleTotalPages = useMemo(() => (
        Math.max(1, Math.ceil(keySamples.length / KEY_SAMPLE_PAGE_SIZE))
    ), [keySamples, KEY_SAMPLE_PAGE_SIZE]);

    useEffect(() => {
        if (keySamplePage > keySampleTotalPages) {
            setKeySamplePage(1);
        }
    }, [keySamplePage, keySampleTotalPages]);

    useEffect(() => {
        if (workerPage > workerTotalPages) {
            setWorkerPage(1);
        }
    }, [workerPage, workerTotalPages]);

    useEffect(() => {
        if (incentiveAccountPage > incentiveAccountTotalPages) {
            setIncentiveAccountPage(1);
        }
    }, [incentiveAccountPage, incentiveAccountTotalPages]);

    const getKeyStatusColor = useCallback((status?: string) => {
        switch (status) {
            case 'active':
                return 'success';
            case 'rotating':
                return 'processing';
            case 'expired':
            case 'revoked':
                return 'error';
            default:
                return 'default';
        }
    }, []);

    const formatEta = useCallback((seconds?: number) => {
        if (!seconds || seconds <= 0) return '估算中';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return `${minutes} 分`;
        }
        const hours = Math.floor(minutes / 60);
        return `${hours} 小时`;
    }, []);

    const nextRotationEtaText = formatEta(keyRotationData?.nextRotation?.estimatedSeconds);

    const contractHighlights = useMemo(() => {
        const byType = dashboardData?.contracts?.byType || {};
        const total = dashboardData?.contracts?.total || 0;
        return Object.entries(byType)
            .map(([type, count]) => ({
                type,
                count: count as number,
                ratio: total ? Math.round(((count as number) / total) * 100) : 0,
            }))
            .slice(0, 4);
    }, [dashboardData]);

    const serviceInsights = useMemo(() => {
        const onlineWorkers = dashboardData?.workers?.online || 0;
        const totalWorkers = dashboardData?.workers?.total || 0;
        const avgResponse = workerMonitorData?.summary?.averageResponseTime ?? 280;
        return [
            {
                label: '调度任务',
                value: workerMonitorData?.summary?.tasksLastDay || onlineWorkers * 12 || '--',
                desc: '近24小时调度完成任务量',
            },
            // {
            //     label: '平均响应',
            //     value: `${avgResponse} ms`,
            //     desc: 'Worker 平均响应耗时',
            // },
            {
                label: '任务成功率',
                value: `${workerMonitorData?.summary?.successRate || 98}%`,
                desc: '最近1小时任务成功率',
            },
            // {
            //     label: '资源覆盖率',
            //     value: totalWorkers ? `${Math.round((onlineWorkers / totalWorkers) * 100)}%` : '--',
            //     desc: '当前在线 Worker 占比',
            // },
        ];
    }, [dashboardData, workerMonitorData]);

    const incentiveAverageScore = useMemo(() => {
        const summaryScore = dashboardData?.incentives?.averageScore;
        if (typeof summaryScore === 'number' && Number.isFinite(summaryScore)) {
            return Number(summaryScore.toFixed(2));
        }
        const fallbackScore = incentiveData?.averageScore;
        if (typeof fallbackScore === 'number' && Number.isFinite(fallbackScore)) {
            return Number(fallbackScore.toFixed(2));
        }
        return 0;
    }, [dashboardData, incentiveData]);

    const systemSnapshot = useMemo(() => {
        const totalWorkers = dashboardData?.workers?.total || 0;
        const onlineWorkers = dashboardData?.workers?.online || 0;
        const onlineRate = totalWorkers ? Math.round((onlineWorkers / totalWorkers) * 100) : 0;
        const health = dashboardData?.system?.health ?? 95;
        const avgScore = incentiveAverageScore;

        return {
            highlights: [
                { label: '在线率', value: `${onlineRate}%`, desc: '实时在线 Worker 占比' },
                { label: '系统健康', value: `${health}%`, desc: '节点运行健康度' },
                { label: '激励评分', value: avgScore, desc: '近期待审平均评分' },
            ],
        };
    }, [dashboardData, incentiveAverageScore]);

    // ECharts 配置
    const workerDistributionOption = useMemo(() => ({
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            textStyle: { color: '#fff' },
        },
        legend: {
            bottom: 0,
            textStyle: { color: '#fff' },
            itemWidth: 10,
            itemHeight: 10,
            itemGap: 10,
            orient: 'horizontal',
        },
        series: [
            {
                type: 'pie',
                radius: ['38%', '62%'],
                center: ['50%', '42%'],
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
    }), [workerDistributionData]);

    const schedulingHighlights = useMemo(() => {
        const summary = workerMonitorData?.summary || {};
        const totalWorkers = dashboardData?.workers?.total || workerCount || 0;
        const onlineWorkers = summary.online ?? dashboardData?.workers?.online ?? workerStatusDistribution.online ?? 0;
        const tasksLastDay = typeof summary.tasksLastDay === 'number'
            ? summary.tasksLastDay
            : (onlineWorkers ? onlineWorkers * 12 : '--');
        const successRate = typeof summary.successRate === 'number' ? summary.successRate : 98;
        const avgResponse = summary.averageResponseTime ?? 0;

        return [
            {
                label: '任务成功率',
                value: `${successRate}%`,
                desc: 'SFQ 近1小时成功率',
            },
            {
                label: '平均响应时间',
                value: `${avgResponse} ms`,
                desc: 'Worker 平均响应',
            },
            {
                label: '在线 Worker',
                value: `${onlineWorkers}/${totalWorkers}`,
                desc: '实时在线 / 总数',
            },
            {
                label: '调度任务',
                value: tasksLastDay,
                desc: '近24小时调度量',
            },
        ];
    }, [dashboardData, workerCount, workerMonitorData, workerStatusDistribution]);

    const schedulingChartData = useMemo(() => {
        const summary = workerMonitorData?.summary || {};
        return [
            { name: '在线', value: summary.online ?? workerStatusDistribution.online ?? 0 },
            { name: '离线', value: summary.offline ?? workerStatusDistribution.offline ?? 0 },
            { name: '无响应', value: summary.unresponsive ?? workerStatusDistribution.unresponsive ?? 0 },
        ];
    }, [workerMonitorData, workerStatusDistribution]);

    const hasSchedulingChartData = useMemo(() => schedulingChartData.some((item) => item.value > 0), [schedulingChartData]);

    const schedulingChartOption = useMemo(() => ({
        backgroundColor: 'transparent',
        grid: {
            top: 20,
            right: 10,
            bottom: 20,
            left: 0,
            containLabel: true,
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            textStyle: { color: '#fff' },
        },
        xAxis: {
            type: 'category',
            data: schedulingChartData.map((item) => item.name),
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
            axisLabel: { color: 'rgba(255,255,255,0.85)' },
            axisTick: { show: false },
        },
        yAxis: {
            type: 'value',
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { color: 'rgba(255,255,255,0.65)' },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        },
        series: [
            {
                type: 'bar',
                barWidth: 18,
                data: schedulingChartData.map((item, index) => ({
                    value: item.value,
                    itemStyle: {
                        borderRadius: [4, 4, 0, 0],
                        color: ['#00e5ff', '#faad14', '#ff4d4f'][index] || '#8c8c8c',
                    },
                })),
            },
        ],
    }), [schedulingChartData]);

    const searchPlaceholderMap: Record<ExplorerSearchType, string> = {
        block: '输入区块哈希或区块号',
        transaction: '输入交易哈希',
        account: '输入账户地址',
    };

    const searchOptions: { value: ExplorerSearchType; label: string }[] = [
        { value: 'block', label: '区块' },
        { value: 'transaction', label: '交易' },
        { value: 'account', label: '账户' },
    ];

    const handleExplorerViewChange = (view: 'overview' | 'blocks' | 'transactions') => {
        setExplorerView(view);
        if (view === 'overview') {
            setSearchResult(null);
            setSearchPage(1);
            setSearchError(null);
            lastSearchValueRef.current = '';
        }
    };

    const handleSearch = useCallback(async (page = 1, keepValue?: string) => {
        const targetValue = (keepValue ?? searchValue).trim();
        if (!targetValue) {
            setSearchError('请输入要检索的内容');
            return;
        }
        try {
            setSearchLoading(true);
            setSearchError(null);
            const params = new URLSearchParams({
                type: searchType,
                value: targetValue,
                page: page.toString(),
            });
            const response = await fetch(`/api/dashboard/explorer/search?${params.toString()}`);
            if (!response.ok) {
                const errBody = await response.json().catch(() => null);
                throw new Error(errBody?.error || '查询失败');
            }
            const result = await response.json();
            setSearchResult(result as ExplorerSearchResult);
            setSearchPage(page);
            lastSearchValueRef.current = targetValue;
            if (result.type === 'block') {
                setExplorerView('blocks');
            } else {
                setExplorerView('transactions');
            }
        } catch (err) {
            console.error('[Explorer Search] Failed:', err);
            setSearchResult(null);
            setSearchError(err instanceof Error ? err.message : '查询失败');
        } finally {
            setSearchLoading(false);
        }
    }, [searchType, searchValue]);

    const handleAccountPageChange = useCallback(async (direction: 'prev' | 'next') => {
        const targetPage = direction === 'next' ? searchPage + 1 : Math.max(1, searchPage - 1);
        const keyword = lastSearchValueRef.current || searchValue;
        await handleSearch(targetPage, keyword);
    }, [handleSearch, searchPage, searchValue]);

    const shouldShowSearchResult = useMemo(() => {
        if (!searchResult) return false;
        if (searchResult.type === 'block' && explorerView === 'blocks') return true;
        if (searchResult.type === 'transaction' && explorerView === 'transactions') return true;
        if (searchResult.type === 'account' && explorerView === 'transactions') return true;
        return false;
    }, [searchResult, explorerView]);

    const renderBlockPanel = (variant: 'half' | 'full' = 'half') => (
        <div className={`${styles.tablePanel} ${variant === 'full' ? styles.tablePanelFull : ''}`}>
            <div className={styles.tablePanelHeader}>
                <div className={styles.tablePanelTitle}>最新区块</div>
                <Tag color="processing" style={{ borderRadius: 999, fontSize: 10, padding: '0 10px' }}>
                    最近15条
                </Tag>
            </div>
            {blocks.length > 0 ? (
                <div className={`${styles.tableContainer} ${variant === 'full' ? styles.equalHeightTableFull : styles.equalHeightTable}`}>
                    <Table
                        dataSource={blocks.slice(0, 15)}
                        columns={blockColumns}
                        rowKey="hash"
                        pagination={false}
                        size="small"
                        className={`${styles.table} ${styles.compactTable}`}
                        tableLayout="fixed"
                        rowClassName={compactRowClass}
                    />
                </div>
            ) : (
                <Empty description={<span style={{ color: '#fff' }}>暂无数据</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
        </div>
    );

    const renderTransactionPanel = (variant: 'half' | 'full' = 'half') => (
        <div className={`${styles.tablePanel} ${variant === 'full' ? styles.tablePanelFull : ''}`}>
            <div className={styles.tablePanelHeader}>
                <div className={styles.tablePanelTitle}>最新交易</div>
                <Tag color="processing" style={{ borderRadius: 999, fontSize: 10, padding: '0 10px' }}>
                    最近15条
                </Tag>
            </div>
            {transactions.length > 0 ? (
                <div className={`${styles.tableContainer} ${variant === 'full' ? styles.equalHeightTableFull : styles.equalHeightTable}`}>
                    <Table
                        dataSource={transactions.slice(0, 15)}
                        columns={transactionColumns}
                        rowKey="hash"
                        pagination={false}
                        size="small"
                        className={`${styles.table} ${styles.compactTable}`}
                        tableLayout="fixed"
                        rowClassName={compactRowClass}
                    />
                </div>
            ) : (
                <Empty description={<span style={{ color: '#fff' }}>暂无数据</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
        </div>
    );

    const explorerTabs: { key: 'overview' | 'blocks' | 'transactions'; label: string }[] = [
        { key: 'overview', label: '总览' },
        { key: 'blocks', label: '区块' },
        { key: 'transactions', label: '交易' },
    ];

    const ExplorerMetaGrid = ({ items }: { items: { label: string; value: React.ReactNode }[] }) => (
        <div className={styles.resultMetaGrid}>
            {items.map((item) => (
                <div key={item.label} className={styles.resultMetaItem}>
                    <span className={styles.resultLabel}>{item.label}</span>
                    <span className={styles.resultValue}>{item.value ?? '--'}</span>
                </div>
            ))}
        </div>
    );

    const renderBlockDetail = (detail: ExplorerBlockDetail) => (
        <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
                <div>
                    <div className={styles.resultTitle}>区块 #{detail.blockNumber}</div>
                    <div className={styles.resultSubtitle}>{new Date(detail.timestamp).toLocaleString()}</div>
                </div>
                <Tag color="success" className={styles.resultTag}>{detail.status}</Tag>
            </div>
            <ExplorerMetaGrid
                items={[
                    { label: '区块哈希', value: detail.hash },
                    { label: '父区块哈希', value: detail.parentHash },
                    { label: '状态根', value: detail.stateRoot },
                    { label: '交易根', value: detail.extrinsicsRoot },
                    { label: 'Collator', value: detail.collator },
                ]}
            />
            <div className={styles.resultSection}>
                <div className={styles.resultSectionHeader}>
                    <span className={styles.resultSectionTitle}>包含交易</span>
                    <Tag color="processing" className={styles.sectionTag}>{detail.extrinsics.length} 条</Tag>
                </div>
                {detail.extrinsics.length > 0 ? (
                    <div className={styles.resultList}>
                        {detail.extrinsics.map((ext) => (
                            <div key={ext.hash} className={styles.resultListItem}>
                                <div className={styles.resultListPrimary}>
                                    <span className={styles.resultBadge}>#{ext.index}</span>
                                    <span className={styles.resultMethod}>{ext.method}</span>
                                    <span className={styles.resultHash}>{truncateMiddle(ext.hash, 10, 8)}</span>
                                </div>
                                <div className={styles.resultListSecondary}>
                                    签名者：{truncateMiddle(ext.signer, 10, 8)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty
                        description={<span style={{ color: '#fff' }}>暂无交易</span>}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                )}
            </div>
        </div>
    );

    const renderTransactionDetail = (detail: ExplorerTransactionDetail) => (
        <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
                <div>
                    <div className={styles.resultTitle}>交易 {truncateMiddle(detail.hash, 12, 8)}</div>
                    <div className={styles.resultSubtitle}>
                        区块 #{detail.blockNumber} · {new Date(detail.timestamp).toLocaleString()}
                    </div>
                </div>
                <Tag color={detail.status === 'success' ? 'success' : 'error'} className={styles.resultTag}>
                    {detail.status === 'success' ? '成功' : detail.status}
                </Tag>
            </div>
            <ExplorerMetaGrid
                items={[
                    { label: '交易哈希', value: detail.hash },
                    { label: '区块哈希', value: detail.blockHash },
                    { label: '调用方法', value: detail.method },
                    { label: '签名者', value: detail.signer },
                ]}
            />
            {detail.args?.length > 0 && (
                <div className={styles.resultSection}>
                    <div className={styles.resultSectionHeader}>
                        <span className={styles.resultSectionTitle}>参数</span>
                        <Tag color="default" className={styles.sectionTag}>{detail.args.length} 项</Tag>
                    </div>
                    <div className={styles.resultList}>
                        {detail.args.map((arg, idx) => (
                            <div key={idx} className={styles.argItem}>
                                {typeof arg === 'object' ? JSON.stringify(arg) : String(arg)}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    const renderAccountDetail = (detail: ExplorerAccountDetail) => (
        <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
                <div>
                    <div className={styles.resultTitle}>账户 {truncateMiddle(detail.account.address, 10, 8)}</div>
                    <div className={styles.resultSubtitle}>最近交易 {detail.transactions.items.length} 条</div>
                </div>
                <Tag color="processing" className={styles.resultTag}>账户</Tag>
            </div>
            <ExplorerMetaGrid
                items={[
                    { label: '账户地址', value: detail.account.address },
                    { label: 'Nonce', value: detail.account.nonce },
                    { label: '可用余额', value: `${detail.account.freeFormatted} CMC` },
                    { label: '冻结余额', value: `${detail.account.miscFrozenFormatted} CMC` },
                ]}
            />
            <div className={styles.resultSection}>
                <div className={styles.resultSectionHeader}>
                    <span className={styles.resultSectionTitle}>最近交易</span>
                    <Tag color="processing" className={styles.sectionTag}>
                        第 {detail.transactions.page} 页
                    </Tag>
                </div>
                {detail.transactions.items.length > 0 ? (
                    <div className={styles.resultList}>
                        {detail.transactions.items.map((item) => (
                            <div key={item.hash} className={styles.resultListItem}>
                                <div className={styles.resultListPrimaryRow}>
                                    <div className={styles.resultListPrimary}>
                                        <span className={styles.resultHash}>{truncateMiddle(item.hash, 12, 8)}</span>
                                        <span className={styles.resultMethod}>{item.method}</span>
                                        <span className={styles.resultBadge}>#{item.blockNumber}</span>
                                    </div>
                                    <div className={styles.resultListSecondary}>
                                        {new Date(item.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty
                        description={<span style={{ color: '#fff' }}>暂无交易记录</span>}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                )}
                <div className={styles.resultPagination}>
                    <Button
                        size="small"
                        type="primary"
                        className={styles.paginationButton}
                        disabled={searchPage === 1 || searchLoading}
                        onClick={() => handleAccountPageChange('prev')}
                    >
                        上一页
                    </Button>
                    <span>第 {detail.transactions.page} 页</span>
                    <Button
                        size="small"
                        type="primary"
                        className={styles.paginationButton}
                        disabled={!detail.transactions.hasMore || searchLoading}
                        loading={searchLoading && detail.transactions.hasMore}
                        onClick={() => handleAccountPageChange('next')}
                    >
                        下一页
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <div className={styles.dashboardContainer}>
            {/* 顶部标题栏 */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    {/* <div className={styles.heroBadge}>
                        <BlockOutlined /> 链上态势可视化大屏
                    </div> */}
                    <Title level={2} className={styles.title}>
                        <span className={styles.titleLogo}>
                            <Image src="/whitelogo.png" alt="平台 Logo" width={180} height={55} priority />
                        </span>
                        链计算业务数据大屏
                    </Title>
                    {/* <Text className={styles.subtitle}>实时展示链上链下关键指标、拓扑态势与激励状态</Text> */}
                </div>
                <div className={styles.headerRight}>
                    <div className={styles.refreshControls}>
                        <Button
                            type={autoRefresh ? 'primary' : 'default'}
                            onClick={() => setAutoRefresh((prev) => !prev)}
                        >
                            {autoRefresh ? '自动刷新：开启' : '自动刷新：关闭'}
                        </Button>
                        <Button
                            onClick={() => loadDashboardData()}
                            loading={loading}
                        >
                            手动刷新
                        </Button>
                    </div>
                    <div className={styles.timeBadge}>
                        <ClockCircleOutlined style={{ color: '#00e5ff' }} />
                        <Text className={styles.timeText}>{isHydrated ? formatTime(currentTime) : '-- -- --'}</Text>
                    </div>
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
                                valueStyle={{ color: '#ff7875', fontSize: '14px' }}
                            />
                            <Statistic
                                title="在线节点"
                                value={dashboardData?.workers.online || 0}
                                prefix={<GlobalOutlined />}
                                valueStyle={{ color: '#52c41a', fontSize: '14px' }}
                            />
                            <Statistic
                                title="离线"
                                value={workerMonitorData?.summary?.offline || 0}
                                valueStyle={{ color: '#69c0ff', fontSize: '14px' }}
                            />
                            <Statistic
                                title="无响应"
                                value={workerMonitorData?.summary?.unresponsive || 0}
                                valueStyle={{ color: '#ffd666', fontSize: '14px' }}
                            />
                        </div>
                        {workerTableData.length > 0 && (
                            <div className={`${styles.tableContainer} ${styles.workerTable}`}>
                                <Table
                                    dataSource={workerTableData}
                                    columns={workerColumns}
                                    rowKey={(record: any) =>
                                        record?.id
                                        || record?.publicKey
                                        || record?.workerId
                                        || record?.endpoint
                                        || record?.name
                                        || record?.key
                                        || record?.address
                                        || record?.hash
                                        || `worker-${record?.teeType || 'unknown'}-${record?.lastHeartbeat || '0'}`
                                    }
                                    pagination={false}
                                    size="small"
                                    className={`${styles.table} ${styles.compactTable}`}
                                    rowClassName={compactRowClass}
                                />
                                {shouldPaginateWorkers && (
                                    <div className={styles.tablePagination}>
                                        <Button
                                            size="small"
                                            type="primary"
                                            className={styles.paginationButton}
                                            disabled={workerPage === 1}
                                            onClick={() => setWorkerPage((prev) => Math.max(1, prev - 1))}
                                        >
                                            上一页
                                        </Button>
                                        <span>第 {workerPage} / {workerTotalPages} 页</span>
                                        <Button
                                            size="small"
                                            type="primary"
                                            className={styles.paginationButton}
                                            disabled={workerPage === workerTotalPages}
                                            onClick={() => setWorkerPage((prev) => Math.min(workerTotalPages, prev + 1))}
                                        >
                                            下一页
                                        </Button>
                                    </div>
                                )}
                                {workerCount === 1 && (
                                    <div className={styles.workerNotice}>
                                        当前仅有 1 个 Worker 在线，更多节点正在接入...
                                    </div>
                                )}
                            </div>
                        )}
                    </DataCard>

                    {/* 激励数据 */}
                    <DataCard
                        title="用户激励数据"
                        titleIcon={<TrophyOutlined />}
                        className={styles.dataCard}
                    >
                        <div className={styles.statRow}>
                            <Statistic
                                title="总激励金额"
                                value={incentiveData?.totalAmount || 0}
                                precision={2}
                                suffix="CMC"
                                valueStyle={{ color: '#ff7875', fontSize: '14px' }}
                            />
                            <Statistic
                                title="平均评分"
                                value={incentiveAverageScore}
                                precision={2}
                                valueStyle={{ color: '#69c0ff', fontSize: '14px' }}
                            />
                        </div>

                        <div className={styles.sectionHeader}>
                            <div>
                                <div className={styles.sectionTitle}>账户列表</div>
                                <div className={styles.sectionSubtitle}>已连接 {totalIncentiveAccounts} 个账户</div>
                            </div>
                            {totalRewardFormatted && (
                                <Tag color="processing" style={{ borderRadius: 999, padding: '0 12px', height: 24, lineHeight: '22px' }}>
                                    {totalRewardFormatted} CMC
                                </Tag>
                            )}
                        </div>

                        {displayedIncentiveAccounts.length > 0 ? (
                            <div className={styles.accountList}>
                                {displayedIncentiveAccounts.map((account) => (
                                    <div key={account.address} className={styles.accountItem}>
                                        <div className={styles.accountHeader}>
                                            <Tooltip title={account.address}>
                                                <span>{truncateMiddle(account.address, 8, 6)}</span>
                                            </Tooltip>
                                            <Tag
                                                color={
                                                    account.state === 'Ready' || account.state === 'WorkerIdle'
                                                        ? 'success'
                                                        : account.state === 'WorkerUnresponsive'
                                                            ? 'error'
                                                            : 'default'
                                                }
                                                style={{ margin: 0 }}
                                            >
                                                {account.state || '未知'}
                                            </Tag>
                                        </div>
                                        <div className={styles.accountMeta}>
                                            <div>
                                                <span className={styles.accountLabel}>余额</span>
                                                <span className={styles.accountValue}>{account.balanceFormatted} CMC</span>
                                            </div>
                                            <div>
                                                <span className={styles.accountLabel}>累计奖励</span>
                                                <span className={styles.accountValue}>{account.totalRewardFormatted} CMC</span>
                                            </div>
                                        </div>
                                        <div className={styles.accountMeta}>
                                            <div>
                                                <span className={styles.accountLabel}>VE</span>
                                                <span className={styles.accountValue}>{account.ve || '--'}</span>
                                            </div>
                                            <div>
                                                <span className={styles.accountLabel}>评分</span>
                                                <span className={styles.accountValue}>{account.benchmarkScore || '--'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.emptyBox}>
                                <Empty description={<span style={{ color: '#fff' }}>暂无账户数据</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            </div>
                        )}
                        {shouldPaginateAccounts && (
                            <div className={styles.accountPagination}>
                                <Button
                                    size="small"
                                    ghost
                                    disabled={incentiveAccountPage === 1}
                                    onClick={() => setIncentiveAccountPage((prev) => Math.max(1, prev - 1))}
                                >
                                    上一页
                                </Button>
                                <span>第 {incentiveAccountPage} / {incentiveAccountTotalPages} 页</span>
                                <Button
                                    size="small"
                                    type="primary"
                                    disabled={incentiveAccountPage === incentiveAccountTotalPages}
                                    onClick={() => setIncentiveAccountPage((prev) => Math.min(incentiveAccountTotalPages, prev + 1))}
                                >
                                    下一页
                                </Button>
                            </div>
                        )}
                    </DataCard>

                    <DataCard
                        title="TEE可信验证"
                        titleIcon={<GlobalOutlined />}
                        className={styles.dataCard}
                    >
                        <div className={styles.snapshotGrid}>
                            {['SGX', 'CSV'].map((type) => {
                                const tee = dashboardData?.workers?.byTeeType?.[type as 'SGX' | 'CSV'];
                                const total = tee?.total || 0;
                                const online = tee?.online || 0;
                                const ratio = total ? Math.round((online / total) * 100) : 0;
                                return (
                                    <div key={type} className={styles.snapshotCard}>
                                        <span className={styles.snapshotLabel}>{type} Worker</span>
                                        <span className={styles.snapshotValue}>
                                            {online}/{total}
                                        </span>
                                        <span className={styles.snapshotDesc}>在线率 {ratio || '--'}%</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className={styles.snapshotProgress}>
                            {['SGX', 'CSV'].map((type) => {
                                const tee = dashboardData?.workers?.byTeeType?.[type as 'SGX' | 'CSV'];
                                const total = tee?.total || 0;
                                const online = tee?.online || 0;
                                const ratio = total ? Math.round((online / total) * 100) : 0;
                                return (
                                    <div key={type} className={styles.progressItem}>
                                        <div className={styles.progressLabelRow}>
                                            <span>{type} 在线率</span>
                                            <span>{ratio || '--'}%</span>
                                        </div>
                                        <div className={styles.progressTrack}>
                                            <div className={styles.progressFill} style={{ width: `${ratio}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </DataCard>
                </div>

                {/* 中间主区域 */}
                <div className={styles.centerColumn}>
                    {/* 区块浏览器（含核心指标） */}
                    <DataCard
                        title="区块链上数据"
                        titleIcon={<TransactionOutlined />}
                        className={styles.dataCard}
                    >
                        {/* 第一行：核心指标 */}
                        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                            <Col span={6}>
                                <div className={styles.statisticBox}>
                                    <Statistic
                                        title="区块高度"
                                        value={dashboardData?.blockchain.blockNumber || 0}
                                        prefix={<BlockOutlined />}
                                        valueStyle={{ color: '#00e5ff', fontSize: '20px' }}
                                    />
                                </div>
                            </Col>
                            <Col span={6}>
                                <div className={styles.statisticBox}>
                                    <Statistic
                                        title="出块间隔"
                                        value={dashboardData?.blockchain.avgBlockTime || 0}
                                        precision={2}
                                        suffix="秒"
                                        valueStyle={{ color: '#faad14', fontSize: '20px' }}
                                    />
                                </div>
                            </Col>
                            <Col span={6}>
                                <div className={styles.statisticBox}>
                                    <Statistic
                                        title="系统健康度"
                                        value={dashboardData?.system.health || 100}
                                        suffix="%"
                                        valueStyle={{ color: '#52c41a', fontSize: '20px' }}
                                    />
                                </div>
                            </Col>
                            <Col span={6}>
                                <div className={styles.statisticBox}>
                                    <Statistic
                                        title="共识节点"
                                        value={dashboardData?.blockchain.consensusNodes || 0}
                                        valueStyle={{ color: '#1890ff', fontSize: '20px' }}
                                    />
                                </div>
                            </Col>
                        </Row>

                        <div className={styles.explorerToolbar}>
                            <div className={styles.viewSwitch}>
                                {explorerTabs.map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        className={`${styles.viewSwitchButton} ${explorerView === tab.key ? styles.viewSwitchButtonActive : ''}`}
                                        onClick={() => handleExplorerViewChange(tab.key)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <div className={styles.searchConsole}>
                                <Select
                                    value={searchType}
                                    className={styles.searchSelect}
                                    options={searchOptions}
                                    onChange={(value: ExplorerSearchType) => {
                                        setSearchType(value);
                                        setSearchError(null);
                                    }}
                                    popupMatchSelectWidth={false}
                                />
                                <div className={styles.searchInputGroup}>
                                    <div className={styles.searchInputWrapper}>
                                        <Input
                                            value={searchValue}
                                            onChange={(e) => {
                                                setSearchValue(e.target.value);
                                                if (searchError) {
                                                    setSearchError(null);
                                                }
                                            }}
                                            placeholder={searchPlaceholderMap[searchType]}
                                            className={styles.searchInput}
                                            allowClear
                                            variant="borderless"
                                            onPressEnter={() => handleSearch(1)}
                                        />
                                    </div>
                                    <Button
                                        type="primary"
                                        icon={<SearchOutlined />}
                                        className={styles.searchButton}
                                        loading={searchLoading}
                                        onClick={() => handleSearch(1)}
                                    >
                                        检索
                                    </Button>
                                </div>
                            </div>
                        </div>
                        {searchError && (
                            <div className={styles.searchError}>{searchError}</div>
                        )}

                        {shouldShowSearchResult && searchResult ? (
                            <div className={styles.singleTableWrapper}>
                                {searchResult.type === 'block' && renderBlockDetail(searchResult.data)}
                                {searchResult.type === 'transaction' && renderTransactionDetail(searchResult.data)}
                                {searchResult.type === 'account' && renderAccountDetail(searchResult.data)}
                            </div>
                        ) : explorerView === 'overview' ? (
                            <div className={styles.dualTables}>
                                {renderBlockPanel()}
                                {renderTransactionPanel()}
                            </div>
                        ) : (
                            <div className={styles.singleTableWrapper}>
                                {explorerView === 'blocks' ? renderBlockPanel('full') : renderTransactionPanel('full')}
                            </div>
                        )}
                    </DataCard>
                </div>

                {/* 右侧列 */}
                <div className={styles.rightColumn}>
                    {/* 密钥轮换 */}
                    <DataCard
                        title="密钥轮换数据"
                        titleIcon={<KeyOutlined />}
                        className={styles.dataCard}
                    >
                        <div className={styles.statRow3}>
                            <Statistic
                                title="总密钥数"
                                value={keyRotationData?.totalKeys || 0}
                                valueStyle={{ color: '#ff7875', fontSize: '14px' }}
                            />
                            <Statistic
                                title="活跃密钥"
                                value={keyRotationData?.activeKeys || 0}
                                valueStyle={{ color: '#52c41a', fontSize: '14px' }}
                            />
                            <Statistic
                                title="轮换中"
                                value={keyRotationData?.rotatingKeys || 0}
                                valueStyle={{ color: '#69c0ff', fontSize: '14px' }}
                            />
                        </div>

                        {keySamples.length > 0 && (
                            <>
                                <div className={styles.rotationKeyList}>
                                    {pagedKeySamples.map((key: any) => (
                                        <div key={key.id || key.keyId} className={styles.rotationKeyItem}>
                                            <div className={styles.rotationKeyHeader}>
                                                <Tooltip title={key.keyId}>
                                                    <span>{key.keyId || '--'}</span>
                                                </Tooltip>
                                                <Tag color={getKeyStatusColor(key.status)} style={{ margin: 0, minWidth: '70px', textAlign: 'center', display: 'inline-block' }}>
                                                    {key.keyType || 'SR25519'}
                                                </Tag>
                                            </div>
                                            <div className={styles.rotationKeyMeta}>
                                                <span>{truncateMiddle(key.owner, 8, 6)}</span>
                                                <span>消息 {key.pendingMessages ?? 0}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {keySamples.length > KEY_SAMPLE_PAGE_SIZE && (
                                    <div className={styles.rotationPagination}>
                                        <Button
                                            size="small"
                                            type="primary"
                                            className={styles.paginationButton}
                                            disabled={keySamplePage === 1}
                                            onClick={() => setKeySamplePage((prev) => Math.max(1, prev - 1))}
                                        >
                                            上一页
                                        </Button>
                                        <span>第 {keySamplePage} / {keySampleTotalPages} 页</span>
                                        <Button
                                            size="small"
                                            type="primary"
                                            className={styles.paginationButton}
                                            disabled={keySamplePage === keySampleTotalPages}
                                            onClick={() => setKeySamplePage((prev) => Math.min(keySampleTotalPages, prev + 1))}
                                        >
                                            下一页
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                        {recentRotations.length > 0 && (
                            <div className={styles.timelineList}>
                                {recentRotations.map((item) => (
                                    <div key={`${item.epoch}-${item.blockNumber}`} className={styles.timelineItem}>
                                        <div>
                                            <div className={styles.timelineTitle}>Epoch {item.epoch}</div>
                                            <div className={styles.timelineMeta}>区块 #{item.blockNumber}</div>
                                        </div>
                                        <Tag color={item.success ? 'success' : 'error'}>
                                            {item.success ? '完成' : '失败'}
                                        </Tag>
                                    </div>
                                ))}
                            </div>
                        )}
                    </DataCard>

                    {/* 服务调度 */}
                    <DataCard
                        title="安全调度数据"
                        titleIcon={<ThunderboltOutlined />}
                        className={styles.dataCard}
                    >
                        {<div className={styles.schedulingSummary}>
                            {schedulingHighlights.map((item) => (
                                <div key={item.label} className={styles.summaryItem}>
                                    <div className={styles.summaryLabel}>{item.label}</div>
                                    <div className={styles.summaryValue}>{item.value}</div>
                                    <div className={styles.summaryDesc}>{item.desc}</div>
                                </div>
                            ))}
                        </div>}
                        {/* <div className={styles.schedulingBody}>
                            { <div className={styles.schedulingChart}>
                                <div className={styles.insightTitle}>状态分布</div>
                                {hasSchedulingChartData ? (
                                    <ReactECharts
                                        option={schedulingChartOption}
                                        notMerge
                                        lazyUpdate
                                        style={{ height: 150 }}
                                    />
                                ) : (
                                    <div className={styles.emptyBox} style={{ minHeight: 150 }}>
                                        <Empty description={<span style={{ color: '#fff' }}>暂无调度数据</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                    </div>
                                )}
                            </div> }
                            { <div className={styles.schedulingInsights}>
                                <div className={styles.insightTitle}>调度洞察</div>
                                {serviceInsights.length > 0 ? (
                                    <div className={styles.serviceGrid}>
                                        {serviceInsights.map((item) => (
                                            <div key={item.label} className={styles.serviceTile}>
                                                <div className={styles.serviceLabel}>{item.label}</div>
                                                <div className={styles.serviceValue}>{item.value}</div>
                                                <div className={styles.serviceDesc}>{item.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={styles.emptyBox} style={{ minHeight: 120 }}>
                                        <Empty description={<span style={{ color: '#fff' }}>暂无调度洞察</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                    </div>
                                )}
                            </div> }
                        </div> */}
                    </DataCard>

                    {/* 合约数据 */}
                    <DataCard
                        title="智能合约数据"
                        titleIcon={<FileProtectOutlined />}
                        className={styles.dataCard}
                    >
                        <div className={styles.statRow}>
                            <Statistic
                                title="总合约数"
                                value={dashboardData?.contracts.total || 0}
                                valueStyle={{ color: '#ff7875', fontSize: '14px' }}
                            />
                            <Statistic
                                title="活跃合约"
                                value={dashboardData?.contracts.active || 0}
                                valueStyle={{ color: '#69c0ff', fontSize: '14px' }}
                            />
                        </div>
                        <div className={styles.tagContainer}>
                            {Object.entries(dashboardData?.contracts.byType || {}).map(([type, count]) => (
                                <Tag key={type} color="purple" style={{ marginBottom: 8 }}>
                                    {type}: {count as number}
                                </Tag>
                            ))}
                        </div>
                        {contractHighlights.length > 0 && (
                            <div className={styles.contractList}>
                                {contractHighlights.map((item) => (
                                    <div key={item.type} className={styles.contractItem}>
                                        <div className={styles.contractMetaRow}>
                                            <span className={styles.contractType}>{item.type}</span>
                                            <span className={styles.contractCount}>{item.count} 个</span>
                                        </div>
                                        <div className={styles.progressTrack}>
                                            <div className={styles.progressFill} style={{ width: `${item.ratio}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </DataCard>
                </div>
            </div>
        </div>
    );
}
