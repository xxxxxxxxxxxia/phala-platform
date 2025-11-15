#!/bin/bash

# 超高性能启动脚本 - 使用Turbo模式
echo "🚀 启动超高性能Next.js开发服务器 (Turbo模式)..."

# 设置环境变量优化开发体验
export NODE_ENV=development
export NEXT_TELEMETRY_DISABLED=1
export WATCHPACK_POLLING=false

# 清理缓存
echo "🧹 清理缓存..."
rm -rf .next
rm -rf node_modules/.cache

# 设置Node.js优化参数
export NODE_OPTIONS="--max-old-space-size=8192"

# 启动Turbo模式开发服务器
echo "⚡ 启动Turbo模式开发服务器..."
npx next dev --turbo --port 3000

# 如果Turbo失败，回退到普通模式
if [ $? -ne 0 ]; then
    echo "⚠️  Turbo模式失败，回退到普通模式..."
    npm run dev
fi
