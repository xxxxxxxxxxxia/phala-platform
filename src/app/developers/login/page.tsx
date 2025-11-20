'use client';

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useDeveloperAuth } from '@/contexts/DeveloperAuthContext';
import Image from 'next/image';
import styles from './login.module.css';

const { Title, Text } = Typography;

interface LoginForm {
    username: string;
    password: string;
}

export default function DeveloperLoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login, isLoggedIn } = useDeveloperAuth();
    const router = useRouter();

    // 如果已经登录，重定向到开发者应用列表
    useEffect(() => {
        if (isLoggedIn) {
            router.push('/developers/start');
        }
    }, [isLoggedIn, router]);

    const onFinish = async (values: LoginForm) => {
        setLoading(true);
        setError(null);

        try {
            const success = await login(values.username, values.password);

            if (success) {
                // 登录成功后立即跳转到开发者应用列表
                window.location.href = '/developers/start';
            } else {
                setError('用户名或密码错误');
            }
        } catch (err) {
            setError('登录失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.loginContainer}>
            <div className={styles.loginBackground}></div>
            <header className={styles.topHeader}>
                <div className={styles.headerContent}>
                    <div className={styles.headerTitle}>
                        中国移动 · 链计算门户
                    </div>
                    <nav className={styles.headerNav}>
                        <a href="/" className={styles.navItem}>门户首页</a>
                        <a href="/providers" className={styles.navItem}>资源提供方</a>
                        <a href="/developers" className={`${styles.navItem} ${styles.navItemActive}`}>应用开发者</a>
                        <a href="/management/login" className={styles.navItem}>系统管理端</a>
                        <a href="/#scenarios" className={styles.navItem}>应用场景</a>
                        <a href="/polkadot-wall" className={styles.navItem}>系统大屏</a>
                    </nav>
                </div>
            </header>
            <div className={styles.loginCard}>
                <Link href="/developers" className={styles.backLink}>
                    <ArrowLeftOutlined />
                    <span>返回开发者中心</span>
                </Link>
                <Card className={styles.card}>
                    <div className={styles.loginHeader}>
                        <div className={styles.logoContainer}>
                            <Image
                                src="/china-mobile.jpg"
                                alt="中国移动"
                                width={225}
                                height={150}
                                className={styles.logo}
                            />
                        </div>
                        <Title level={3} className={styles.title}>
                            开发者中心
                        </Title>
                        <Text type="secondary" className={styles.subtitle}>
                            自主可信应用管理平台
                        </Text>
                    </div>

                    <Form
                        name="login"
                        onFinish={onFinish}
                        autoComplete="off"
                        size="large"
                        className={styles.loginForm}
                    >
                        <Form.Item
                            name="username"
                            rules={[
                                { required: true, message: '请输入用户名' },
                            ]}
                        >
                            <Input
                                prefix={<UserOutlined />}
                                placeholder="用户名"
                                className={styles.input}
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[
                                { required: true, message: '请输入密码' },
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="密码"
                                className={styles.input}
                            />
                        </Form.Item>

                        {error && (
                            <Alert
                                message={error}
                                type="error"
                                showIcon
                                className={styles.alert}
                            />
                        )}

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<LoginOutlined />}
                                className={styles.loginButton}
                                block
                            >
                                {loading ? '登录中...' : '登录'}
                            </Button>
                        </Form.Item>
                    </Form>

                    <div className={styles.copyright}>
                        <Text type="secondary" className={styles.copyrightText}>
                            版权所有  (C)  2025 中国移动
                        </Text>
                    </div>

                </Card>
            </div>
        </div>
    );
}
