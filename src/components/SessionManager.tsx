// src/components/SessionManager.tsx
import React from 'react';
import { Card, Table, Tag, Input, Button, Form, Select, Space, Tooltip, Typography, Row, Col } from 'antd';
import styles from '../styles/IncentiveFlow.module.css';
import type { IAccount, ISession } from './IncentiveFlow';

interface Props {
    sessions: ISession[];
    sessionAccount: string;
    setSessionAccount: (value: string) => void;
    querySessions: () => void;
    isTxInProgress: boolean;
    withdrawSender: string;
    setWithdrawSender: (value: string) => void;
    withdrawPoolId: string;
    setWithdrawPoolId: (value: string) => void;
    withdrawWorkerPubkey: string;
    setWithdrawWorkerPubkey: (value: string) => void;
    withdrawSessionReward: () => void;
    accounts: IAccount[];
    formatAddress: (address: string, length?: number) => string;
    formatLargeNumber: (value: number | string) => string;
    formatTimestamp: (value: number) => string;
    formatBalance: (value: string | number | bigint) => string;
}

const { Text: AntdText } = Typography;
const SessionManager: React.FC<Props> = (props) => {
    const {
        sessions, sessionAccount, setSessionAccount, querySessions, isTxInProgress,
        withdrawSender, setWithdrawSender, withdrawPoolId, setWithdrawPoolId,
        withdrawWorkerPubkey, setWithdrawWorkerPubkey, withdrawSessionReward,
        accounts, formatAddress, formatLargeNumber, formatTimestamp, formatBalance
    } = props;

    const getSessionStatusClass = (state: string): string => {
        if (state.includes('Idle')) return styles.statusActive;
        if (state.includes('Unresponsive')) return styles.statusError;
        if (state.includes('CoolingDown')) return styles.statusWarning;
        return styles.statusInactive;
    };
    const columns = [
        { title: 'Session账户', dataIndex: 'accountId', key: 'accountId', render: (text: string) => <Tooltip title={text}><AntdText code>{formatAddress(text)}</AntdText></Tooltip> },
        { 
            title: '状态', 
            dataIndex: ['info', 'state'], 
            key: 'state', 
            render: (state: { toString: () => string }) => {
                const stateStr = state.toString();
                let color = 'default';
                if (stateStr.includes('Idle')) color = 'green';
                if (stateStr.includes('Unresponsive')) color = 'red';
                if (stateStr.includes('CoolingDown')) color = 'orange';
                return <Tag color={color}>{stateStr}</Tag>;
            }
        },
        { title: 'Ve', dataIndex: ['info', 've'], key: 've', render: (text: any) => formatLargeNumber(text) },
        { title: 'V', dataIndex: ['info', 'v'], key: 'v', render: (text: any) => formatLargeNumber(text) },
        { title: 'Working Start Time', dataIndex: ['info', 'benchmark', 'workingStartTime'], key: 'workingStartTime', render: (text: any) => formatTimestamp(text) },
        { 
        	title: '总奖励 (CMC)', 
        	dataIndex: ['info', 'stats', 'totalReward'], 
        	key: 'totalReward', 
        	render: (text: any) => {
                const formattedValue = formatBalance(text);
                if (typeof formattedValue === 'string') {
                    return formattedValue.replace('PHA', 'CMC');
                }
                return formattedValue;
         } 
        },
        { title: '当前性能分', dataIndex: ['info', 'benchmark', 'pInstant'], key: 'pInstant' },
        { title: '迭代次数', dataIndex: ['info', 'benchmark', 'iterations'], key: 'iterations', render: (text: any) => text?.toLocaleString() },
    ];

    return (
        <Card title="Session管理">
            <Space direction="vertical" size="large" style={{ display: 'flex' }}>
                <Card type="inner" title="查询会话信息">
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            style={{ width: 'calc(100% - 100px)' }}
                            addonBefore="Session账户:"
                            value={sessionAccount}
                            onChange={e => setSessionAccount(e.target.value)}
                            placeholder="Session账户地址"
                        />
                        <Button type="primary" onClick={querySessions} loading={isTxInProgress} style={{ minWidth: 125 }}> 查询会话 </Button>
                    </Space.Compact>
                </Card>

                <Card type="inner" title="会话列表">
                    <Table
                        columns={columns}
                        dataSource={sessions}
                        rowKey="accountId"
                        pagination={{ pageSize: 5 }}
                        scroll={{ x: 1200 }}
                        size="small"
                    />
                </Card>
                
                <Card type="inner" title="提取会话奖励">
                    <Form layout="vertical">
                         <Form.Item label="交易发送账户">
                            <Select
                                value={withdrawSender}
                                onChange={value => setWithdrawSender(value)}
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
                                <Form.Item label="池ID">
                                    <Input value={withdrawPoolId} onChange={e => setWithdrawPoolId(e.target.value)} type="number" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item label="Worker公钥">
                                    <Input value={withdrawWorkerPubkey} onChange={e => setWithdrawWorkerPubkey(e.target.value)} />
                                </Form.Item>
                            </Col>
                        </Row>
                        <Form.Item>
                            <Button
                                type="primary"
                                onClick={withdrawSessionReward}
                                loading={isTxInProgress}
                                disabled={!withdrawSender}
                                style={{ float: 'right', minWidth: 125 }}
                            >
                                提取奖励
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </Space>
        </Card>
    );
};

export default SessionManager;