# 链计算平台快速部署指南

## 🚀 一键部署

```bash
# 进入项目目录
cd /root/tmp/my-phala-platform

# 运行一键部署脚本
./deploy.sh
```

## 🔧 手动部署步骤

### 1. 停止现有容器
```bash
docker stop my-phala-platform-frontend
docker rm my-phala-platform-frontend
```

### 2. 修复服务器配置
```bash
# 确保 phala-blockchain-setup 目录存在
ls -la /root/tmp/phala-blockchain-setup/

# 修复 .env 文件
cd /root/tmp/phala-blockchain-setup
cat > .env << EOF
KEEP_TEST_FILES=1
ENDPOINT=ws://8.147.107.221:19944
WORKERS=http://8.147.107.221:18000
GKS=http://8.147.107.221:18000
EOF
```

### 3. 构建和启动
```bash
# 构建镜像
cd /root/tmp/my-phala-platform
docker build -t my-phala-platform-frontend .

# 启动容器（关键：使用 Host 网络模式）
docker run -d --name my-phala-platform-frontend \
  --network host \
  -v /root/tmp/phala-blockchain-setup:/app/phala-blockchain-setup:ro \
  my-phala-platform-frontend
```

### 4. 验证部署
```bash
# 检查服务状态
curl -I http://localhost:3000

# 测试隐私合约部署
curl -X POST http://localhost:3000/api/contracts/deploy-system \
  -H "Content-Type: application/json"
```

## ⚠️ 重要说明

1. **必须使用 Host 网络模式**：`--network host`
2. **必须挂载服务器目录**：`-v /root/tmp/phala-blockchain-setup:/app/phala-blockchain-setup:ro`
3. **确保 .env 文件使用正确的 IP 地址**，不是 localhost

## 🔍 故障排除

如果隐私合约部署失败：
1. 检查是否使用了 Host 网络模式
2. 检查服务器上的 .env 文件是否正确
3. 检查网络连接：`curl -I http://8.147.107.221:18000`

## 📞 技术支持

详细文档请参考：`DEPLOYMENT_GUIDE.md`
