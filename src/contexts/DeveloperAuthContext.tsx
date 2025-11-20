'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface DeveloperUser {
    username: string;
}

interface DeveloperAuthContextType {
    user: DeveloperUser | null;
    isLoggedIn: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    loading: boolean;
}

const DeveloperAuthContext = createContext<DeveloperAuthContextType | undefined>(undefined);

export const useDeveloperAuth = () => {
    const context = useContext(DeveloperAuthContext);
    if (context === undefined) {
        throw new Error('useDeveloperAuth must be used within a DeveloperAuthProvider');
    }
    return context;
};

interface DeveloperAuthProviderProps {
    children: ReactNode;
}

export const DeveloperAuthProvider: React.FC<DeveloperAuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<DeveloperUser | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // 检查本地存储中的开发者登录状态（使用独立的键）
        const checkAuthStatus = () => {
            try {
                // 确保在客户端环境中
                if (typeof window !== 'undefined') {
                    const isLoggedInStorage = localStorage.getItem('developerIsLoggedIn');
                    const userStorage = localStorage.getItem('developerUser');

                    if (isLoggedInStorage === 'true' && userStorage) {
                        const userData = JSON.parse(userStorage);
                        setUser(userData);
                        setIsLoggedIn(true);
                    }
                }
            } catch (error) {
                console.error('Error checking developer auth status:', error);
                // 清除可能损坏的数据
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('developerIsLoggedIn');
                    localStorage.removeItem('developerUser');
                }
            } finally {
                setLoading(false);
            }
        };

        checkAuthStatus();
    }, []);

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            // 模拟登录验证
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (username === 'admin' && password === 'admin') {
                const userData = { username };

                // 确保在客户端环境中操作本地存储（使用独立的键）
                if (typeof window !== 'undefined') {
                    localStorage.setItem('developerIsLoggedIn', 'true');
                    localStorage.setItem('developerUser', JSON.stringify(userData));
                }

                // 然后更新状态
                setUser(userData);
                setIsLoggedIn(true);

                return true;
            }
            return false;
        } catch (error) {
            console.error('Developer login error:', error);
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        setIsLoggedIn(false);

        // 清除本地存储
        if (typeof window !== 'undefined') {
            localStorage.removeItem('developerIsLoggedIn');
            localStorage.removeItem('developerUser');
        }

        // 跳转到开发者登录页
        router.push('/developers/login');
    };

    const value: DeveloperAuthContextType = {
        user,
        isLoggedIn,
        login,
        logout,
        loading,
    };

    return (
        <DeveloperAuthContext.Provider value={value}>
            {children}
        </DeveloperAuthContext.Provider>
    );
};

