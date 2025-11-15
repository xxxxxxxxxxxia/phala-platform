// src/components/AssetDashboard.tsx
import React from 'react';
import { Card, Form, Select, Input, Button, Row, Col } from 'antd';
import styles from '../styles/IncentiveFlow.module.css';
import type { IAccount } from './IncentiveFlow';

interface Props {
    accounts: IAccount[]; isTxInProgress: boolean; formatAddress: (address: string, length?: number) => string;
    startComputingSender: string; setStartComputingSender: (val: string) => void;
    startComputingPid: string; setStartComputingPid: (val: string) => void;
    startWorker: string; setStartWorker: (val: string) => void;
    startStake: string; setStartStake: (val: string) => void;
    startComputing: () => void;
}

const AssetDashboard: React.FC<Props> = (props) => {
    const {
        accounts, isTxInProgress, formatAddress, startComputingSender, setStartComputingSender,
        startComputingPid, setStartComputingPid, startWorker, setStartWorker, startStake,
        setStartStake, startComputing
    } = props;

    return (
        <Card title="计算任务">
            <Card type="inner" title="开始计算">
                <Form layout="vertical">
                    <Form.Item label="交易发送账户">
                        <Select
                            value={startComputingSender}
                            onChange={value => setStartComputingSender(value)}
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
                        <Col xs={24} sm={8}>
                            <Form.Item label="池ID">
                                <Input value={startComputingPid} onChange={e => setStartComputingPid(e.target.value)} type="number" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={16}>
                            <Form.Item label="Worker公钥">
                                <Input value={startWorker} onChange={e => setStartWorker(e.target.value)} placeholder="0x..." />
                            </Form.Item>
                        </Col>
                        <Col xs={24}>
                             <Form.Item label="质押数量">
                                <Input value={startStake} onChange={e => setStartStake(e.target.value)} />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item>
                        <Button
                            type="primary"
                            onClick={startComputing}
                            loading={isTxInProgress}
                            disabled={!startComputingSender}
                            style={{ float: 'right', minWidth: 125 }}
                        >
                            开始计算
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </Card>
    );
}

export default AssetDashboard;