import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/prpc/:path*', // 匹配所有 /prpc 开头的请求
        destination: 'http://127.0.0.1:18000/prpc/:path*', // 代理到 pRuntime 服务
      },
    ];
  },
};

export default nextConfig;
