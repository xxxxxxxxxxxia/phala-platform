'use client';

import React from 'react';
import { Result, Button } from 'antd';
import { RadarChartOutlined } from '@ant-design/icons';
import Link from 'next/link';

/**
 * 开发模式占位页面 - 跳过数据大屏编译以提升开发服务器性能
 * 生产环境会自动使用完整的 page.tsx
 */
export default function PolkadotWallPageDev() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '48px',
        }}>
            <Result
                icon={<RadarChartOutlined style={{ fontSize: 72, color: '#fff' }} />}
                title={
                    <span style={{ color: '#fff', fontSize: '24px' }}>
                        数据大屏（开发模式已禁用）
                    </span>
                }
                subTitle={
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px' }}>
                        为了提升开发服务器性能，数据大屏在开发模式下已禁用编译。
                        <br />
                        如需查看完整功能，请使用生产模式构建：npm run build && npm start
                    </span>
                }
                extra={[
                    <Link href="/" key="home">
                        <Button type="primary" size="large" style={{ background: '#fff', color: '#667eea' }}>
                            返回首页
                        </Button>
                    </Link>,
                ]}
            />
        </div>
    );
}


