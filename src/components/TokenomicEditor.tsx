// src/components/TokenomicEditor.tsx
import React from 'react';
import { Card, Button, Input, Space, TextArea } from 'antd';
import styles from '../styles/IncentiveFlow.module.css';

interface Props {
    loadDefaultTokenomic: () => void;
    tokenomicJson: string;
    setTokenomicJson: (value: string) => void;
    updateTokenomic: () => void;
    selectedAccount: string;
    isTxInProgress: boolean;
}

const TokenomicEditor: React.FC<Props> = ({
    loadDefaultTokenomic, tokenomicJson, setTokenomicJson,
    updateTokenomic, selectedAccount, isTxInProgress
}) => {
    return (
        <Card title="经济模型 (Sudo)">
            <Space direction="vertical" style={{ width: '100%' }}>
                <Input.TextArea
                    value={tokenomicJson}
                    onChange={e => setTokenomicJson(e.target.value)}
                    rows={10}
                    placeholder="JSON 格式的经济模型参数"
                />
                <Space style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button onClick={loadDefaultTokenomic} disabled={isTxInProgress}>加载默认参数</Button>
                    <Button
                        type="primary"
                        onClick={updateTokenomic}
                        loading={isTxInProgress}
                        disabled={!selectedAccount}
                    >
                        更新 (Sudo)
                    </Button>
                </Space>
            </Space>
        </Card>
    );
};

export default TokenomicEditor;