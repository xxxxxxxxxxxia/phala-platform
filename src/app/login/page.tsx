'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginRedirectPage() {
    const router = useRouter();
    
    useEffect(() => {
        // 客户端重定向，避免服务端fetch阻塞
        router.replace('/management/login');
    }, [router]);
    
    return null;
}
