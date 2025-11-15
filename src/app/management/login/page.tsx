'use client';

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import styles from './login.module.css';

const { Title, Text } = Typography;

interface LoginForm {
    username: string;
    password: string;
}

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login, isLoggedIn } = useAuth();
    const router = useRouter();

    // 如果已经登录，重定向到主页
    useEffect(() => {
        if (isLoggedIn) {
            router.push('/management');
        }
    }, [isLoggedIn, router]);

    const onFinish = async (values: LoginForm) => {
        setLoading(true);
        setError(null);

        try {
            const success = await login(values.username, values.password);

            if (success) {
                // 登录成功后立即跳转
                window.location.href = '/management';
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
            <div className={styles.loginCard}>
                <Card className={styles.card}>
                    <div className={styles.loginHeader}>
                        <div className={styles.logoContainer}>
                            <Image
                                src="/whitelogo.png"
                                alt="中国移动"
                                width={150}
                                height={100}
                                className={styles.logo}
                            />
                        </div>
                        <Title level={3} className={styles.title}>
                            链计算平台
                        </Title>
                        <Text type="secondary" className={styles.subtitle}>
                            基于 TEE 的隐私计算与调度平台
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

                        <Form.Item className={styles.registerLink}>
                            <Text type="secondary" className={styles.registerLinkText}>
                                还没有账号？{' '}
                                <Button
                                    type="link"
                                    onClick={() => router.push('/management/register')}
                                    className={styles.linkButton}
                                >
                                    立即注册
                                </Button>
                            </Text>
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
