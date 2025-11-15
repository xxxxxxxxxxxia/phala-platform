// src/components/ConnectionCard.tsx
import React from 'react';
import { Card, Input, Button, Space, Typography, Divider, Row, Col } from 'antd'; 
import styles from '../styles/IncentiveFlow.module.css';
import type { IChainInfo } from './IncentiveFlow';
import type { ApiPromise } from '@polkadot/api';

interface Props {
    wsUrl: string;
    isCryptoReady: boolean;
    setWsUrl: (value: string) => void;
    api: ApiPromise | null;
    connecting: boolean;
    isTxInProgress: boolean;
    connect: () => void;
    disconnect: () => void;
    chainInfo: IChainInfo;
    formatAddress: (address: string, length?: number) => string;
    setView: (view: 'dashboard' | 'system') => void;
}
const { Text: AntdText } = Typography;

const ConnectionCard: React.FC<Props> = ({
                                             isCryptoReady, wsUrl, setWsUrl, api, connecting, isTxInProgress, connect, disconnect,
                                             chainInfo, formatAddress, setView
                                         }) => {
    return (
        <Card title="连接状态">
            <Space.Compact style={{ width: '100%' }}>
                <Input
                    addonBefore="WS端点:"
                    value={wsUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWsUrl(e.target.value)}
                    disabled={!!api || connecting}
                />
                <Button
                    type="primary"
                    onClick={connect}
                    loading={connecting}
                    disabled={!isCryptoReady || !!api || isTxInProgress}
                >
                    连接
                </Button>
                <Button onClick={disconnect} disabled={!api || isTxInProgress}>断开</Button>
            </Space.Compact>

            <Divider style={{ margin: '16px 0' }} />

            <Row gutter={[16, 16]} align="middle">
                <Col><AntdText type="secondary">链:</AntdText> <AntdText strong>{chainInfo.chain || '-'}</AntdText></Col>
                <Col><AntdText type="secondary">节点版本:</AntdText> <AntdText strong>{chainInfo.version || '-'}</AntdText></Col>
                <Col><AntdText type="secondary">区块高度:</AntdText> <AntdText strong>{chainInfo.blockNumber ? chainInfo.blockNumber.toLocaleString() : '-'}</AntdText></Col>
                <Col>
                    <AntdText type="secondary">连接状态:</AntdText>{' '}
                    <AntdText strong style={{ color: api ? '#52c41a' : '#ff4d4f' }}>
                        {api ? '已连接' : (connecting ? '连接中...' : '未连接')}
                    </AntdText>
                </Col>
                <Col flex="auto" style={{ textAlign: 'right' }}>
                    <Button onClick={() => setView('system')} disabled={!api} style={{ minWidth: 125 }} type="primary">
                        系统操作
                    </Button>
                </Col>
            </Row>
        </Card>
    );
};

export default ConnectionCard;