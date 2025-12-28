'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Col, Row, Steps, Typography, message, Tag, Badge, Modal, Descriptions } from 'antd';
import {
    CodeOutlined,
    ApiOutlined,
    DeploymentUnitOutlined,
    CloudServerOutlined,
    SafetyCertificateOutlined,
    ThunderboltOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
    CloseCircleOutlined,
} from '@ant-design/icons';
import PortalLayout from '@/components/layout/PortalLayout';
import styles from '../portal.module.css';
import developersStyles from './developers.module.css';

const { Title, Paragraph } = Typography;

// API 基础地址配置 - 可根据需要修改
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://8.147.106.136:3001';

// 只显示一个主卡片
const mainCard = {
    name: 'Hygon C86-4G TEE',
    version: 'CSV 1.3',
    desc: '海光 C86 处理器，支持硬件级机密计算。',
    specs: [
        { label: 'CPU 型号', value: 'Hygon C86-4G (OPN:7490)' },
        { label: 'CSV 支持', value: 'enabled', status: 'success' },
        { label: 'SME 支持', value: 'active', status: 'success' },
        { label: 'TDM 支持', value: 'enabled', status: 'success' },
    ],
};

const quickStartSteps = [
    '下载部署示例文件，包含Docker Compose配置',
    '开始构建任务，系统自动调度最佳机密计算节点',
    '导入Docker Compose配置文件，一键部署可信应用',
    '进入部署示例详情页面，查看机密环境信息与日志',
    '点击网络信息，进入Dashboard查看应用运行内容',
    '点击可信证明，查看应用可信证明信息',
    '点击应用配置，查看环境加密公钥与盐值等信息',
    '点击应用设置，修改CVM配置信息与应用配置信息',
];

const capabilityColumns = [
    {
        title: '快速开始',
        desc: '通过简单的步骤快速部署您的第一个机密计算应用。',
        icon: <ThunderboltOutlined />,
        items: [
            '下载部署示例文件，获取 Docker Compose 配置',
            '点击"开始构建"按钮，系统自动调度最佳资源',
            '导入配置文件，一键部署您的应用',
            '查看应用详情，监控运行状态和日志',
        ],
    },
    {
        title: '应用管理',
        desc: '管理您的应用配置、网络设置和运行环境。',
        icon: <CloudServerOutlined />,
        items: [
            '查看和修改应用配置信息',
            '配置网络访问和端口映射',
            '查看可信证明和环境加密信息',
            '管理应用生命周期和资源',
        ],
    },
    {
        title: '安全与证明',
        desc: '了解应用的机密计算能力和安全特性。',
        icon: <SafetyCertificateOutlined />,
        items: [
            '查看 TEE 远程证明信息',
            '验证镜像度量和完整性',
            '查看环境加密公钥和盐值',
            '了解密钥管理和安全机制',
        ],
    },
];

// const apiHighlights = [
//     { label: '任务提交', value: 'POST /api/tasks' },
//     { label: '会话查询', value: 'GET /api/sessions/:id' },
//     { label: '激励记录', value: 'GET /api/incentives/:account' },
// ];

export default function DevelopersPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);


    const handleStartBuild = async () => {
        try {
            setLoading(true);
            message.loading('正在调度最佳资源...', 0);

            const response = await fetch(`http://8.147.106.136:3001/api/scheduled`, {
                method: 'GET',
            });

            const data = await response.json();
            console.log('API Response:', data);
            
            message.destroy();

            if (data.message === '调度成功' && data.host && data.scheduledPort) {
                // 将 host 和 scheduledPort 保存到 localStorage
                localStorage.setItem('bestHostIp', data.host);
                localStorage.setItem('bestHostPort', data.scheduledPort.toString());
                message.success(`已找到最佳主机: ${data.host}:${data.scheduledPort}`);
                // 导航到登录页面
                router.push('/developers/login');
            } else {
                message.error(data.message || '未找到可用主机');
            }
        } catch (error: any) {
            message.destroy();
            message.error(`获取最佳主机失败: ${error.message || '网络错误'}`);
            console.error('获取最佳主机时发生错误:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadExample = () => {
        const link = document.createElement('a');
        link.href = '/api/download-compose';
        link.download = 'docker-compose.yml';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success('开始下载部署示例文件');
    };

    const handleShowDetail = () => {
        setDetailModalVisible(true);
    };

    const renderDetailContent = () => {
        const detailSections = [
            {
                title: 'TEE 固件支持',
                items: [
                    { label: 'firewalld', value: 'inactive', status: 'warning' },
                    { label: 'kernel version', value: '5.10.134-csv', status: 'success' },
                    { label: 'model name', value: 'Hygon C86-4G (OPN:7490)', status: 'success' },
                    { label: 'is Hygon CPU', value: 'YES', status: 'success' },
                    { label: 'HW SME', value: 'supported', status: 'success' },
                    { label: 'SMEE(HW SME control)', value: 'enabled', status: 'success' },
                    { label: 'SME(Host Linux)', value: 'supported', status: 'success' },
                    { label: 'SME(Host Linux control)', value: 'active', status: 'success' },
                    { label: '/dev/sev', value: 'exist', status: 'success' },
                    { label: 'psp bl version', value: '3.5.3.64', status: 'success' },
                    { label: 'csv api version', value: '1.3', status: 'success' },
                    { label: 'firmware version', value: '2136', status: 'success' },
                    { label: 'is HGSC imported', value: 'YES', status: 'success' },
                    { label: 'chip id', value: 'TNCG560008041501', status: 'info' },
                ]
            },
            {
                title: 'CSV 详细状态',
                items: [
                    { label: 'CSV', value: 'enabled', status: 'success' },
                    { label: 'HW', value: 'supported', status: 'success' },
                    { label: 'FW', value: 'supported', status: 'success' },
                    { label: 'Hypervisor', value: 'supported', status: 'success' },
                    { label: 'Hypervisor control', value: 'enabled', status: 'success' },
                ]
            },
            {
                title: 'TDM 与设备状态',
                items: [
                    { label: '/dev/tdm', value: 'exist', status: 'success' },
                    { label: 'TDM', value: 'enabled', status: 'success' },
                    { label: 'tdm api version', value: '1.4', status: 'success' },
                    { label: '/dev/tpm0', value: 'nonexist', status: 'error' },
                    { label: 'tpm_acpi', value: 'HYGT0101', status: 'info' },
                    { label: '/dev/tcm0', value: 'nonexist', status: 'error' },
                    { label: 'tcm_acpi', value: 'nonexist', status: 'error' },
                ]
            },
        ];

        return (
            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                {detailSections.map((section, sectionIdx) => (
                    <div key={section.title} style={{ marginBottom: sectionIdx < detailSections.length - 1 ? '24px' : 0 }}>
                        <Title level={5} style={{ marginBottom: '12px', color: '#1f2937' }}>
                            {section.title}
                        </Title>
                        <Descriptions
                            bordered
                            column={1}
                            size="small"
                            labelStyle={{ fontWeight: 500, background: '#fafafa', width: '40%' }}
                        >
                            {section.items.map((item, idx) => (
                                <Descriptions.Item
                                    key={idx}
                                    label={item.label}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {item.status === 'success' && (
                                            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
                                        )}
                                        {item.status === 'error' && (
                                            <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />
                                        )}
                                        {item.status === 'warning' && (
                                            <InfoCircleOutlined style={{ color: '#faad14', fontSize: '16px' }} />
                                        )}
                                        <span style={{ 
                                            fontWeight: 500,
                                            color: item.status === 'error' ? '#ff4d4f' : item.status === 'warning' ? '#faad14' : '#1f2937'
                                        }}>
                                            {item.value}
                                        </span>
                                    </div>
                                </Descriptions.Item>
                            ))}
                        </Descriptions>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <PortalLayout>
            <div className={styles.portalContent}>
                <section className={styles.hero}>
                    {/* <div className={styles.heroBadge}>
                        <CodeOutlined /> 应用开发者中心
                    </div> */}
                    <Title level={1} className={styles.heroTitle}>
                        <span className={styles.heroHighlight}>支持国产TEE机密计算的容器化应用一键部署</span>
                        {/* 国产TEE · 机密虚拟机 · 容器化应用程序一键部署 */}
                    </Title>
                    <Paragraph className={styles.heroSubtitle}>
                        通过安全调度算法选择最佳资源地址，一键部署属于自己的应用程序，获得定制化的安全计算服务体验。
                    </Paragraph>
                    <div className={styles.heroActions}>
                        <Button
                            size="large"
                            onClick={handleDownloadExample}
                        >
                            部署示例
                        </Button>
                        <Button
                            type="primary"
                            size="large"
                            loading={loading}
                            onClick={handleStartBuild}
                        >
                            开始构建{/* 调度最佳资源 */}
                        </Button>
                    </div>
                </section>

                <section className={styles.section}>
                    <Card className={developersStyles.resourcesQuickStartCard}>
                        <Row gutter={[32, 32]}>
                            <Col xs={24} lg={12}>
                                <Title level={3} className={developersStyles.resourcesQuickStartTitle}>
                                    资源配置
                                </Title>
                                <Card className={developersStyles.resourceItemCard}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div>
                                            <Title level={4} className={developersStyles.developersCardTitle}>
                                                {mainCard.name}
                                            </Title>
                                            <Paragraph className={developersStyles.developersCardVersion}>
                                                {mainCard.version}
                                            </Paragraph>
                                        </div>
                                        <Badge status="success" text="运行中" style={{ color: '#52c41a', fontWeight: 500 }} />
                                    </div>
                                    <Paragraph className={developersStyles.developersCardDesc}>
                                        {mainCard.desc}
                                    </Paragraph>
                                    <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {mainCard.specs.map((spec) => (
                                            <div key={spec.label} style={{ 
                                                display: 'flex', 
                                                flexDirection: 'column',
                                                padding: '10px 12px',
                                                background: 'rgba(255, 255, 255, 0.6)',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(37, 99, 235, 0.1)',
                                                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(37, 99, 235, 0.08)',
                                                transition: 'all 0.3s ease',
                                                cursor: 'default'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.15), 0 2px 6px rgba(0, 0, 0, 0.1)';
                                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(37, 99, 235, 0.08)';
                                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
                                            }}
                                            >
                                                <span style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                                                    {spec.label}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {spec.status === 'success' && (
                                                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                                                    )}
                                                    <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: 500 }}>
                                                        {spec.value}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Button 
                                        type="link" 
                                        className={developersStyles.developersCardLink}
                                        style={{ marginTop: '16px', paddingLeft: '0' }}
                                        onClick={handleShowDetail}
                                    >
                                        查看详细信息
                                    </Button>
                                </Card>
                            </Col>
                            <Col xs={24} lg={12}>
                                <Title level={3} className={developersStyles.resourcesQuickStartTitle}>
                                    快速入门
                                </Title>
                                <Card className={developersStyles.quickStartCard}>
                                    <Row gutter={[16, 16]} className={developersStyles.quickStartStepsRow}>
                                        <Col xs={24} sm={12}>
                                            <Steps
                                                className={developersStyles.developersSteps}
                                                direction="vertical"
                                                items={quickStartSteps.slice(0, 4).map((s, index) => ({
                                                    title: `Step ${index + 1}`,
                                                    description: s,
                                                }))}
                                            />
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <Steps
                                                className={developersStyles.developersSteps}
                                                direction="vertical"
                                                items={quickStartSteps.slice(4, 8).map((s, index) => ({
                                                    title: `Step ${index + 5}`,
                                                    description: s,
                                                    icon: <span>{index + 5}</span>,
                                                }))}
                                            />
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>
                        </Row>
                    </Card>
                </section>

                <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        核心功能
                    </Title>
                    <Paragraph className={styles.sectionDescription}>
                        了解平台的核心能力，快速掌握应用部署、管理和安全特性。
                    </Paragraph>
                    <Row gutter={[24, 24]}>
                        {capabilityColumns.map((item) => (
                            <Col xs={24} md={8} key={item.title}>
                                <Card className={styles.portalCard}>
                                    <div className={styles.cardIcon}>{item.icon}</div>
                                    <Title level={4} className={styles.cardTitle}>
                                        {item.title}
                                    </Title>
                                    <Paragraph className={styles.cardDescription}>{item.desc}</Paragraph>
                                    <ul className={developersStyles.featureList}>
                                        {item.items.map((point) => (
                                            <li key={point} className={developersStyles.featureItem}>
                                                <span className={developersStyles.featureBullet} />
                                                <span>{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </section>

                {/* <section className={styles.section}>
                    <Title level={3} className={styles.sectionTitle}>
                        RPC API
                    </Title>
                    <Row gutter={[24, 24]}>
                        {apiHighlights.map((api) => (
                            <Col xs={24} md={8} key={api.label}>
                                <Card className={styles.portalCard}>
                                    <Title level={4} style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <ApiOutlined /> {api.label}
                                    </Title>
                                    <Paragraph className={styles.sectionDescription} style={{ marginBottom: 0 }}>
                                        {api.value}
                                    </Paragraph>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </section> */}
            </div>

            <Modal
                title={
                    <div style={{ fontSize: '18px', fontWeight: 600 }}>
                        {mainCard.name} - 详细系统信息
                    </div>
                }
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setDetailModalVisible(false)}>
                        关闭
                    </Button>
                ]}
                width={900}
            >
                {renderDetailContent()}
            </Modal>
        </PortalLayout>
    );
}
