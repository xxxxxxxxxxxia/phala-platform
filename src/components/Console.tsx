// src/components/Console.tsx
import React from 'react';
import { Card } from 'antd';
import styles from '../styles/IncentiveFlow.module.css';

interface Props {
    lastResult: string;
}

const Console: React.FC<Props> = ({ lastResult }) => {
    return (
        <Card title="操作日志" styles={{ padding: 0 }}>
            <pre
                className={styles.consoleContentArea}
                style={{ maxHeight: '300px', borderRadius: '0 0 8px 8px' }} // 微调样式
                dangerouslySetInnerHTML={{ __html: lastResult }}
            />
        </Card>
    );
};

export default Console;