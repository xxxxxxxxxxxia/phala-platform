'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDeveloperAuth } from '@/contexts/DeveloperAuthContext';
import { Spin } from 'antd';

interface DeveloperAuthGuardProps {
    children: React.ReactNode;
}

const DeveloperAuthGuard: React.FC<DeveloperAuthGuardProps> = ({ children }) => {
    const { isLoggedIn, loading } = useDeveloperAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !isLoggedIn) {
            router.push('/developers/login');
        }
    }, [isLoggedIn, loading, router]);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: 'radial-gradient(ellipse at center, #101a35 0%, #030613 100%)'
            }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!isLoggedIn) {
        return null;
    }

    return <>{children}</>;
};

export default DeveloperAuthGuard;

