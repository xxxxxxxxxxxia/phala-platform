// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AntdRegistry from "@/lib/AntdRegistry";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "链计算隐私平台",
  description: "基于 TEE 的隐私计算与调度平台",
};

// 优化：强制静态生成根布局，避免服务端渲染阻塞
// 注意：Next.js 15在某些情况下仍会尝试服务端fetch，需要额外配置
export const dynamic = 'force-static';
export const revalidate = false;
// 禁用服务端数据获取，完全静态生成
export const fetchCache = 'force-no-store';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* 用 Registry 包裹你的 children */}
        <AntdRegistry>
          <AuthProvider>
            {children}
          </AuthProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
