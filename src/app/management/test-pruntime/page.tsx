'use client';

import React, { useState } from 'react';
import { Card, Button, Typography, Space, Alert, Spin, Descriptions, Tag } from 'antd';
import { ApiOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import MainLayout from '@/components/layout/MainLayout';
import AuthGuard from '@/components/AuthGuard';

const { Title, Text } = Typography;

interface PruntimeInfo {
    initialized: boolean;
    registered: boolean;
    public_key: string;
    ecdh_public_key: string;
    headernum: number;
    blocknum: number;
    version: string;
    dev_mode: boolean;
    pending_messages: number;
    score: number;
    memory_usage: {
        rust_used: number;
        rust_peak_used: number;
        total_peak_used: number;
        free: number;
    };
    live_sidevm_instances: number;
    system: {
        number_of_clusters: number;
        number_of_contracts: number;
    };
}

export default function TestPruntimePage() {
    const [loading, setLoading] = useState(false);
    const [pruntimeInfo, setPruntimeInfo] = useState<PruntimeInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<{
        getInfo: boolean;
        status: boolean;
        health: boolean;
    }>({
        getInfo: false,
        status: false,
        health: false
    });

    const testGetInfo = async () => {
        setLoading(true);
        setError(null);
        try {
            // 使用Next.js API代理，避免CORS问题
            const response = await fetch('/api/pruntime-proxy?endpoint=prpc/PhactoryAPI.GetInfo', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            setPruntimeInfo(data);
            setTestResults(prev => ({ ...prev, getInfo: true }));
            console.log('✅ GetInfo 测试成功:', data);
        } catch (err: any) {
            setError(`GetInfo 测试失败: ${err.message}`);
            setTestResults(prev => ({ ...prev, getInfo: false }));
            console.error('❌ GetInfo 测试失败:', err);
        } finally {
            setLoading(false);
        }
    };

    const testStatus = async () => {
        try {
            const response = await fetch('/api/pruntime-proxy?endpoint=status');
            if (response.ok) {
                setTestResults(prev => ({ ...prev, status: true }));
                console.log('✅ Status 测试成功');
            } else {
                setTestResults(prev => ({ ...prev, status: false }));
                console.log('❌ Status 测试失败');
            }
        } catch (err) {
            setTestResults(prev => ({ ...prev, status: false }));
            console.error('❌ Status 测试失败:', err);
        }
    };

    const testHealth = async () => {
        try {
            const response = await fetch('/api/pruntime-proxy?endpoint=health');
            if (response.ok) {
                setTestResults(prev => ({ ...prev, health: true }));
                console.log('✅ Health 测试成功');
            } else {
                setTestResults(prev => ({ ...prev, health: false }));
                console.log('❌ Health 测试失败');
            }
        } catch (err) {
            setTestResults(prev => ({ ...prev, health: false }));
            console.error('❌ Health 测试失败:', err);
        }
    };

    const runAllTests = async () => {
        setTestResults({ getInfo: false, status: false, health: false });
        await testGetInfo();
        await testStatus();
        await testHealth();
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <AuthGuard>
            <MainLayout>
                <Title level={2}>Pruntime 接口测试</Title>
                <Text type="secondary">
                    测试与 Pruntime 服务的连接和接口可用性
                </Text>

                <Card style={{ marginTop: 24 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <div>
                            <Text strong>测试目标: </Text>
                            <Text code>http://8.147.107.221:18000 (通过API代理)</Text>
                        </div>

                        <Space>
                            <Button
                                type="primary"
                                icon={<ApiOutlined />}
                                onClick={testGetInfo}
                                loading={loading}
                            >
                                测试 GetInfo 接口
                            </Button>
                            <Button onClick={testStatus}>
                                测试 Status 接口
                            </Button>
                            <Button onClick={testHealth}>
                                测试 Health 接口
                            </Button>
                            <Button onClick={runAllTests}>
                                运行所有测试
                            </Button>
                        </Space>

                        {/* 测试结果 */}
                        <div>
                            <Text strong>测试结果:</Text>
                            <div style={{ marginTop: 8 }}>
                                <Space>
                                    <Tag color={testResults.getInfo ? 'green' : 'red'}>
                                        GetInfo: {testResults.getInfo ? '✅ 成功' : '❌ 失败'}
                                    </Tag>
                                    <Tag color={testResults.status ? 'green' : 'red'}>
                                        Status: {testResults.status ? '✅ 成功' : '❌ 失败'}
                                    </Tag>
                                    <Tag color={testResults.health ? 'green' : 'red'}>
                                        Health: {testResults.health ? '✅ 成功' : '❌ 失败'}
                                    </Tag>
                                </Space>
                            </div>
                        </div>

                        {error && (
                            <Alert
                                message="测试错误"
                                description={error}
                                type="error"
                                showIcon
                            />
                        )}
                    </Space>
                </Card>

                {/* Pruntime 信息显示 */}
                {pruntimeInfo && (
                    <Card title="Pruntime 信息" style={{ marginTop: 24 }}>
                        <Descriptions column={2} bordered>
                            <Descriptions.Item label="初始化状态">
                                <Tag color={pruntimeInfo.initialized ? 'green' : 'red'}>
                                    {pruntimeInfo.initialized ? '已初始化' : '未初始化'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="注册状态">
                                <Tag color={pruntimeInfo.registered ? 'green' : 'red'}>
                                    {pruntimeInfo.registered ? '已注册' : '未注册'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="版本">
                                <Text code>{pruntimeInfo.version}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="开发模式">
                                <Tag color={pruntimeInfo.dev_mode ? 'orange' : 'blue'}>
                                    {pruntimeInfo.dev_mode ? '开发模式' : '生产模式'}
                                </Tag>
                            </Descriptions.Item>
                            <Descriptions.Item label="当前区块">
                                <Text strong>{pruntimeInfo.blocknum.toLocaleString()}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="待处理消息">
                                <Text>{pruntimeInfo.pending_messages}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="评分">
                                <Text>{pruntimeInfo.score}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="活跃 SideVM 实例">
                                <Text>{pruntimeInfo.live_sidevm_instances}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="集群数量">
                                <Text>{pruntimeInfo.system.number_of_clusters}</Text>
                            </Descriptions.Item>
                            <Descriptions.Item label="合约数量">
                                <Text>{pruntimeInfo.system.number_of_contracts}</Text>
                            </Descriptions.Item>
                        </Descriptions>

                        <Card title="内存使用情况" style={{ marginTop: 16 }}>
                            <Descriptions column={2} bordered>
                                <Descriptions.Item label="Rust 使用">
                                    {formatBytes(pruntimeInfo.memory_usage.rust_used)}
                                </Descriptions.Item>
                                <Descriptions.Item label="Rust 峰值">
                                    {formatBytes(pruntimeInfo.memory_usage.rust_peak_used)}
                                </Descriptions.Item>
                                <Descriptions.Item label="总峰值">
                                    {formatBytes(pruntimeInfo.memory_usage.total_peak_used)}
                                </Descriptions.Item>
                                <Descriptions.Item label="可用内存">
                                    {formatBytes(pruntimeInfo.memory_usage.free)}
                                </Descriptions.Item>
                            </Descriptions>
                        </Card>

                        <Card title="密钥信息" style={{ marginTop: 16 }}>
                            <Descriptions column={1} bordered>
                                <Descriptions.Item label="公钥">
                                    <Text code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                                        {pruntimeInfo.public_key}
                                    </Text>
                                </Descriptions.Item>
                                <Descriptions.Item label="ECDH 公钥">
                                    <Text code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                                        {pruntimeInfo.ecdh_public_key}
                                    </Text>
                                </Descriptions.Item>
                            </Descriptions>
                        </Card>
                    </Card>
                )}
            </MainLayout>
        </AuthGuard>
    );
}
