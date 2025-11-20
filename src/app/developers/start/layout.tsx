'use client';

import { DeveloperAuthProvider } from '@/contexts/DeveloperAuthContext';

export default function DevelopersStartLayout({
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

