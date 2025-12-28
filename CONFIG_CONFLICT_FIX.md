# 配置冲突修复

## 🔍 问题发现

在 `next.config.js` 中发现**两个 `onDemandEntries` 配置**：

1. **第54-57行**：开发模式配置（60秒，1个页面）
2. **第209-212行**：生产模式配置（24小时，100个页面）

### 问题影响

- 第一个配置可能会覆盖或干扰第二个配置
- 导致缓存时间被设置为60秒，而不是24小时
- 页面在60秒后就被清除，导致用户访问变慢

## ✅ 修复方案

### 1. 删除第一个配置

**修改文件**：`next.config.js`

**删除**：
```javascript
// 开发模式优化 - 减少页面缓冲，降低内存和CPU占用
onDemandEntries: {
  maxInactiveAge: 60 * 1000, // 增加到60秒
  pagesBufferLength: 1, // 减少到1个页面，降低内存占用
},
```

**原因**：
- 这个配置会覆盖后面的正确配置
- 开发模式和生产模式应该使用相同的缓存策略
- 统一使用24小时缓存时间

### 2. 保留正确的配置

**保留**：
```javascript
// 优化页面缓存，减少跳转延迟
// 关键：设置非常大的缓存时间，确保页面编译后一直保留在内存中，不被自动清除
onDemandEntries: {
  maxInactiveAge: 60 * 1000 * 60 * 24,  // 24小时（86400000ms）
  pagesBufferLength: 100,                // 100个页面
},
```

## 📊 修复效果

### 修复前
- 缓存时间：60秒（被第一个配置覆盖）
- 页面数量：1个
- 结果：页面很快被清除，用户访问变慢

### 修复后
- 缓存时间：24小时
- 页面数量：100个
- 结果：页面一直保留在内存中，所有用户都能快速访问

## 🔍 验证方法

```bash
# 检查配置
docker logs phala-platform-frontend | grep "onDemandEntries"

# 应该显示：
# 📦 onDemandEntries: maxInactiveAge=86400000ms (1440分钟), pagesBufferLength=100

# 测试性能
for i in {1..10}; do
  curl -w "用户$i: %{time_total}s\n" -o /dev/null -s http://localhost:3000/
  sleep 1
done

# 所有用户都应该在 0.05-0.1 秒内
```

## ⚠️ 注意事项

1. **配置唯一性**：确保 `onDemandEntries` 配置只出现一次
2. **统一策略**：开发模式和生产模式使用相同的缓存策略
3. **定期检查**：确保配置没有被意外修改

