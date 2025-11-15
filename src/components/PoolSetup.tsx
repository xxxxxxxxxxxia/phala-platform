// src/components/PoolSetup.tsx
import React from 'react';
import { Card, Form, Select, Button, Space} from 'antd';
import styles from '../styles/IncentiveFlow.module.css';
import type { IAccount } from './IncentiveFlow';

interface Props {
    createPool: () => void;
    createPoolSender: string; setCreatePoolSender: (value: string) => void;
    accounts: IAccount[]; isTxInProgress: boolean;
    formatAddress: (address: string, length?: number) => string;
}

const PoolSetup: React.FC<Props> = (props) => {
    const { createPool, createPoolSender, setCreatePoolSender, accounts, isTxInProgress, formatAddress } = props;

    return (
        <Card title="质押池设置">
            <Card type="inner" title="创建质押池">
                <Form.Item label="交易发送账户">
                    <Space.Compact style={{ width: '100%' }}>
                        <Select
                            style={{ width: 'calc(100% - 100px)' }}
                            value={createPoolSender}
                            onChange={value => setCreatePoolSender(value)}
                            disabled={!accounts.length}
                            placeholder="请选择发送交易的账户"
                        >
                            {accounts.map(a => (
                                <Select.Option key={a.address} value={a.address}>
                                    {a.meta?.name ? `${a.meta.name} · ` : ''} {formatAddress(a.address, 20)}
                                </Select.Option>
                            ))}
                        </Select>
                        <Button
                            type="primary"
                            onClick={createPool}
                            loading={isTxInProgress}
                            disabled={!createPoolSender}
                            style={{ minWidth: 125 }}
                        >
                            创建质押池
                        </Button>
                    </Space.Compact>
                </Form.Item>
            </Card>
        </Card>
    );
};

export default PoolSetup;