// src/components/ConnectionStatus.tsx
// 连接状态组件

import React, { useState, useEffect } from 'react';
import { Badge, Alert, Button, Space, Typography, Card, Row, Col, Statistic } from 'antd';
import {
    WifiOutlined,
    DisconnectOutlined,
    ReloadOutlined,
    ExclamationCircleOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface ConnectionStatus {
    isConnected: boolean;
    lastConnected: number;
    lastDisconnected: number;
    connectionCount: number;
    errorCount: number;
    lastError: string | null;
}

interface WorkerStatus {
    onlineWorkers: number;
    offlineWorkers: number;
    totalWorkers: number;
}

interface ConnectionStatusProps {
    showDetails?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

const ConnectionStatusComponent: React.FC<ConnectionStatusProps> = ({
    showDetails = true,
    autoRefresh = true,
    refreshInterval = 5000
}) => {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
    const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<number>(0);

    // 获取连接状态
    const fetchConnectionStatus = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/connection-status?type=full');
            const result = await response.json();

            if (result.success) {
                setConnectionStatus(result.data.connection);
                setWorkerStatus(result.data.workers);
                setLastUpdate(Date.now());
            } else {
                setError(result.error || '获取连接状态失败');
            }
        } catch (err) {
            console.error('获取连接状态失败:', err);
            setError('网络请求失败');
        } finally {
            setLoading(false);
        }
    };

    // 强制重连
    const handleReconnect = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/connection-status?action=reconnect', {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                // 等待一下再刷新状态
                setTimeout(() => {
                    fetchConnectionStatus();
                }, 2000);
            } else {
                setError(result.error || '重连失败');
            }
        } catch (err) {
            console.error('重连失败:', err);
            setError('重连请求失败');
        } finally {
            setLoading(false);
        }
    };

    // 格式化时间
    const formatTime = (timestamp: number): string => {
        if (!timestamp) return '未知';
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN');
    };

    // 计算连接时长
    const getConnectionDuration = (): string => {
        if (!connectionStatus?.isConnected || !connectionStatus.lastConnected) {
            return '未连接';
        }
        const duration = Date.now() - connectionStatus.lastConnected;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${minutes}分${seconds}秒`;
    };

    // 获取状态颜色
    const getStatusColor = (): string => {
        if (!connectionStatus) return 'default';
        return connectionStatus.isConnected ? 'success' : 'error';
    };

    // 获取状态文本
    const getStatusText = (): string => {
        if (!connectionStatus) return '检查中...';
        return connectionStatus.isConnected ? '已连接' : '已断开';
    };

    // 获取状态图标
    const getStatusIcon = () => {
        if (!connectionStatus) return <ExclamationCircleOutlined />;
        return connectionStatus.isConnected ?
            <CheckCircleOutlined /> :
            <DisconnectOutlined />;
    };

    useEffect(() => {
        fetchConnectionStatus();

        if (autoRefresh) {
            const interval = setInterval(fetchConnectionStatus, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, refreshInterval]);

    return (
        <div>
            {/* 连接状态指示器 */}
            <Card size="small" style={{ marginBottom: 16 }}>
                <Row align="middle" justify="space-between">
                    <Col>
                        <Space>
                            <Badge
                                status={getStatusColor()}
                                text={
                                    <Space>
                                        {getStatusIcon()}
                                        <Text strong>{getStatusText()}</Text>
                                    </Space>
                                }
                            />
                            {connectionStatus?.isConnected && (
                                <Text type="secondary">
                                    连接时长: {getConnectionDuration()}
                                </Text>
                            )}
                        </Space>
                    </Col>
                    <Col>
                        <Space>
                            <Button
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={fetchConnectionStatus}
                                loading={loading}
                            >
                                刷新
                            </Button>
                            {!connectionStatus?.isConnected && (
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<WifiOutlined />}
                                    onClick={handleReconnect}
                                    loading={loading}
                                >
                                    重连
                                </Button>
                            )}
                        </Space>
                    </Col>
                </Row>
            </Card>

            {/* 错误提示 */}
            {error && (
                <Alert
                    message="连接状态获取失败"
                    description={error}
                    type="error"
                    showIcon
                    closable
                    onClose={() => setError(null)}
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* 详细状态信息 */}
            {showDetails && connectionStatus && (
                <Card title="连接详情" size="small">
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12} md={6}>
                            <Statistic
                                title="连接状态"
                                value={connectionStatus.isConnected ? '在线' : '离线'}
                                valueStyle={{
                                    color: connectionStatus.isConnected ? '#52c41a' : '#ff4d4f'
                                }}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Statistic
                                title="连接次数"
                                value={connectionStatus.connectionCount}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Statistic
                                title="错误次数"
                                value={connectionStatus.errorCount}
                                valueStyle={{
                                    color: connectionStatus.errorCount > 0 ? '#ff4d4f' : '#52c41a'
                                }}
                            />
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Statistic
                                title="最后连接"
                                value={formatTime(connectionStatus.lastConnected)}
                                valueStyle={{ fontSize: '12px' }}
                            />
                        </Col>
                    </Row>

                    {/* Worker状态 */}
                    {workerStatus && (
                        <div style={{ marginTop: 16 }}>
                            <Title level={5}>Worker状态</Title>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={8}>
                                    <Statistic
                                        title="在线Worker"
                                        value={workerStatus.onlineWorkers}
                                        valueStyle={{ color: '#52c41a' }}
                                    />
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Statistic
                                        title="离线Worker"
                                        value={workerStatus.offlineWorkers}
                                        valueStyle={{ color: '#ff4d4f' }}
                                    />
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Statistic
                                        title="总Worker数"
                                        value={workerStatus.totalWorkers}
                                    />
                                </Col>
                            </Row>
                        </div>
                    )}

                    {/* 最后更新时间 */}
                    <div style={{ marginTop: 16, textAlign: 'right' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                            最后更新: {formatTime(lastUpdate)}
                        </Text>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default ConnectionStatusComponent;
