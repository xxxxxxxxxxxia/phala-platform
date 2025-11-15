// src/components/WorkerOfflineNotification.tsx
// Worker离线通知组件

import React, { useState, useEffect } from 'react';
import { notification, Alert, List, Badge, Button, Space, Typography, Card } from 'antd';
import {
    ExclamationCircleOutlined,
    CheckCircleOutlined,
    ReloadOutlined,
    DesktopOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface WorkerOfflineNotificationProps {
    autoRefresh?: boolean;
    refreshInterval?: number;
    showNotifications?: boolean;
}

interface WorkerInfo {
    publicKey: string;
    isOnline: boolean;
    lastHeartbeat: number;
    responseTime: number;
    consecutiveFailures: number;
}

interface OfflineNotificationState {
    workers: WorkerInfo[];
    onlineCount: number;
    offlineCount: number;
    totalCount: number;
    lastUpdate: number;
}

const WorkerOfflineNotification: React.FC<WorkerOfflineNotificationProps> = ({
    autoRefresh = true,
    refreshInterval = 15000,
    showNotifications = true
}) => {
    const [state, setState] = useState<OfflineNotificationState>({
        workers: [],
        onlineCount: 0,
        offlineCount: 0,
        totalCount: 0,
        lastUpdate: 0
    });
    const [loading, setLoading] = useState(false);
    const [previousOfflineWorkers, setPreviousOfflineWorkers] = useState<Set<string>>(new Set());

    // 获取worker状态
    const fetchWorkerStatus = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/connection-status?type=workers');
            const result = await response.json();

            if (result.success) {
                const workers = result.data.heartbeats || [];
                const onlineCount = result.data.onlineWorkers || 0;
                const offlineCount = result.data.offlineWorkers || 0;
                const totalCount = result.data.totalWorkers || 0;

                setState({
                    workers,
                    onlineCount,
                    offlineCount,
                    totalCount,
                    lastUpdate: Date.now()
                });

                // 检查离线worker变化并发送通知
                if (showNotifications) {
                    checkOfflineWorkers(workers);
                }
            }
        } catch (error) {
            console.error('获取worker状态失败:', error);
        } finally {
            setLoading(false);
        }
    };

    // 检查离线worker变化
    const checkOfflineWorkers = (workers: WorkerInfo[]) => {
        const currentOfflineWorkers = new Set(
            workers.filter(w => !w.isOnline).map(w => w.publicKey)
        );

        // 检查新离线的worker
        const newOfflineWorkers = Array.from(currentOfflineWorkers).filter(
            workerId => !previousOfflineWorkers.has(workerId)
        );

        // 检查重新上线的worker
        const reconnectedWorkers = Array.from(previousOfflineWorkers).filter(
            workerId => !currentOfflineWorkers.has(workerId)
        );

        // 发送通知
        if (newOfflineWorkers.length > 0) {
            showOfflineNotification(newOfflineWorkers);
        }

        if (reconnectedWorkers.length > 0) {
            showReconnectedNotification(reconnectedWorkers);
        }

        setPreviousOfflineWorkers(currentOfflineWorkers);
    };

    // 显示离线通知
    const showOfflineNotification = (workerIds: string[]) => {
        notification.error({
            message: 'Worker离线警告',
            description: `${workerIds.length}个Worker已离线: ${workerIds.map(id => id.substring(0, 8)).join(', ')}`,
            duration: 10,
            icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
            placement: 'topRight',
        });
    };

    // 显示重连通知
    const showReconnectedNotification = (workerIds: string[]) => {
        notification.success({
            message: 'Worker重连成功',
            description: `${workerIds.length}个Worker已重新上线: ${workerIds.map(id => id.substring(0, 8)).join(', ')}`,
            duration: 5,
            icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
            placement: 'topRight',
        });
    };

    // 格式化时间
    const formatTime = (timestamp: number): string => {
        if (!timestamp) return '未知';
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN');
    };

    // 获取worker状态颜色
    const getWorkerStatusColor = (isOnline: boolean): string => {
        return isOnline ? 'success' : 'error';
    };

    // 获取worker状态文本
    const getWorkerStatusText = (isOnline: boolean): string => {
        return isOnline ? '在线' : '离线';
    };

    useEffect(() => {
        fetchWorkerStatus();

        if (autoRefresh) {
            const interval = setInterval(fetchWorkerStatus, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, refreshInterval]);

    return (
        <div>
            {/* 状态概览 */}
            <Card size="small" style={{ marginBottom: 16 }}>
                <Row align="middle" justify="space-between">
                    <Col>
                        <Space>
                            <DesktopOutlined />
                            <Text strong>Worker状态监控</Text>
                            <Badge
                                count={state.offlineCount}
                                style={{ backgroundColor: state.offlineCount > 0 ? '#ff4d4f' : '#52c41a' }}
                            />
                            <Text type="secondary">
                                在线: {state.onlineCount} / 离线: {state.offlineCount} / 总计: {state.totalCount}
                            </Text>
                        </Space>
                    </Col>
                    <Col>
                        <Button
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={fetchWorkerStatus}
                            loading={loading}
                        >
                            刷新
                        </Button>
                    </Col>
                </Row>
            </Card>

            {/* 离线worker警告 */}
            {state.offlineCount > 0 && (
                <Alert
                    message="Worker离线警告"
                    description={`当前有 ${state.offlineCount} 个Worker处于离线状态，请检查网络连接和节点状态。`}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* Worker列表 */}
            {state.workers.length > 0 && (
                <Card title="Worker状态详情" size="small">
                    <List
                        dataSource={state.workers}
                        renderItem={(worker) => (
                            <List.Item>
                                <List.Item.Meta
                                    avatar={
                                        <Badge
                                            status={getWorkerStatusColor(worker.isOnline)}
                                            text={getWorkerStatusText(worker.isOnline)}
                                        />
                                    }
                                    title={
                                        <Space>
                                            <Text code>{worker.publicKey.substring(0, 16)}...</Text>
                                            {!worker.isOnline && (
                                                <Text type="danger">
                                                    (连续失败 {worker.consecutiveFailures} 次)
                                                </Text>
                                            )}
                                        </Space>
                                    }
                                    description={
                                        <Space direction="vertical" size="small">
                                            <Text type="secondary">
                                                最后心跳: {formatTime(worker.lastHeartbeat)}
                                            </Text>
                                            <Text type="secondary">
                                                响应时间: {worker.responseTime}ms
                                            </Text>
                                        </Space>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                </Card>
            )}

            {/* 最后更新时间 */}
            <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                    最后更新: {formatTime(state.lastUpdate)}
                </Text>
            </div>
        </div>
    );
};

export default WorkerOfflineNotification;
