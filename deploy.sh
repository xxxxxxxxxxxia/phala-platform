#!/bin/bash

echo "🚀 开始部署链计算平台前端..."

# 1. 停止现有容器
echo "📦 停止现有容器..."
docker stop phala-platform-frontend 2>/dev/null || true
docker rm phala-platform-frontend 2>/dev/null || true

# 2. 检查 phala-blockchain-setup 目录
echo "🔍 检查 phala-blockchain-setup 目录..."
if [ ! -d "/root/tmp/phala-blockchain-setup" ]; then
    echo "❌ 错误：找不到 /root/tmp/phala-blockchain-setup 目录"
    echo "请确保服务器上有 phala-blockchain-setup 目录"
    exit 1
fi

# 3. 修复 .env 文件
# echo "🔧 修复 .env 文件..."
# cd /root/tmp/phala-blockchain-setup
# cat > .env << 'ENVEOF'
# KEEP_TEST_FILES=1
# ENDPOINT=ws://8.147.107.221:19944
# WORKERS=http://8.147.107.221:18000
# GKS=http://8.147.107.221:18000
# ENVEOF

# 4. 检查并构建基础镜像
echo "🔍 检查基础镜像 chain-base..."
cd /root/tmp/phala-platform

# 检查基础镜像是否存在
BASE_IMAGE_EXISTS=$(docker images -q chain-base:latest 2>/dev/null)

# 检查 package.json 和 package-lock.json 的修改时间
PACKAGE_MTIME=$(stat -c %Y package.json package-lock.json 2>/dev/null | sort -n | tail -1)
BASE_IMAGE_MTIME=$(docker inspect chain-base:latest --format='{{.Created}}' 2>/dev/null | xargs -I {} date -d {} +%s 2>/dev/null || echo 0)

# 如果基础镜像不存在，或者依赖文件比镜像新，则重新构建基础镜像
if [ -z "$BASE_IMAGE_EXISTS" ] || [ "$PACKAGE_MTIME" -gt "$BASE_IMAGE_MTIME" ]; then
    echo "🏗️ 构建基础镜像 chain-base（包含依赖）..."
    echo "   ⏱️  这可能需要几分钟，但只在依赖变化时执行..."
    docker build -f Dockerfile.base -t chain-base:latest .
    if [ $? -ne 0 ]; then
        echo "❌ 基础镜像构建失败"
        exit 1
    fi
    echo "✅ 基础镜像构建完成"
else
    echo "✅ 基础镜像 chain-base 已存在且依赖未变化，跳过构建"
fi

# 5. 构建应用镜像
echo "🏗️ 构建应用镜像 phala-platform-frontend..."
docker build -t phala-platform-frontend .

# 6. 启动容器（优化：添加资源限制和性能优化）
echo "🚀 启动容器..."
# 优化资源配置：增加CPU和内存，提升性能
# CPU: 3核心（服务器有4核心，留1核心给其他服务）
# 内存: 4GB（服务器有30GB，充足）
docker run -d --name phala-platform-frontend \
  --network host \
  --memory="4g" \
  --cpus="3" \
  --restart=unless-stopped \
  -e NODE_OPTIONS="--max-old-space-size=3072 --dns-result-order=ipv4first" \
  -v /root/tmp/phala-blockchain-setup:/app/phala-blockchain-setup:ro \
  phala-platform-frontend

# 7. 等待启动
echo "⏳ 等待服务启动..."
sleep 10

# 8. 验证部署
echo "✅ 验证部署..."
if curl -s http://localhost:3000 > /dev/null; then
    echo "🎉 部署成功！前端服务运行在 http://localhost:3000"
    echo "📋 容器状态："
    docker ps | grep phala-platform-frontend
else
    echo "❌ 部署失败，请检查日志："
    docker logs phala-platform-frontend
    exit 1
fi

echo "🔧 测试隐私合约部署功能..."
curl -X POST http://localhost:3000/api/contracts/deploy-system \
  -H "Content-Type: application/json" \
  -s | grep -q "success.*true" && echo "✅ 隐私合约部署功能正常" || echo "⚠️ 隐私合约部署功能可能有问题"

# 9. 清理悬空镜像（节省磁盘空间）
echo "🧹 清理悬空镜像..."
docker image prune -f > /dev/null 2>&1
echo "✅ 清理完成"

echo "🎯 部署完成！"
