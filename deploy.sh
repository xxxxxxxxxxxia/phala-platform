#!/bin/bash

echo "🚀 开始部署链计算平台前端..."

# 1. 停止现有容器
echo "📦 停止现有容器..."
docker stop my-phala-platform-frontend 2>/dev/null || true
docker rm my-phala-platform-frontend 2>/dev/null || true

# 2. 检查 phala-blockchain-setup 目录
echo "🔍 检查 phala-blockchain-setup 目录..."
if [ ! -d "/root/tmp/phala-blockchain-setup" ]; then
    echo "❌ 错误：找不到 /root/tmp/phala-blockchain-setup 目录"
    echo "请确保服务器上有 phala-blockchain-setup 目录"
    exit 1
fi

# 3. 修复 .env 文件
echo "🔧 修复 .env 文件..."
cd /root/tmp/phala-blockchain-setup
cat > .env << 'ENVEOF'
KEEP_TEST_FILES=1
ENDPOINT=ws://8.147.107.221:19944
WORKERS=http://8.147.107.221:18000
GKS=http://8.147.107.221:18000
ENVEOF

# 4. 构建镜像
echo "🏗️ 构建 Docker 镜像..."
cd /root/tmp/my-phala-platform
docker build -t my-phala-platform-frontend .

# 5. 启动容器
echo "🚀 启动容器..."
docker run -d --name my-phala-platform-frontend \
  --network host \
  -v /root/tmp/phala-blockchain-setup:/app/phala-blockchain-setup:ro \
  my-phala-platform-frontend

# 6. 等待启动
echo "⏳ 等待服务启动..."
sleep 10

# 7. 验证部署
echo "✅ 验证部署..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "🎉 部署成功！前端服务运行在 http://localhost:3000"
    echo "📋 容器状态："
    docker ps | grep my-phala-platform-frontend
else
    echo "❌ 部署失败，请检查日志："
    docker logs my-phala-platform-frontend
    exit 1
fi

echo "🔧 测试隐私合约部署功能..."
curl -X POST http://localhost:3000/api/contracts/deploy-system \
  -H "Content-Type: application/json" \
  -s | grep -q "success.*true" && echo "✅ 隐私合约部署功能正常" || echo "⚠️ 隐私合约部署功能可能有问题"

echo "🎯 部署完成！"
