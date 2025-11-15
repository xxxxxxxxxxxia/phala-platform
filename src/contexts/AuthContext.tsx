'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
    username: string;
}

interface AuthContextType {
    user: User | null;
    isLoggedIn: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // 检查本地存储中的登录状态
        const checkAuthStatus = () => {
            try {
                // 确保在客户端环境中
                if (typeof window !== 'undefined') {
                    const isLoggedInStorage = localStorage.getItem('isLoggedIn');
                    const userStorage = localStorage.getItem('user');

                    if (isLoggedInStorage === 'true' && userStorage) {
                        const userData = JSON.parse(userStorage);
                        setUser(userData);
                        setIsLoggedIn(true);
                    }
                }
            } catch (error) {
                console.error('Error checking auth status:', error);
                // 清除可能损坏的数据
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('isLoggedIn');
                    localStorage.removeItem('user');
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

                // 确保在客户端环境中操作本地存储
                if (typeof window !== 'undefined') {
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('user', JSON.stringify(userData));
                }

                // 然后更新状态
                setUser(userData);
                setIsLoggedIn(true);

                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        setIsLoggedIn(false);

        // 清除本地存储
        if (typeof window !== 'undefined') {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('user');
        }

        // 跳转到登录页
        router.push('/login');
    };

    const value: AuthContextType = {
        user,
        isLoggedIn,
        login,
        logout,
        loading,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
