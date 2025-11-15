// src/components/StopComputing.tsx
import React from 'react';
import { Card, Form, Select, Input, Button, Row, Col } from 'antd';
import type { IAccount } from './IncentiveFlow'; // 假设类型定义在父组件或共享文件中

interface Props {
    accounts: IAccount[];
    isTxInProgress: boolean;
    formatAddress: (address: string, length?: number) => string;
    stopComputingSender: string;
    setStopComputingSender: (val: string) => void;
    stopComputingPid: string;
    setStopComputingPid: (val: string) => void;
    stopComputingWorker: string;
    setStopComputingWorker: (val: string) => void;
    stopComputing: () => void;
}

const StopComputing: React.FC<Props> = (props) => {
    const {
        accounts, isTxInProgress, formatAddress, stopComputingSender, setStopComputingSender,
        stopComputingPid, setStopComputingPid, stopComputingWorker, setStopComputingWorker,
        stopComputing
    } = props;

    return (
        <Card title="停止计算">
            <Card type="inner" title="停止 Worker 计算">
                <Form layout="vertical">
                    <Form.Item label="交易发送账户">
                        <Select
                            value={stopComputingSender}
                            onChange={value => setStopComputingSender(value)}
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
                            <Form.Item label="池ID (pid)">
                                <Input value={stopComputingPid} onChange={e => setStopComputingPid(e.target.value)} type="number" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={16}>
                            <Form.Item label="Worker公钥 (worker)">
                                <Input value={stopComputingWorker} onChange={e => setStopComputingWorker(e.target.value)} placeholder="0x..." />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item>
                        <Button
                            type="primary"
                            danger
                            onClick={stopComputing}
                            loading={isTxInProgress}
                            disabled={!stopComputingSender}
                            style={{ float: 'right', minWidth: 125 }}
                        >
                            停止计算
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </Card>
    );
}

export default StopComputing;