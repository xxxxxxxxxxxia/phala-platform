// src/components/LiveData.tsx
import React from 'react';
import { Card, Row, Col, Statistic, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import styles from '../styles/IncentiveFlow.module.css';
import type { IWorker, IPool, ISession } from './IncentiveFlow';

interface Props {
    workers: IWorker[];
    pools: IPool[];
    activeSessions: ISession[];
    totalRewards: bigint;
    formatBalance: (value: bigint | number | string, decimals?: number, unit?: string) => string;
    refreshAllData: (isManual: boolean) => void;
    loading: boolean;
    isTxInProgress: boolean;
}

const LiveData: React.FC<Props> = ({
                                       workers, pools, activeSessions, totalRewards,
                                       formatBalance, refreshAllData, loading, isTxInProgress
                                   }) => {
    return (
        <Card
            title="实时数据"
            extra={
                <Button
                    icon={<ReloadOutlined />}
                    onClick={() => refreshAllData(true)}
                    loading={loading}
                    disabled={isTxInProgress}
                    style={{ minWidth: 125 }}
                >
                    刷新数据
                </Button>
            }
        >
            {/* [修改] 使用 antd 的 Grid 和 Statistic 组件 */}
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                    <Statistic title="Worker数量" value={workers.length} valueStyle={{ color: '#52c41a' }} />
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Statistic title="质押池数量" value={pools.length} valueStyle={{ color: '#1890ff' }} />
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Statistic title="活跃会话" value={activeSessions.length} valueStyle={{ color: '#ff4d4f' }}/>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Statistic title="累计总奖励" value={formatBalance(totalRewards, 12, 'CMC')} />
                </Col>
            </Row>
        </Card>
    );
};

export default LiveData;