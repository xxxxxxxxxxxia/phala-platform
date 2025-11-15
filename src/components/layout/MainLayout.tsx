'use client';

// 1. 核心修正：修复了此处的 'in' 语法错误
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  PieChartOutlined, DesktopOutlined, GlobalOutlined, FileProtectOutlined, WalletOutlined,
  SettingOutlined, KeyOutlined, BookOutlined, CodeOutlined, DeploymentUnitOutlined,
  QuestionCircleOutlined, InfoCircleOutlined, AppstoreOutlined, MonitorOutlined, TrophyOutlined,
  SecurityScanOutlined, LinkOutlined, SafetyCertificateOutlined, ThunderboltOutlined,
  LogoutOutlined, UserOutlined
} from '@ant-design/icons';
import { Layout, ConfigProvider, theme, Button, Dropdown, Space } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
// 确保您的 CSS 文件名是 Mainlayout.module.css，如果不是请修改这里的导入路径
import styles from './Mainlayout.module.css';
import DataInitializer from '../DataInitializer';

const { Header, Content, Footer, Sider } = Layout;
const { darkAlgorithm } = theme;

// 菜单项已按您的要求更新
const menuItems = [
  { label: '系统总览', key: '/', icon: <PieChartOutlined /> },
  { label: '可信验证', key: '/tee-verification', icon: <SafetyCertificateOutlined /> },
  { label: '安全调度', key: '/scheduling', icon: <ThunderboltOutlined /> },
  { label: '响应监控', key: '/monitoring', icon: <MonitorOutlined /> },
  { label: '密钥管理', key: '/key-rotation', icon: <KeyOutlined /> },
  { label: '激励机制', key: '/incentives', icon: <TrophyOutlined /> },
  { label: '隐私合约', key: '/contracts', icon: <FileProtectOutlined /> },
  { label: '开发接口', key: '/tools', icon: <CodeOutlined /> },
  { label: '系统帮助', key: '/docs', icon: <QuestionCircleOutlined /> },
];

// 2. 最佳实践修正：将 children 的类型修正为 React.ReactNode
const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // 页面标题映射已同步更新
  const pageTitles: { [key: string]: string } = {
    '/': '系统总览',
    '/workers': '节点管理',
    '/tee-verification': '可信验证',
    '/scheduling': '安全调度',
    '/monitoring': '响应监控',
    '/contracts': '隐私合约',
    '/key-rotation': '密钥管理',
    '/incentives': '激励机制',
    '/tools': '开发接口',
    '/docs': '系统帮助',
  };
  const pageTitle = pageTitles[pathname] || '链计算隐私平台';

  return (
    <ConfigProvider
      theme={{
        algorithm: darkAlgorithm,
        token: {
          colorPrimary: '#9f2cff',
          colorText: 'rgba(255, 255, 255, 0.85)',
          colorBgContainer: 'transparent',
        },
        components: {
          Layout: {
            siderBg: 'rgba(15, 16, 34, 0.8)',
            bodyBg: 'transparent',
            headerBg: 'transparent',
            footerBg: 'transparent',
          },
          Card: {
            colorText: 'rgba(255, 255, 255, 0.85)',
            colorTextHeading: '#FFFFFF',
          },
          Statistic: {
            colorText: 'rgba(255, 255, 255, 0.85)',
            colorTextHeading: '#FFFFFF',
          }
        }
      }}
    >
      <DataInitializer />
      <Layout style={{ minHeight: '100vh', background: 'transparent' }} key={pathname}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          width={220}
          collapsedWidth={80}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            backdropFilter: 'blur(10px)',
            borderRight: '1px solid rgba(159, 44, 255, 0.3)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
              height: collapsed ? 60 : 80,
              margin: collapsed ? 12 : 16,
              background: 'rgba(255, 255, 255, 0.1)',
              textAlign: 'center',
              color: 'white',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px'
            }}>
              <Link href="/" style={{ color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                <Image
                  src="/whitelogo.png"
                  alt="链计算平台"
                  width={collapsed ? 88 : 128}
                  height={collapsed ? 88 : 128}
                  priority={true}
                  quality={100}
                  style={{
                    borderRadius: '6px',
                    objectFit: 'contain',
                    width: '90%',
                    height: '90%',
                    imageRendering: 'high-quality'
                  }}
                />
              </Link>
            </div>
            <nav className={styles.customMenu} style={{ flexGrow: 1 }}>
              {menuItems.map(item => (
                <Link
                  key={item.key}
                  href={item.key}
                  className={`${styles.menuItem} ${pathname === item.key ? styles.active : ''}`}
                >
                  <span className={styles.menuIcon}>{item.icon}</span>
                  {!collapsed && <span className={styles.menuLabel}>{item.label}</span>}
                </Link>
              ))}
            </nav>
          </div>
        </Sider>
        <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s', background: 'transparent' }}>
          <Header style={{
            padding: '0 24px',
            background: 'rgba(15, 16, 34, 0.9)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(159, 44, 255, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '64px',
            position: 'sticky',
            top: 0,
            zIndex: 100
          }}>
            <h1 style={{ margin: 0, color: 'white', fontSize: '28px', fontWeight: 'bold' }}>中国移动链计算平台</h1>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'user',
                    label: (
                      <Space>
                        <UserOutlined />
                        {user?.username}
                      </Space>
                    ),
                    disabled: true,
                  },
                  {
                    type: 'divider',
                  },
                  {
                    key: 'logout',
                    label: (
                      <Space>
                        <LogoutOutlined />
                        退出登录
                      </Space>
                    ),
                    onClick: logout,
                  },
                ],
              }}
              placement="bottomRight"
            >
              <Button
                type="text"
                icon={<UserOutlined />}
                style={{
                  color: 'rgba(255, 255, 255, 0.85)',
                  display: 'flex',
                  alignItems: 'center',
                  height: '40px'
                }}
              >
                {user?.username}
              </Button>
            </Dropdown>
          </Header>
          <Content style={{ padding: '24px 16px 16px', overflow: 'initial' }}>
            {children}
          </Content>
          <Footer style={{ textAlign: 'center', background: 'transparent' }}>
            链计算平台 版权所有（C）中国移动 ，2025. Blockchain-based Computing Platform，All Rights Reserved （C）China Mobile Co..Ltd，2025.
          </Footer>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default MainLayout;