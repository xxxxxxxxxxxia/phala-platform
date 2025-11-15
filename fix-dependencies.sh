#!/bin/bash

echo "🔧 修复依赖冲突问题..."

# 进入项目目录
cd /root/tmp/my-phala-platform

echo "📦 清理现有的 node_modules..."
rm -rf node_modules
rm -rf package-lock.json
rm -rf pnpm-lock.yaml

echo "🔄 重新安装依赖..."
npm install

echo "🔧 尝试修复依赖冲突..."
npm dedupe

echo "✅ 依赖修复完成！"
echo ""
echo "如果仍有问题，请尝试："
echo "1. npm ls @polkadot/api"
echo "2. npm ls @phala/sdk"
echo "3. 检查版本是否一致"


