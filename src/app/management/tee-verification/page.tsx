// pages/proof.tsx  (或 app/proof/page.tsx  如果用的 App Router)
"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import AuthGuard from "@/components/AuthGuard";
import DataCard from "@/components/DataCard";
import LineByLinePre from "@/app/management/tee-verification/LineByLinePre";
import CharByCharPre from "@/app/management/tee-verification/CharByCharPre";
import { Row, Col, Button, List, Card, Space, Spin, Steps, message, Typography, Skeleton, Tag } from "antd";
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    MinusCircleOutlined,
    SyncOutlined,
    SearchOutlined, // 新增查询图标
} from '@ant-design/icons';
import styles from '@/app/page.module.css';
import axios from "axios";
import { getTeeApiUrl } from '@/lib/config';

// 使用API代理来避免CORS问题
const API_BASE_URL = '/api/tee-verification';
const { Step } = Steps;

// 定义所有可能的状态类型，以避免 TS7006 错误
type VmStatus = 'stopped' | 'running' | 'starting' | 'stopping' | 'failed' | 'idle';
type AttestationStatus = 'idle' | 'generating' | 'generated' | 'failed' | 'verifying' | 'success' | 'failure';
type NotificationType = 'success' | 'error' | 'info';

// 定义 VM 参数的数据结构
interface VmParam {
    title: string;
    content: string;
    isLarge?: boolean; // 用于标记内容较多的参数，例如 Kernel
}

/**
 * 状态映射到颜色和文本
 */
const getStatusProps = (status: VmStatus | AttestationStatus) => {
    switch (status) {
        case 'starting':
        case 'stopping':
        case 'generating':
        case 'verifying':
            return { text: '进行中...', color: 'processing', icon: <SyncOutlined spin /> }; // blue-500
        case 'running':
        case 'generated':
        case 'success':
            return { text: '运行', color: 'success', icon: <CheckCircleOutlined /> };
        case 'stopped':
        case 'idle':
            return { text: '待机', color: 'default', icon: <MinusCircleOutlined /> };
        case 'failed':
        case 'failure':
            return { text: '失败', color: 'error', icon: <CloseCircleOutlined /> };
        default:
            // 确保所有可能的字符串都已被处理，如果传入其他值则返回默认
            return { text: '未知', color: 'warning', icon: <ExclamationCircleOutlined /> };
    }
};

// 移除旧的静态 data 数组

export default function RemoteAttestation() {
    // 用于科普内容的样式
    const infoTextStyle: React.CSSProperties = {
        color: '#ccc',
        fontSize: '15px',
        lineHeight: '1.8',
    };

    // 优化：合并相关状态，减少重渲染
    const [current, setCurrent] = useState(0); // 0: 生成  1: 验证
    const [loading, setLoading] = useState({ gen: false, verify: false });
    const [status, setStatus] = useState({ gen: null as boolean | null, verify: null as boolean | null });
    const [content, setContent] = useState({ generated: null as string | null, verify: null as string | null, qemu: null as string | null });

    // 优化：使用useCallback缓存函数
    const sleep = useCallback((t: number) => new Promise((r) => setTimeout(r, t)), []);

    const handleGenerate = useCallback(async () => {
        setLoading(prev => ({ ...prev, gen: true }));
        await sleep(1500);
        setStatus(prev => ({ ...prev, gen: true }));
        setCurrent(1);
        setLoading(prev => ({ ...prev, gen: false }));
    }, [sleep]);

    const handleVerify = useCallback(async () => {
        setLoading(prev => ({ ...prev, verify: true }));
        await sleep(1500);
        setStatus(prev => ({ ...prev, verify: false })); // 故意失败，与截图保持一致
        setLoading(prev => ({ ...prev, verify: false }));
    }, [sleep]);

    // 远程认证

    // VM 状态: stopped, running, starting, stopping, failed
    const [vmStatus, setVmStatus] = useState<VmStatus>('stopped');
    // 认证状态: idle, generating, generated, failed
    const [generateStatus, setGenerateStatus] = useState<AttestationStatus>('idle');
    // 验证状态: idle, verifying, success, failure
    const [verifyStatus, setVerifyStatus] = useState<AttestationStatus>('idle');
    const [notification, setNotification] = useState<{ message: string, type: NotificationType } | null>(null);

    // ********* 关键修改：新增 VM 参数查询状态 *********
    const [vmParams, setVmParams] = useState<VmParam[] | null>(null);
    const [vmParamsLoading, setVmParamsLoading] = useState(false);
    // *************************************************

    // 重置认证步骤，并在一段时间后自动清除通知 - 使用useCallback优化
    const showNotification = useCallback((message: string, type: NotificationType) => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    }, []);

    // 检查虚拟机状态的函数
    const checkVmStatus = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}?endpoint=vm/status`);
            const vmInfo = response.data.vm_info;
            if (vmInfo && vmInfo.status) {
                setVmStatus(vmInfo.status === 'running' ? 'running' : 'stopped');
            }
        } catch (error) {
            console.error('检查虚拟机状态失败:', error);
            // 如果检查失败，保持当前状态
        }
    }, []);

    // 页面加载时检查虚拟机状态
    useEffect(() => {
        checkVmStatus();
    }, [checkVmStatus]);

    // 重置认证步骤
    const resetAttestation = useCallback(() => {
        setGenerateStatus('idle');
        setVerifyStatus('idle');
    }, []);

    /**
     * 处理启动 CSV 虚拟机的请求。
     */
    const handleStartVm = useCallback(async () => {
        setVmStatus('starting');
        setNotification(null);
        setContent(prev => ({ ...prev, qemu: null })); // 启动前清除上次的输出
        try {
            const response = await axios.post(`${API_BASE_URL}?endpoint=vm/start`);
            showNotification(response.data.message || '虚拟机启动成功。', 'success');
            setVmStatus('running');
            resetAttestation(); // 虚拟机重启后，认证报告需要重新生成
            setVmParams(null); // 启动后清除参数，等待用户重新查询

            // ********* 关键修改：接收并保存 QEMU 输出 *********
            if (response.data.qemuOutput) {
                setContent(prev => ({ ...prev, qemu: response.data.qemuOutput }));
            }
            // *************************************************

        } catch (error) {
            const errorMessage = (error as any).response?.data?.message || '启动虚拟机失败，请检查网络或配置。';
            showNotification(errorMessage, 'error');
            setVmStatus('failed');
            console.error('Start VM Error:', error);

            // ********* 错误时也尝试保存 QEMU 输出 (如果存在) *********
            if ((error as any).response?.data?.qemuOutput) {
                setContent(prev => ({ ...prev, qemu: (error as any).response.data.qemuOutput }));
            }
            // *************************************************
        }
    }, [showNotification, resetAttestation]);

    /**
     * 处理关闭 CSV 虚拟机的请求。
     */
    const handleStopVm = useCallback(async () => {
        setVmStatus('stopping');
        setNotification(null);
        setContent(prev => ({ ...prev, generated: null, verify: null }));
        try {
            const response = await axios.post(`${API_BASE_URL}?endpoint=vm/stop`);
            showNotification(response.data.message || '虚拟机关闭成功。', 'success');
            setVmStatus('stopped');
            setContent(prev => ({ ...prev, qemu: null })); // 关闭后清除输出
            setVmParams(null); // 关闭后清除参数
            resetAttestation(); // 虚拟机关闭后，认证报告需要重新生成
        } catch (error) {
            const errorMessage = (error as any).response?.data?.message || '关闭虚拟机失败，请检查网络或配置。';
            showNotification(errorMessage, 'error');
            setVmStatus('failed');
            console.error('Stop VM Error:', error);
        }
    }, [showNotification, resetAttestation]);

    /**
     * 处理生成和传输认证报告的请求。
     */
    const handleGenerateReport = async () => {
        setGenerateStatus('generating');
        setNotification(null);
        setContent(prev => ({ ...prev, generated: null, verify: null })); // 清除之前的内容
        if (vmStatus !== 'running') {
            showNotification('请先启动虚拟机才能生成认证报告。', 'error');
            setGenerateStatus('idle'); // 重置为待机
            return;
        }

        try {
            const response = await axios.post(`${API_BASE_URL}?endpoint=attestation/generate`);
            console.log(response.data);
            showNotification(response.data.message || '认证报告生成并传输成功。', 'success');
            setGenerateStatus('generated');

            // 保存返回的内容以便显示
            if (response.data.content) {
                setContent(prev => ({ ...prev, generated: response.data.content }));
            }
        } catch (error) {
            const errorMessage = (error as any).response?.data?.message || '生成报告失败。';
            showNotification(errorMessage, 'error');
            setGenerateStatus('failed');
            console.error('Generate Report Error:', error);
        }
        console.log(content.verify);
    };

    /**
     * 处理验证认证报告的请求。
     */
    const handleVerifyReport = async () => {
        setVerifyStatus('verifying');
        setNotification(null);
        setContent(prev => ({ ...prev, verify: null }));
        try {
            const response = await axios.post(`${API_BASE_URL}?endpoint=attestation/verify`);
            console.log(response.data);
            if (response.data.message.includes('成功')) {
                showNotification(response.data.message, 'success');
                setVerifyStatus('success');
            } else {
                showNotification(response.data.message, 'error');
                setVerifyStatus('failure');
            }
            // 保存返回的内容以便显示
            if (response.data.content) {
                setContent(prev => ({ ...prev, verify: response.data.content }));
            }
        } catch (error) {
            const errorMessage = (error as any).response?.data?.message || '验证报告失败。';
            showNotification(errorMessage, 'error');
            setVerifyStatus('failure');
            console.error('Verify Report Error:', error);
        }
    };

    /**
     * 处理下载认证报告和 Nonce 文件的请求。
     */
    const handleDownloadReport = async (filename: string) => {
        setNotification(null);
        if (generateStatus !== 'generated') {
            showNotification('请先成功生成认证报告才能下载。', 'error');
            return;
        }

        showNotification(`正在下载 ${filename} ...`, 'info');

        try {
            // 使用 { responseType: 'blob' } 来处理文件下载，将响应体作为 Blob 对象处理
            const response = await axios.get(`${API_BASE_URL}?endpoint=attestation/download&filename=${filename}`, { responseType: 'blob' });

            // 创建一个临时的 URL 来触发下载
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename); // 设置文件名
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url); // 释放 Blob URL

            showNotification(`${filename} 下载成功。`, 'success');
        } catch (error) {
            const errorMessage = (error as any).response?.data?.message || `下载 ${filename} 失败，请检查后端日志。`;
            showNotification(errorMessage, 'error');
            console.error(`Download ${filename} Error:`, error);
        }
    };

    // ********* 关键修改：新增查询 VM 参数的函数 *********
    const handleQueryVmParams = async () => {
        setVmParamsLoading(true);
        setNotification(null);
        setVmParams(null); // 查询前清空

        if (vmStatus !== 'running') {
            showNotification('请先启动虚拟机才能查询内部参数。', 'error');
            setVmParamsLoading(false);
            return;
        }

        try {
            const response = await axios.get(`${API_BASE_URL}?endpoint=vm/params`);
            const data = response.data;
            showNotification(data.message || '成功获取虚拟机参数。', 'success');

            // 根据后端返回的数据结构，构建前端需要的 VmParam 数组
            // 从 lscpu 提取关键信息
            const lscpuLines = data.lscpu.split('\n');
            const getLscpuValue = (label: string) => {
                const line = lscpuLines.find((l: string) => l.startsWith(label));
                return line ? line.split(':')[1].trim() : 'N/A';
            };

            // 从 meminfo/free -h 提取关键信息
            const memLines = data.meminfo.split('\n');
            const totalMemory = memLines[1]?.split(/\s+/)[1] || 'N/A'; // Mem: 行的第二个值

            // 从 cpuinfo 提取关键信息
            const cpuInfoLines = data.cpuinfo.split('\n');
            const getCpuInfoValue = (label: string) => {
                const line = cpuInfoLines.find((l: string) => l.startsWith(label));
                return line ? line.split(':')[1].trim() : 'N/A';
            };

            const newVmParams: VmParam[] = [
                { title: '架构', content: getLscpuValue('Architecture:') },
                { title: 'CPU 厂商', content: getLscpuValue('Vendor ID:') },
                { title: 'CPU 型号', content: getLscpuValue('Model name:') },

                { title: 'CPU 核心/线程', content: `${getLscpuValue('Core(s) per socket:')} / ${getLscpuValue('Thread(s) per core:')}` },
                { title: '主频 (MHz)', content: getLscpuValue('CPU MHz:') },
                { title: '虚拟化', content: getLscpuValue('Virtualization:') },

                { title: '总内存', content: totalMemory },
                { title: '操作系统', content: getLscpuValue('CPU op-mode(s):') },
                { title: '内核信息', content: data.uname, isLarge: true },
            ];

            setVmParams(newVmParams);

        } catch (error) {
            const errorMessage = (error as any).response?.data?.message || '查询虚拟机参数失败，请检查虚拟机是否运行。';
            showNotification(errorMessage, 'error');
            console.error('Query VM Params Error:', error);
            setVmParams([]); // 查询失败，显示空列表
        } finally {
            setVmParamsLoading(false);
        }
    };
    // *************************************************

    return (
        <AuthGuard>
            <MainLayout>
                <style jsx>{`
        :global(.ant-btn:disabled) {
          opacity: 0.7;
          color: rgba(255, 255, 255, 0.6) !important;
        }
      `}</style>
                {/* 顶部通知栏，保持不变 */}
                {notification && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 20,
                            right: 20,
                            zIndex: 1000,
                            padding: '10px 20px',
                            borderRadius: '8px',
                            backgroundColor: notification.type === 'success' ? '#52c41a' :
                                notification.type === 'error' ? '#ff4d4f' :
                                    '#1890ff',
                            color: 'white',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                        }}
                    >
                        {notification.message}
                    </div>
                )}

                <Row gutter={[24, 24]} className={styles.gridContainer}>
                    <Col xs={24} lg={10}>
                        <DataCard title="虚拟机生命周期">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <p style={infoTextStyle}>
                                    远程启动或关闭名为 <strong className="text-indigo-600">csv-vm</strong> 的虚拟机。
                                </p>
                                <Tag
                                    icon={getStatusProps(vmStatus).icon}
                                    color={getStatusProps(vmStatus).color}
                                >
                                    状态: {getStatusProps(vmStatus).text}
                                </Tag>
                            </div>

                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', flex: 1, minWidth: '200px' }}>
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        <Button
                                            block
                                            type="primary"
                                            onClick={handleStartVm}
                                            disabled={vmStatus === 'starting' || vmStatus === 'running'}
                                            className={`w-full py-2 px-4 rounded-xl font-semibold transition duration-200 shadow-md ${vmStatus === 'starting'
                                                ? 'bg-blue-300 text-white cursor-not-allowed'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-400'
                                                }`}
                                        >
                                            {vmStatus === 'starting' ? '正在启动...' : '启动 CSV 虚拟机'}
                                        </Button>
                                    </Space>
                                </div>
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', flex: 1, minWidth: '200px' }}>
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        <Button
                                            block
                                            type="primary"
                                            onClick={handleStopVm}
                                            disabled={vmStatus === 'stopping' || vmStatus === 'stopped'}
                                            className={`w-full py-2 px-4 rounded-xl font-semibold transition duration-200 shadow-md ${vmStatus === 'stopping'
                                                ? 'bg-red-300 text-white cursor-not-allowed'
                                                : 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:bg-gray-400'
                                                }`}
                                        >
                                            {vmStatus === 'stopping' ? '正在关闭...' : '关闭 CSV 虚拟机'}
                                        </Button>
                                    </Space>
                                </div>
                            </div>

                            {/* QEMU 启动命令输出显示，保持不变 */}
                            <div className="mt-4 p-4 bg-gray-900 rounded-xl border border-purple-500/30 shadow-lg backdrop-blur-sm">
                                <Typography.Title level={5} style={{ marginTop: 0, color: '#ffffff' }}></Typography.Title>
                                {content.qemu ? (
                                    <div style={{ color: '#ffffff' }}>
                                        <LineByLinePre text={content.qemu} delay={200} />
                                    </div>
                                ) : (
                                    <div className="py-10" style={{ color: '#ffffff' }}>
                                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                            <Typography.Text type="secondary" style={{ fontSize: '16px' }}>
                                                {vmStatus === 'starting' ? '启动日志待输出...' : '点击上方按钮启动虚拟机...'}
                                            </Typography.Text>
                                        </div>
                                        {/* 骨架条，5 行即可，高度和真实代码块接近 */}
                                        <Skeleton active paragraph={{ rows: 11 }} />
                                    </div>
                                )}
                            </div>

                        </DataCard>
                    </Col>
                    <Col xs={24} lg={14}>
                        <DataCard title="虚拟机内部参数查询">
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', marginBottom: 8 }}>
                                <p style={infoTextStyle}>
                                    在虚拟机内部查询其系统参数，仅在虚拟机 <strong className="text-indigo-600">运行时</strong> 可用。
                                </p>
                                <Button
                                    style={{ width: '100%', marginTop: 0 }}
                                    type="primary"
                                    icon={<SearchOutlined />}
                                    onClick={handleQueryVmParams}
                                    loading={vmParamsLoading}
                                    disabled={vmStatus !== 'running'}
                                    className={`py-2 px-4 rounded-xl font-semibold transition duration-200 shadow-md ${vmStatus !== 'running'
                                        ? 'bg-gray-400 text-white cursor-not-allowed'
                                        : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
                                        }`}
                                >
                                    {vmParamsLoading ? '查询中...' : '查询参数'}
                                </Button>
                            </div>

                            {/* 修改后的骨架屏显示逻辑 */}
                            {vmParams === null && !vmParamsLoading ? (
                                <div className="py-6">
                                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                        <Typography.Text type="secondary" style={{ fontSize: '16px' }}>
                                            点击上方按钮查询...
                                        </Typography.Text>
                                    </div>
                                    {/* 与启动日志相同的骨架屏样式 */}
                                    <Skeleton active paragraph={{ rows: 11 }} />
                                </div>
                            ) : vmParamsLoading ? (
                                <div className="py-6">
                                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                        <Typography.Text type="secondary" style={{ fontSize: '16px' }}>
                                            正在查询参数...
                                        </Typography.Text>
                                    </div>
                                    <Skeleton active paragraph={{ rows: 11 }} />
                                </div>
                            ) : vmParams?.length === 0 ? (
                                <div className="text-center py-6 text-gray-500">
                                    查询失败或虚拟机未运行。
                                </div>
                            ) : (
                                <List
                                    grid={{ gutter: 16, column: 3 }}
                                    dataSource={vmParams ?? undefined}
                                    renderItem={(item) => (
                                        <List.Item>
                                            <Card
                                                title={item.title}
                                                size="small"
                                                className="h-full"
                                                headStyle={{
                                                    backgroundColor: '#1f2937',
                                                    borderBottom: '1px solid #374151',
                                                    fontWeight: 'bold',
                                                    textAlign: 'center',
                                                    color: '#ffffff',
                                                }}
                                                bodyStyle={{
                                                    padding: 0,               /* 去掉默认 padding，交给内部容器 */
                                                    height: '100%',           /* 让 body 撑满卡片剩余高度 */
                                                }}
                                            >
                                                {/* 居中容器 */}
                                                <div
                                                    style={{
                                                        height: 122 - 45,       /* 122 是卡片最小高度，45 是标题栏大概高度 */
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        textAlign: 'center',
                                                        padding: '0 12px',      /* 保留一点左右间距，防止贴边 */
                                                    }}
                                                >
                                                    {item.isLarge ? (
                                                        <Typography.Paragraph copyable style={{ margin: 0, color: '#ffffff' }}>
                                                            {item.content}
                                                        </Typography.Paragraph>
                                                    ) : (
                                                        <span className="font-mono text-sm" style={{ color: '#ffffff' }}>
                                                            {item.content}
                                                        </span>
                                                    )}
                                                </div>
                                            </Card>
                                        </List.Item>
                                    )}
                                />
                            )}
                        </DataCard>
                    </Col>

                    <Col xs={24} lg={10}>
                        <DataCard title="生成认证报告" titleIcon={<span>1</span>}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <p style={infoTextStyle}>在虚拟机内部执行命令，仅在虚拟机 <strong className="text-indigo-600">运行时</strong> 可用。</p>
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        <Button
                                            type="primary"
                                            onClick={handleGenerateReport}
                                            disabled={generateStatus === 'generating' || vmStatus !== 'running'}
                                            className={`w-full py-2 px-4 rounded-xl font-semibold transition duration-200 shadow-md ${generateStatus === 'generating'
                                                ? 'bg-blue-300 text-white cursor-not-allowed'
                                                : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800 disabled:bg-gray-400'
                                                }`}
                                        >
                                            {generateStatus === 'generating' ? '正在生成/传输...' : '生成并传输认证报告'}
                                        </Button>
                                        {/* {generateStatus === 'generating' && <Alert message="正在生成并传输报告..." type="info" showIcon style={{ width: '100%' }} />}
                            {generateStatus === 'generated' && <Alert message="认证报告生成并传输成功！" type="success" showIcon style={{ width: '100%' }} />}
                            {generateStatus === 'failed' && <Alert message="生成或传输报告失败！" type="error" showIcon style={{ width: '100%' }} />} */}
                                    </Space>
                                </div>
                            </div>

                            {/* 显示生成的内容 */}
                            <div className="mt-4 p-4 bg-gray-900 rounded-xl border border-purple-500/30 shadow-lg backdrop-blur-sm">
                                {content.generated ? (
                                    <div style={{ color: '#ffffff' }}>
                                        <LineByLinePre text={content.generated} delay={400} />
                                    </div>
                                ) : (
                                    <div className="py-10" style={{ color: '#ffffff' }}>
                                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                            <Typography.Text type="secondary" style={{ fontSize: '16px' }}>
                                                {generateStatus === 'generating' ? '正在生成认证报告...' : '点击上方按钮生成认证报告...'}
                                            </Typography.Text>
                                        </div>
                                        <Skeleton active paragraph={{ rows: 11 }} />
                                    </div>
                                )}
                            </div>
                        </DataCard>
                    </Col>
                    <Col xs={24} lg={14}>
                        <DataCard title="验证认证报告" titleIcon={<span>2</span>}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <p style={infoTextStyle}>
                                    在所需主机中下载原始文件<code>report.cert</code>和<code>nonce.bin</code>，验证报告的有效性。
                                </p>
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                                    <Space direction="horizontal" style={{ width: '100%' }}>
                                        <Button
                                            type="primary"
                                            onClick={() => handleDownloadReport('report.cert')}
                                            disabled={generateStatus !== 'generated'}
                                            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition duration-200 shadow-sm ${generateStatus === 'generated'
                                                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            下载 report
                                        </Button>
                                        <Button
                                            type="primary"
                                            onClick={() => handleDownloadReport('nonce.bin')}
                                            disabled={generateStatus !== 'generated'}
                                            className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition duration-200 shadow-sm ${generateStatus === 'generated'
                                                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            下载 nonce
                                        </Button>
                                        <Button
                                            type="primary"
                                            onClick={handleVerifyReport}
                                            disabled={verifyStatus === 'verifying' || generateStatus !== 'generated'}
                                            className={`w-full py-2 px-4 rounded-xl font-semibold transition duration-200 shadow-md ${verifyStatus === 'verifying'
                                                ? 'bg-blue-300 text-white cursor-not-allowed'
                                                : 'bg-yellow-600 text-white hover:bg-yellow-700 active:bg-yellow-800 disabled:bg-gray-400'
                                                }`}
                                        >
                                            {verifyStatus === 'verifying' ? '正在验证...' : '验证认证报告'}
                                        </Button>
                                    </Space>
                                </div>
                            </div>

                            {/* 显示验证的内容 */}
                            <div className="mt-4 p-4 bg-gray-900 rounded-xl border border-purple-500/30 shadow-lg backdrop-blur-sm">
                                {content.verify ? (
                                    <div style={{ color: '#ffffff' }}>
                                        <LineByLinePre text={content.verify} delay={400} />
                                    </div>
                                    // <CharByCharPre text={content.verify} delay={30} />
                                ) : (
                                    <div className="py-10" style={{ color: '#ffffff' }}>
                                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                            <Typography.Text type="secondary" style={{ fontSize: '16px' }}>
                                                {verifyStatus === 'verifying' ? '正在验证认证报告...' : '点击上方按钮验证认证报告...'}
                                            </Typography.Text>
                                        </div>
                                        {/* 骨架条，5 行即可，高度和真实代码块接近 */}
                                        <Skeleton active paragraph={{ rows: 11 }} />
                                    </div>
                                )}
                            </div>

                        </DataCard>
                    </Col>
                </Row>
            </MainLayout>
        </AuthGuard>
    );
}
