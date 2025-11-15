# 链计算平台前端部署指南

## 📋 目录
- [快速更新部署](#快速更新部署)
- [完整重新部署](#完整重新部署)
- [隐私合约部署修复](#隐私合约部署修复)
- [Docker管理命令](#docker管理命令)
- [故障排除](#故障排除)
- [开发环境切换](#开发环境切换)

## 🚀 快速更新部署

### 1. 停止现有容器
```bash
# 停止并删除现有容器
docker stop my-phala-platform-frontend
docker rm my-phala-platform-frontend
```

### 2. 更新代码
```bash
# 进入项目目录
cd /root/tmp/my-phala-platform

# 拉取最新代码（如果使用Git）
git pull origin main

# 或者直接修改代码文件
```

### 3. 重新构建镜像
```bash
# 构建新的Docker镜像
docker build -t my-phala-platform-frontend .
```

### 4. 启动新容器（使用Host网络模式）
```bash
# 启动新容器（使用Host网络模式以支持隐私合约部署）
docker run -d --name my-phala-platform-frontend \
  --network host \
  -v /root/tmp/phala-blockchain-setup:/app/phala-blockchain-setup:ro \
  my-phala-platform-frontend
```

### 5. 验证部署
```bash
# 检查容器状态
docker ps | grep my-phala-platform-frontend

# 检查日志
docker logs my-phala-platform-frontend

# 测试访问
curl -I http://localhost:3000
```

---

## 🔧 隐私合约部署修复

### 问题描述
在容器化部署环境中，隐私合约部署功能可能失败，主要原因是：
1. Phala SDK 内部有硬编码的 `127.0.0.1:18000` 地址
2. 容器网络隔离导致无法访问外部服务
3. 环境变量传递问题

### 解决方案
使用 Docker Host 网络模式 + 挂载服务器上的 `phala-blockchain-setup` 目录

#### 1. 确保服务器上有 phala-blockchain-setup 目录
```bash
# 检查目录是否存在
ls -la /root/tmp/phala-blockchain-setup/

# 如果不存在，需要从其他地方复制或下载
```

#### 2. 修复服务器上的 .env 文件
```bash
# 编辑 .env 文件，确保使用正确的 IP 地址
cd /root/tmp/phala-blockchain-setup
cat > .env << EOF
KEEP_TEST_FILES=1
ENDPOINT=ws://8.147.107.221:19944
WORKERS=http://8.147.107.221:18000
GKS=http://8.147.107.221:18000
EOF
```

#### 3. 使用正确的 Docker 运行命令
```bash
# 停止现有容器
docker stop my-phala-platform-frontend
docker rm my-phala-platform-frontend

# 使用 Host 网络模式启动容器
docker run -d --name my-phala-platform-frontend \
  --network host \
  -v /root/tmp/phala-blockchain-setup:/app/phala-blockchain-setup:ro \
  my-phala-platform-frontend
```

#### 4. 验证隐私合约部署功能
```bash
# 测试合约部署 API
curl -X POST http://localhost:3000/api/contracts/deploy-system \
  -H "Content-Type: application/json"

# 检查返回结果，应该显示部署成功
```

### 关键配置说明
- `--network host`: 使用宿主机网络，避免容器网络隔离
- `-v /root/tmp/phala-blockchain-setup:/app/phala-blockchain-setup:ro`: 挂载服务器上的脚本目录
- `:ro`: 只读挂载，保护服务器上的原始文件

---

## 🔄 完整重新部署

### 1. 清理环境
```bash
# 停止所有相关进程
pkill -f "npm run dev"
pkill -f "next-server"

# 停止并删除容器
docker stop my-phala-platform-frontend 2>/dev/null || true
docker rm my-phala-platform-frontend 2>/dev/null || true

# 清理构建缓存
cd /root/tmp/my-phala-platform
rm -rf .next
rm -rf node_modules/.cache
```

### 2. 重新构建
```bash
# 构建生产版本
npm run build

# 构建Docker镜像
docker build -t my-phala-platform-frontend .
```

### 3. 启动服务（使用Host网络模式）
```bash
# 启动容器（使用Host网络模式以支持隐私合约部署）
docker run -d --name my-phala-platform-frontend \
  --network host \
  -v /root/tmp/phala-blockchain-setup:/app/phala-blockchain-setup:ro \
  my-phala-platform-frontend
```

---

## 🐳 Docker管理命令

### 容器管理
```bash
# 查看运行中的容器
docker ps

# 查看所有容器（包括停止的）
docker ps -a

# 查看特定容器
docker ps | grep my-phala-platform-frontend

# 停止容器
docker stop my-phala-platform-frontend

# 启动容器
docker start my-phala-platform-frontend

# 重启容器
docker restart my-phala-platform-frontend

# 删除容器
docker rm my-phala-platform-frontend

# 强制删除容器
docker rm -f my-phala-platform-frontend
```

### 镜像管理
```bash
# 查看镜像
docker images | grep my-phala-platform-frontend

# 删除镜像
docker rmi my-phala-platform-frontend

# 强制删除镜像
docker rmi -f my-phala-platform-frontend
```

### 日志和调试
```bash
# 查看容器日志
docker logs my-phala-platform-frontend

# 实时查看日志
docker logs -f my-phala-platform-frontend

# 进入容器内部
docker exec -it my-phala-platform-frontend sh

# 查看容器资源使用
docker stats my-phala-platform-frontend
```

---

## 🔧 故障排除

### 端口冲突
```bash
# 检查端口占用
netstat -tlnp | grep :3000

# 停止占用端口的进程
pkill -f "next-server"
pkill -f "npm run dev"

# 使用不同端口启动
docker run -d --name my-phala-platform-frontend -p 3001:3000 my-phala-platform-frontend
```

### 构建失败
```bash
# 清理Docker缓存
docker system prune -f

# 重新构建（不使用缓存）
docker build --no-cache -t my-phala-platform-frontend .

# 检查构建日志
docker build -t my-phala-platform-frontend . 2>&1 | tee build.log
```

### 容器启动失败
```bash
# 查看详细错误信息
docker logs my-phala-platform-frontend

# 检查镜像是否存在
docker images | grep my-phala-platform-frontend
```

### 隐私合约部署失败
```bash
# 问题：合约部署失败，错误信息显示连接 127.0.0.1:18000 失败
# 原因：Phala SDK 内部有硬编码的 localhost 地址

# 解决方案1：使用 Host 网络模式
docker stop my-phala-platform-frontend
docker rm my-phala-platform-frontend
docker run -d --name my-phala-platform-frontend \
  --network host \
  -v /root/tmp/phala-blockchain-setup:/app/phala-blockchain-setup:ro \
  my-phala-platform-frontend

# 解决方案2：检查服务器上的 .env 文件
cd /root/tmp/phala-blockchain-setup
cat .env
# 确保使用正确的 IP 地址而不是 localhost

# 解决方案3：验证网络连接
curl -I http://8.147.107.221:18000
curl -I http://8.147.107.221:19944

# 重新构建镜像
docker build -t my-phala-platform-frontend .
```

### 内存不足
```bash
# 清理Docker系统
docker system prune -a -f

# 清理未使用的镜像
docker image prune -a -f

# 清理未使用的容器
docker container prune -f
```

---

## 💻 开发环境切换

### 切换到开发模式
```bash
# 停止Docker容器
docker stop my-phala-platform-frontend

# 启动开发服务器
cd /root/tmp/my-phala-platform
npm run dev
```

### 切换回生产模式
```bash
# 停止开发服务器
pkill -f "npm run dev"

# 启动Docker容器
docker start my-phala-platform-frontend
```

---

## 📝 常用脚本

### 一键更新脚本
创建 `update.sh` 文件：
```bash
#!/bin/bash
echo "🔄 开始更新部署..."

# 停止现有容器
echo "⏹️ 停止现有容器..."
docker stop my-phala-platform-frontend 2>/dev/null || true
docker rm my-phala-platform-frontend 2>/dev/null || true

# 重新构建
echo "🔨 重新构建镜像..."
docker build -t my-phala-platform-frontend .

# 启动新容器
echo "🚀 启动新容器..."
docker run -d --name my-phala-platform-frontend -p 3000:3000 my-phala-platform-frontend

# 验证部署
echo "✅ 验证部署..."
sleep 5
docker ps | grep my-phala-platform-frontend
curl -I http://localhost:3000

echo "🎉 更新完成！"
```

### 使用脚本
```bash
# 给脚本执行权限
chmod +x update.sh

# 运行更新脚本
./update.sh
```

---

## 🚀 一键部署脚本

### 创建快速部署脚本
```bash
# 创建部署脚本
cat > /root/tmp/my-phala-platform/deploy.sh << 'EOF'
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
EOF

# 设置执行权限
chmod +x /root/tmp/my-phala-platform/deploy.sh
```

### 使用部署脚本
```bash
# 运行一键部署
cd /root/tmp/my-phala-platform
./deploy.sh
```

---

## 🔍 监控和维护

### 健康检查
```bash
# 检查容器健康状态
docker inspect my-phala-platform-frontend | grep -A 10 "Health"

# 检查应用响应
curl -s http://localhost:3000 | head -20

# 检查端口监听
netstat -tlnp | grep :3000
```

### 性能监控
```bash
# 查看容器资源使用
docker stats my-phala-platform-frontend

# 查看容器详细信息
docker inspect my-phala-platform-frontend
```

### 日志轮转
```bash
# 限制日志大小
docker run -d --name my-phala-platform-frontend \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -p 3000:3000 \
  my-phala-platform-frontend
```

---

## 📚 配置文件说明

### Dockerfile
- **多阶段构建**: 优化镜像大小
- **非root用户**: 提高安全性
- **生产依赖**: 减少镜像体积

### nginx.conf
- **反向代理**: 处理静态文件和API请求
- **Gzip压缩**: 优化传输性能
- **安全头**: 增强安全性

### docker-compose.yml
- **服务编排**: 管理多个容器
- **网络配置**: 容器间通信
- **健康检查**: 自动重启机制

---

## ⚠️ 注意事项

1. **数据持久化**: 当前配置未包含数据卷，重启容器会丢失数据
2. **环境变量**: 生产环境需要配置相应的环境变量
3. **SSL证书**: 生产环境建议配置HTTPS
4. **备份策略**: 定期备份重要数据和配置
5. **监控告警**: 建议配置监控和告警系统

---

## 🆘 紧急恢复

### 快速回滚
```bash
# 停止当前容器
docker stop my-phala-platform-frontend

# 启动开发服务器作为临时方案
cd /root/tmp/my-phala-platform
npm run dev
```

### 完全重置
```bash
# 清理所有相关资源
docker stop my-phala-platform-frontend
docker rm my-phala-platform-frontend
docker rmi my-phala-platform-frontend

# 重新开始部署流程
cd /root/tmp/my-phala-platform
docker build -t my-phala-platform-frontend .
docker run -d --name my-phala-platform-frontend -p 3000:3000 my-phala-platform-frontend
```

---

## 📞 技术支持

如遇到问题，请检查：
1. 容器日志：`docker logs my-phala-platform-frontend`
2. 系统资源：`docker stats`
3. 网络连接：`netstat -tlnp | grep :3000`
4. 构建日志：查看构建过程中的错误信息

---

## 🎯 隐私合约部署总结

### 问题解决方案
隐私合约部署失败的根本原因是 Phala SDK 内部有硬编码的 `127.0.0.1:18000` 地址，无法通过环境变量覆盖。

**最终解决方案**：
1. 使用 Docker Host 网络模式：`--network host`
2. 挂载服务器上的 `phala-blockchain-setup` 目录
3. 修复服务器上的 `.env` 文件，使用正确的IP地址

### 关键配置
```bash
# 正确的Docker运行命令
docker run -d --name my-phala-platform-frontend \
  --network host \
  -v /root/tmp/phala-blockchain-setup:/app/phala-blockchain-setup:ro \
  my-phala-platform-frontend
```

### 验证方法
```bash
# 测试隐私合约部署功能
curl -X POST http://localhost:3000/api/contracts/deploy-system \
  -H "Content-Type: application/json"
```

---

*最后更新：2025-10-18*
*版本：v1.1 - 修复隐私合约部署问题*

