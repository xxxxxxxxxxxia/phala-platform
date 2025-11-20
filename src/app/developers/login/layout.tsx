'use client';

import { DeveloperAuthProvider } from '@/contexts/DeveloperAuthContext';

export default function DeveloperLoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DeveloperAuthProvider>
            {children}
        </DeveloperAuthProvider>
    );
}

