// src/components/PoolDashboard.tsx
import React from 'react';
import { Card, Table, Input, Button, Form, Select, Typography, Tooltip, Row, Col } from 'antd';
import styles from '../styles/IncentiveFlow.module.css';
import type { IAccount, IPool } from './IncentiveFlow';

interface Props {
    pools: IPool[];
    pid: string; setPid: (value: string) => void;
    workerToAdd: string; setWorkerToAdd: (value: string) => void;
    addWorkerToPool: () => void;
    selectedAccount: string; isTxInProgress: boolean;
    formatAddress: (address: string, length?: number) => string;
    formatBalance: (value: string | number | bigint) => string;
    accounts: IAccount[];
    addWorkerSender: string;
    setAddWorkerSender: (value: string) => void;
}
const { Text: AntdText } = Typography;
const PoolDashboard: React.FC<Props> = (props) => {
    const {
        pools, pid, setPid, workerToAdd, setWorkerToAdd, addWorkerToPool,
        selectedAccount, isTxInProgress, formatAddress, formatBalance, accounts, addWorkerSender, setAddWorkerSender
    } = props;

    const columns = [
        { title: '池ID', dataIndex: ['StakePool', 'basepool', 'pid'], key: 'pid' },
        { 
            title: '所有者 (Owner)', 
            dataIndex: ['StakePool', 'basepool', 'owner'], 
            key: 'owner',
            render: (text: string) => <Tooltip title={text}><AntdText code>{formatAddress(text)}</AntdText></Tooltip>
        },
        { 
        	title: 'Total Shares', 
        	dataIndex: ['StakePool', 'basepool', 'totalShares'], 
        	key: 'totalShares', 
        	render: (text: any) => {
                const formattedValue = formatBalance(text);
                if (typeof formattedValue === 'string') {
                    return formattedValue.replace('PHA', 'CMC');
                }
                return formattedValue;
         }
        },
        { 
        	title: 'Total Value', 
        	dataIndex: ['StakePool', 'basepool', 'totalValue'], 
        	key: 'totalValue', 
        	render: (text: any) => {
                const formattedValue = formatBalance(text);
                if (typeof formattedValue === 'string') {
                    return formattedValue.replace('PHA', 'CMC');
                }
                return formattedValue;
         } 
        },
        { 
            title: '关联Workers', 
            dataIndex: ['StakePool', 'workers'], 
            key: 'workers',
            render: (workers: string[]) => !workers?.length ? '无' : (
                <div>
                    {workers.map(w => (
                        <div key={w}><Tooltip title={w}><AntdText code>{formatAddress(w)}</AntdText></Tooltip></div>
                    ))}
                </div>
            )
        },
        { 
            title: '池账户', 
            dataIndex: ['StakePool', 'basepool', 'poolAccountId'], 
            key: 'poolAccountId',
            render: (text: string) => <Tooltip title={text}><AntdText code>{formatAddress(text)}</AntdText></Tooltip>
        },
        { 
            title: '锁仓账户', 
            dataIndex: ['StakePool', 'lockAccount'], 
            key: 'lockAccount',
            render: (text: string) => <Tooltip title={text}><AntdText code>{formatAddress(text)}</AntdText></Tooltip>
        },
    ];

    return (
        <Card title="质押池管理">
            <Form layout="vertical">
                <Card type="inner" title="添加 Worker 到质押池">
                    <Form.Item label="交易发送账户">
                        <Select
                            value={addWorkerSender}
                            onChange={value => setAddWorkerSender(value)}
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
                        <Col span={12}>
                            <Form.Item label="池ID (pid)">
                                <Input value={pid} onChange={e => setPid(e.target.value)} type="number" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Worker公钥">
                                <Input value={workerToAdd} onChange={e => setWorkerToAdd(e.target.value)} placeholder="0x..." />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item>
                        <Button
                            type="primary"
                            onClick={addWorkerToPool}
                            loading={isTxInProgress}
                            disabled={!addWorkerSender}
                            style={{ float: 'right', minWidth: 125 }}
                        >
                            添加Worker
                        </Button>
                    </Form.Item>
                </Card>

                <Card type="inner" title="质押池列表" style={{ marginTop: 16 }}>
                    <Table
                        columns={columns}
                        dataSource={pools}
                        rowKey={record => record?.StakePool?.basepool?.pid}
                        pagination={{ pageSize: 5 }}
                        scroll={{ x: 1200 }}
                        size="small"
                    />
                </Card>
            </Form>
        </Card>
    );
};

export default PoolDashboard;