'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from 'antd';
import styles from './PortalLayout.module.css';

interface PortalLayoutProps {
    children: React.ReactNode;
}

const navLinks = [
    { label: '门户首页', href: '/' },
    { label: '资源提供', href: '/providers' },
    { label: '应用开发', href: '/developers' },
    { label: '应用场景', href: '/scenarios' },
    { label: '链上大屏', href: '/polkadot-wall' },
];

const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
    return (
        <div className={styles.portalLayout}>
            <div className={styles.portalBackdrop} />
            <header className={styles.header}>
                <Link href="/" className={styles.logo}>
                    <span>中国移动 · 链计算门户</span>
                </Link>
                <nav className={styles.nav}>
                    {navLinks.map((link) => (
                        <Link key={link.href} href={link.href} className={styles.navLink}>
                            {link.label}
                        </Link>
                    ))}
                </nav>
                <Link href="/management/login">
                    <Button type="primary" className={styles.headerButton}>
                        进入管理端
                    </Button>
                </Link>
            </header>

            <main className={styles.main}>{children}</main>

            <footer className={styles.footer}>
                链计算平台门户 · Copyright © 中国移动 2025
            </footer>
        </div>
    );
};

export default PortalLayout;
