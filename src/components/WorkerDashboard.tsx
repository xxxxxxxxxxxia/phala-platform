// src/components/WorkerDashboard.tsx
import React from 'react';
import { Card, Table, Tag, Input, Button, Form, Select, Checkbox, Row, Col, Tooltip, Typography, Space } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import styles from '../styles/IncentiveFlow.module.css';
import type { IAccount, IWorker, IPruntimeInfo } from './IncentiveFlow';

interface Props {
    pruntimeUrl: string; setPruntimeUrl: (value: string) => void;
    getPruntimeInfo: () => void;
    pruntimeInfoForRegister: IPruntimeInfo;
    setPruntimeInfoForRegister: (value: IPruntimeInfo) => void;
    registerV2Sender: string; setRegisterV2Sender: (value: string) => void;
    setOperatorForV2: boolean; setSetOperatorForV2: (value: boolean) => void;
    registerWorkerV2: () => void;
    workers: IWorker[];
    gatekeepers: string[];
    accounts: IAccount[];
    formatAddress: (address: string, length?: number) => string;
    isTxInProgress: boolean;
}

const { Text: AntdText } = Typography;
const WorkerDashboard: React.FC<Props> = (props) => {
    const {
        pruntimeUrl, setPruntimeUrl, getPruntimeInfo,
        pruntimeInfoForRegister, setPruntimeInfoForRegister, registerV2Sender,
        setRegisterV2Sender, setOperatorForV2, setSetOperatorForV2,
        registerWorkerV2, workers, gatekeepers, accounts, formatAddress, isTxInProgress
    } = props;

    const getWorkerStatus = (worker: IWorker): string => '已注册';
    const getWorkerStatusClass = (worker: IWorker): string => styles.statusActive;

    const handlePruntimeInfoChange = (field: keyof IPruntimeInfo, value: string | number) => {
        setPruntimeInfoForRegister({ ...pruntimeInfoForRegister, [field]: value });
    };

    const columns = [
        {
            title: '公钥 (Pubkey)',
            dataIndex: 'pubkey',
            key: 'pubkey',
            render: (text: string) => <Tooltip title={text}><AntdText code>{formatAddress(text)}</AntdText></Tooltip>
        },
        {
            title: '操作者 (Operator)',
            dataIndex: 'operator',
            key: 'operator',
            render: (text: string) => text ? <Tooltip title={text}><AntdText code>{formatAddress(text)}</AntdText></Tooltip> : '-'
        },
        {
            title: 'Gatekeeper',
            dataIndex: 'pubkey',
            key: 'gatekeeper',
            render: (pubkey: string) => gatekeepers.includes(pubkey)
                ? <Tag icon={<CheckCircleOutlined />} color="success">是</Tag>
                : <Tag color="default">否</Tag>
        },
        {
            title: '初始分数',
            dataIndex: 'initialScore',
            key: 'initialScore',
            render: (score: any) => score?.toLocaleString() ?? 'N/A'
        },
        {
            title: '最后更新区块',
            dataIndex: 'lastUpdated',
            key: 'lastUpdated',
        },
        {
            title: '状态',
            key: 'status',
            render: () => <Tag color="processing">已注册</Tag>
        },
    ];

    return (
        <Card title="Worker 管理">
            <Form layout="vertical">
                <Card type="inner" title="注册 Worker V2">
                    <Form.Item label="pRuntime 端点">
                        <Space.Compact style={{ width: '100%' }}>
                            <Input
                                style={{ width: 'calc(100% - 120px)' }}
                                value={pruntimeUrl}
                                onChange={e => setPruntimeUrl(e.target.value)}
                                placeholder="http://8.147.107.221:18000"
                            />
                            <Button
                                type="primary"
                                onClick={getPruntimeInfo}
                                disabled={!pruntimeUrl || isTxInProgress}
                                style={{ minWidth: 125, float: 'right' }}
                            >
                                1. 获取当前参数
                            </Button>
                        </Space.Compact>
                    </Form.Item>

                    <Form.Item label="交易发送账户">
                        <Select
                            value={registerV2Sender}
                            onChange={value => setRegisterV2Sender(value)}
                            disabled={!accounts.length}
                            placeholder="请选择发送交易的账户"
                        >
                            {accounts.map(a => (
                                <Select.Option key={a.address} value={a.address}>
                                    {a.meta?.name ? `${a.meta.name} · ` : ''} {formatAddress(a.address, 20)}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    
                    <Row gutter={16}>
                        <Col span={12}><Form.Item label="Version"><Input type="number" value={pruntimeInfoForRegister.version} onChange={e => handlePruntimeInfoChange('version', e.target.value)} /></Form.Item></Col>
                        <Col span={12}><Form.Item label="Machine ID"><Input value={pruntimeInfoForRegister.machineId} onChange={e => handlePruntimeInfoChange('machineId', e.target.value)} /></Form.Item></Col>
                        <Col span={12}><Form.Item label="Pubkey"><Input value={pruntimeInfoForRegister.pubkey} onChange={e => handlePruntimeInfoChange('pubkey', e.target.value)} /></Form.Item></Col>
                        <Col span={12}><Form.Item label="ECDH Pubkey"><Input value={pruntimeInfoForRegister.ecdhPubkey} onChange={e => handlePruntimeInfoChange('ecdhPubkey', e.target.value)} /></Form.Item></Col>
                        <Col span={12}><Form.Item label="Genesis Block Hash"><Input value={pruntimeInfoForRegister.genesisBlockHash} onChange={e => handlePruntimeInfoChange('genesisBlockHash', e.target.value)} /></Form.Item></Col>
                        <Col span={12}><Form.Item label="Features (逗号分隔)"><Input value={pruntimeInfoForRegister.features} onChange={e => handlePruntimeInfoChange('features', e.target.value)} /></Form.Item></Col>
                        <Col span={12}><Form.Item label="Para ID"><Input type="number" value={pruntimeInfoForRegister.paraId} onChange={e => handlePruntimeInfoChange('paraId', e.target.value)} /></Form.Item></Col>
                        <Col span={12}><Form.Item label="Max Consensus Version"><Input type="number" value={pruntimeInfoForRegister.maxConsensusVersion} onChange={e => handlePruntimeInfoChange('maxConsensusVersion', e.target.value)} /></Form.Item></Col>
                    </Row>
                    
                    <Form.Item>
                        <Checkbox checked={setOperatorForV2} onChange={e => setSetOperatorForV2(e.target.checked)}>
                            设置操作者 (Operator)
                        </Checkbox>
                    </Form.Item>
                    
                    {setOperatorForV2 && (
                        <Form.Item>
                             <Select
                                value={pruntimeInfoForRegister.operator}
                                onChange={value => handlePruntimeInfoChange('operator', value)}
                                disabled={!accounts.length}
                                placeholder="请选择一个操作者"
                            >
                                {accounts.map(a => (
                                    <Select.Option key={a.address} value={a.address}>
                                        {a.meta?.name ? `${a.meta.name} · ` : ''} {formatAddress(a.address, 20)}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    )}

                    <Form.Item>
                        <Button
                            type="primary"
                            onClick={registerWorkerV2}
                            loading={isTxInProgress}
                            disabled={!registerV2Sender}
                            style={{ minWidth: 125, float: 'right' }}
                        >
                            2. 提交注册
                        </Button>
                    </Form.Item>
                </Card>

                <Card type="inner" title="已注册的 Worker" style={{ marginTop: 16 }}>
                    <Table
                        columns={columns}
                        dataSource={workers}
                        rowKey="pubkey"
                        pagination={{ pageSize: 5, size: 'small' }}
                        scroll={{ x: 1000 }}
                        size="small"
                    />
                </Card>
            </Form>
        </Card>
    );
};

export default WorkerDashboard;