// src/components/WorkerSetup.tsx
import React from 'react';
import { Card, Form, Input, Button, Select, Row, Col, Space} from 'antd';
import styles from '../styles/IncentiveFlow.module.css';
import type { IAccount } from './IncentiveFlow';

interface Props {
    gatekeeperPub: string; setGatekeeperPub: (value: string) => void;
    registerGatekeeper: () => void;
    selectedAccount: string; isTxInProgress: boolean;
    forcePub: string; setForcePub: (value: string) => void;
    forceEcdhPub: string; setForceEcdhPub: (value: string) => void;
    forceOperator: string; setForceOperator: (value: string) => void;
    accounts: IAccount[]; formatAddress: (address: string, length?: number) => string;
    forceRegisterWorker: () => void;
}

const WorkerSetup: React.FC<Props> = (props) => {
    const {
        gatekeeperPub, setGatekeeperPub, registerGatekeeper, selectedAccount,
        isTxInProgress, forcePub, setForcePub, forceEcdhPub, setForceEcdhPub,
        forceOperator, setForceOperator, accounts, formatAddress, forceRegisterWorker
    } = props;

    return (
        <Card title="Worker 设置">
            <Form layout="vertical">
                <Card type="inner" title="注册 Gatekeeper">
                    <Form.Item label="Gatekeeper 公钥">
                        <Space.Compact style={{ width: '100%' }}>
                            <Input
                                style={{ width: 'calc(100% - 100px)' }}
                                value={gatekeeperPub}
                                onChange={e => setGatekeeperPub(e.target.value)}
                                placeholder="0x..."
                            />
                            <Button
                                type="primary"
                                onClick={registerGatekeeper}
                                loading={isTxInProgress}
                                disabled={!selectedAccount}
                                style={{ minWidth: 125 }}
                            >
                                提交 (Sudo)
                            </Button>
                        </Space.Compact>
                    </Form.Item>
                </Card>

                <Card type="inner" title="强制注册 Worker" style={{ marginTop: 16 }}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Worker公钥 (pubkey)">
                                <Input value={forcePub} onChange={e => setForcePub(e.target.value)} placeholder="0x..." />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                             <Form.Item label="ECDH 公钥 (ecdhkey)">
                                <Input value={forceEcdhPub} onChange={e => setForceEcdhPub(e.target.value)} placeholder="0x..." />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item label="操作者 (Operator)">
                         <Space.Compact style={{ width: '100%' }}>
                            <Select
                                style={{ width: 'calc(100% - 100px)' }}
                                value={forceOperator}
                                onChange={value => setForceOperator(value)}
                                disabled={!accounts.length}
                                placeholder="请选择一个操作者账户"
                            >
                                {accounts.map(a => (
                                    <Select.Option key={a.address} value={a.address}>
                                        {a.meta?.name ? `${a.meta.name} · ` : ''} {formatAddress(a.address, 15)}
                                    </Select.Option>
                                ))}
                            </Select>
                             <Button
                                type="primary"
                                onClick={forceRegisterWorker}
                                loading={isTxInProgress}
                                disabled={!selectedAccount || !forceOperator}
                                style={{ minWidth: 125 }}
                            >
                                提交 (Sudo)
                            </Button>
                        </Space.Compact>
                    </Form.Item>
                </Card>
            </Form>
        </Card>
    );
};

export default WorkerSetup;