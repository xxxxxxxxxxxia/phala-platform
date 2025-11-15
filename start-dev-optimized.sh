#!/bin/bash

# 优化的开发环境启动脚本
echo "🚀 启动优化的Next.js开发服务器..."

# 设置环境变量优化开发体验
export NODE_ENV=development
export NEXT_TELEMETRY_DISABLED=1
export WATCHPACK_POLLING=false

# 清理缓存
echo "🧹 清理缓存..."
rm -rf .next
rm -rf node_modules/.cache

# 设置Node.js优化参数
export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"

# 启动开发服务器，使用优化的参数
echo "⚡ 启动开发服务器（优化模式）..."
npm run dev -- --turbo --port 3000

# 如果turbo失败，回退到普通模式
if [ $? -ne 0 ]; then
    echo "⚠️  Turbo模式失败，回退到普通模式..."
    npm run dev -- --port 3000
fi
