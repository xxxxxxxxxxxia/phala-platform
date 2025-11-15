'use client';

import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Select } from 'antd';
import { UserOutlined, LockOutlined, UserAddOutlined, SafetyOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import styles from './register.module.css';

const { Title, Text } = Typography;
const { Option } = Select;

interface RegisterForm {
    username: string;
    password: string;
    confirmPassword: string;
    role: string;
}

export default function RegisterPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const { isLoggedIn } = useAuth();
    const router = useRouter();
    const [form] = Form.useForm();

    // 如果已经登录，重定向到主页
    useEffect(() => {
        if (isLoggedIn) {
            router.push('/');
        }
    }, [isLoggedIn, router]);

    const onFinish = async (values: RegisterForm) => {
        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            // 获取 API URL，优先使用环境变量，否则使用默认值
            // 支持本地开发环境 (127.0.0.1:8888) 和生产环境配置
            const apiUrl = 
                typeof window !== 'undefined' 
                    ? (window as any).__API_URL__ || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8888'
                    : 'http://127.0.0.1:8888';
            
            const response = await fetch(`${apiUrl}/api/user/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: values.username,
                    password: values.password,
                    role: values.role || 'developer',
                }),
            });

            const data = await response.json();

            if (response.ok && data.code === '200') {
                setSuccess(true);
                // 注册成功后，延迟跳转到登录页
                setTimeout(() => {
                    router.push('/login');
                }, 2000);
            } else {
                setError(data.message || '注册失败，请重试');
            }
        } catch (err: any) {
            console.error('Register error:', err);
            setError(err.message || '注册失败，请检查网络连接');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.registerContainer}>
            <div className={styles.registerBackground}></div>
            <div className={styles.registerCard}>
                <Card className={styles.card}>
                    <div className={styles.registerHeader}>
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
                        form={form}
                        name="register"
                        onFinish={onFinish}
                        autoComplete="off"
                        size="large"
                        className={styles.registerForm}
                    >
                        <Form.Item
                            name="username"
                            rules={[
                                { required: true, message: '请输入用户名' },
                                { min: 3, message: '用户名长度至少为3个字符' },
                                { max: 50, message: '用户名长度不能超过50个字符' },
                            ]}
                        >
                            <Input
                                prefix={<UserOutlined />}
                                placeholder="用户名（3-50个字符）"
                                className={styles.input}
                            />
                        </Form.Item>

                        <Form.Item
                            name="role"
                            rules={[
                                { required: true, message: '请选择用户身份' },
                            ]}
                        >
                            <Select
                                placeholder="请选择用户身份"
                                className={styles.select}
                                suffixIcon={<SafetyOutlined />}
                            >
                                <Option value="developer">应用开发者</Option>
                                <Option value="provider">资源提供者</Option>
                                <Option value="admin">管理员</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="password"
                            rules={[
                                { required: true, message: '请输入密码' },
                                { min: 6, message: '密码长度至少为6个字符' },
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="密码（至少6个字符）"
                                className={styles.input}
                            />
                        </Form.Item>

                        <Form.Item
                            name="confirmPassword"
                            dependencies={['password']}
                            rules={[
                                { required: true, message: '请确认密码' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('password') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('两次输入的密码不一致'));
                                    },
                                }),
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="确认密码"
                                className={styles.input}
                            />
                        </Form.Item>

                        {error && (
                            <Alert
                                message={error}
                                type="error"
                                showIcon
                                className={styles.alert}
                                closable
                                onClose={() => setError(null)}
                            />
                        )}

                        {success && (
                            <Alert
                                message="注册成功！正在跳转到登录页面..."
                                type="success"
                                showIcon
                                className={styles.alert}
                            />
                        )}

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={loading}
                                icon={<UserAddOutlined />}
                                className={styles.registerButton}
                                block
                            >
                                {loading ? '注册中...' : '注册'}
                            </Button>
                        </Form.Item>

                        <Form.Item className={styles.loginLink}>
                            <Text type="secondary" className={styles.loginLinkText}>
                                已有账号？{' '}
                                <Button
                                    type="link"
                                    onClick={() => router.push('/login')}
                                    className={styles.linkButton}
                                >
                                    立即登录
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

