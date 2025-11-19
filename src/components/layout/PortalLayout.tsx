'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './PortalLayout.module.css';

interface PortalLayoutProps {
    children: React.ReactNode;
}

const navLinks = [
    { label: '门户首页', href: '/' },
    { label: '资源提供方', href: '/providers' },
    { label: '应用开发者', href: '/developers' },
    { label: '系统管理端', href: '/management/login' },
    { label: '应用场景', href: '/#scenarios' },
    { label: '系统大屏', href: '/polkadot-wall' },
];

const PortalLayout: React.FC<PortalLayoutProps> = ({ children }) => {
    const pathname = usePathname();
    const router = useRouter();
    const [currentHash, setCurrentHash] = useState('');

    useEffect(() => {
        // 移除 body 的默认 margin/padding，避免黑框
        const body = document.body;
        const html = document.documentElement;

        // 保存原始样式
        const originalBodyMargin = body.style.margin;
        const originalBodyPadding = body.style.padding;
        const originalHtmlMargin = html.style.margin;
        const originalHtmlPadding = html.style.padding;

        // 设置样式去除黑框
        body.style.margin = '0';
        body.style.padding = '0';
        html.style.margin = '0';
        html.style.padding = '0';

        // 客户端获取 hash
        setCurrentHash(window.location.hash);

        const handleHashChange = () => {
            setCurrentHash(window.location.hash);
        };

        window.addEventListener('hashchange', handleHashChange);

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
            // 恢复原始样式（如果需要）
            body.style.margin = originalBodyMargin;
            body.style.padding = originalBodyPadding;
            html.style.margin = originalHtmlMargin;
            html.style.padding = originalHtmlPadding;
        };
    }, []);

    const handleNavClick = (href: string, e: React.MouseEvent) => {
        // 如果是应用场景链接（指向首页锚点），需要特殊处理
        if (href === '/#scenarios') {
            e.preventDefault();
            if (pathname === '/') {
                // 如果在首页，直接滚动到应用场景部分
                const element = document.querySelector('#scenarios');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    window.history.pushState(null, '', '#scenarios');
                    setCurrentHash('#scenarios');
                }
            } else {
                // 如果不在首页，跳转到首页的锚点，首页的 useEffect 会自动处理滚动
                router.push('/#scenarios');
            }
        }
    };

    // 判断当前页面是否激活
    const isActive = (href: string) => {
        if (href === '/') {
            return pathname === '/' && !currentHash;
        }
        if (href === '/#scenarios') {
            return pathname === '/' && currentHash === '#scenarios';
        }
        // 系统管理端：如果当前路径是 /management/login 或任何 /management 下的路径，都算激活
        if (href === '/management/login') {
            return pathname.startsWith('/management');
        }
        return pathname === href || pathname.startsWith(href + '/');
    };

    return (
        <div className={styles.portalLayout}>
            <div className={styles.portalBackdrop} />
            <header className={styles.header}>
                <Link href="/" className={styles.logo}>
                    <span>中国移动 · 链计算门户</span>
                </Link>
                <nav className={styles.nav}>
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`${styles.navLink} ${isActive(link.href) ? styles.navLinkActive : ''}`}
                            onClick={(e) => handleNavClick(link.href, e)}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
            </header>

            <main className={styles.main}>{children}</main>

            <footer className={styles.footer}>
                链计算平台门户 · Copyright © 中国移动 2025
            </footer>
        </div>
    );
};

export default PortalLayout;
