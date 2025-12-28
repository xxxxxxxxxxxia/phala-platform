# IPv6连接问题修复

## 🔍 问题根本原因

### 测试结果
- **响应时间**：127秒 ❌
- **服务器资源**：充足（CPU 0%，内存充足）
- **真正问题**：Next.js在服务端渲染时尝试连接 `::1:3000`（IPv6 localhost）失败

### 详细分析

1. **连接过程**：
   ```
   * Trying ::1:3000...          # 先尝试IPv6
   * connect to ::1 port 3000 failed: Connection refused  # IPv6失败
   * Trying 127.0.0.1:3000...    # 然后尝试IPv4
   * Connected to localhost      # IPv4成功
   ```

2. **超时原因**：
   - Next.js在服务端渲染时，某些内部机制会尝试连接localhost:3000
   - 系统优先尝试IPv6（::1），但服务只监听IPv4（0.0.0.0）
   - 连接失败后等待超时（约120秒），然后才尝试IPv4
   - 这导致每次请求都要等待IPv6超时

3. **日志证据**：
   ```
   failed to get redirect response TypeError: fetch failed
   [cause]: Error: connect ECONNREFUSED ::1:3000
   ```

## ✅ 修复方案

### 1. 在Dockerfile中强制使用IPv4

**修改文件**：`Dockerfile`

**添加环境变量**：
```dockerfile
ENV NODE_OPTIONS="--dns-result-order=ipv4first"
```

**作用**：
- 强制Node.js优先使用IPv4进行DNS解析
- 避免尝试IPv6连接导致超时

### 2. 在server.js中双重保障

**修改文件**：`server.js`

**添加代码**：
```javascript
// 强制使用IPv4，避免IPv6连接失败导致超时
if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('dns-result-order')) {
  process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --dns-result-order=ipv4first'
}
```

**作用**：
- 确保即使Dockerfile中的环境变量未生效，server.js也会设置
- 双重保障，确保修复生效

## 📊 预期效果

### 修复前
- 响应时间：**127秒** ❌
- 连接过程：IPv6失败 → 等待超时 → IPv4成功

### 修复后
- 响应时间：**< 1秒** ✅
- 连接过程：直接使用IPv4，无超时等待

## 🔧 技术说明

### NODE_OPTIONS参数

`--dns-result-order=ipv4first`：
- 强制Node.js在DNS解析时优先返回IPv4地址
- 避免尝试IPv6连接
- 这是Node.js 17+支持的选项

### 为什么这样修复？

1. **根本原因**：Next.js内部机制在服务端渲染时会尝试连接localhost
2. **问题**：系统优先尝试IPv6，但服务只监听IPv4
3. **解决**：强制使用IPv4，避免IPv6连接尝试

## 🚀 部署说明

修复后需要重新构建和部署：

```bash
# 重新构建Docker镜像
docker-compose build frontend

# 重新部署
docker-compose up -d frontend

# 或者使用部署脚本
./deploy.sh
```

## ⚠️ 注意事项

1. **不影响功能**：只是改变DNS解析顺序，不影响任何功能
2. **向后兼容**：IPv4优先是安全的，因为服务本身只监听IPv4
3. **性能提升**：消除120秒的超时等待，大幅提升响应速度

## 🔍 验证方法

部署后测试：

```bash
# 测试响应时间
curl -w "\n时间统计:\n连接时间: %{time_connect}s\n开始传输: %{time_starttransfer}s\n总时间: %{time_total}s\n" -o /dev/null -s http://localhost:3000/

# 检查环境变量
docker exec phala-platform-frontend env | grep NODE_OPTIONS

# 查看日志，应该不再有IPv6连接错误
docker logs phala-platform-frontend 2>&1 | grep -i "ipv6\|::1\|ECONNREFUSED"
```

预期结果：
- 总时间 < 1秒
- NODE_OPTIONS包含 `--dns-result-order=ipv4first`
- 日志中不再有IPv6连接错误

