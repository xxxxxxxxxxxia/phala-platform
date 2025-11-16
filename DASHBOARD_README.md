# Phala Platform 数据大屏使用说明

## 📋 概述

数据大屏是 Phala Platform 的实时监控和可视化展示页面，提供一屏显示所有关键指标，包括：
- Worker 资源数据（SGX/CSV/AMD）
- 激励数据统计
- 合约数据
- 区块浏览器
- 密钥轮换状态
- 服务调度信息

## 🚀 启动流程

### 1. 确保依赖已安装

```bash
cd /root/tmp/phala-platform
npm install
```

### 2. 启动开发服务器

```bash
# 方式1：标准启动
npm run dev

# 方式2：优化启动（推荐）
npm run dev:optimized

# 方式3：Turbo 模式启动
npm run dev:turbo
```

### 3. 访问数据大屏

启动成功后，在浏览器中访问：
```
http://localhost:3000/polkadot-wall
```

或者访问生产环境：
```
http://8.147.107.221:3001/polkadot-wall
```

## 📁 文件结构

```
src/app/polkadot-wall/
├── page.tsx              # 数据大屏主页面组件
└── dashboard.module.css  # 数据大屏样式文件

src/app/api/dashboard/
├── summary/route.ts              # 核心指标汇总API
├── workers/monitor/route.ts      # Worker监控API
├── incentives/summary/route.ts   # 激励数据汇总API
├── blocks/latest/route.ts        # 最新区块列表API
├── transactions/latest/route.ts  # 最新交易列表API
└── key-rotation/stats/route.ts   # 密钥轮换统计API
```

## 🎨 功能特性

### 1. 顶部标题栏
- 显示平台名称和标题
- 实时显示当前时间（每秒更新）

### 2. 左侧列
- **Worker资源数据**：显示总节点数、在线节点、SGX/CSV节点统计，以及Worker列表
- **激励数据**：显示总激励金额、平均评分，以及奖励类型分布图表
- **合约数据**：显示总合约数、活跃合约数，以及合约类型统计

### 3. 中间主区域
- **核心指标**：区块高度、出块间隔、系统健康度、共识节点数
- **Worker分布饼图**：可视化展示不同TEE类型的Worker分布
- **区块浏览器**：显示最新区块列表和最新交易列表

### 4. 右侧列
- **密钥轮换**：显示密钥总数、活跃密钥、轮换中密钥，以及下次轮换信息
- **服务调度**：显示资源利用率和平均响应时间
- **Worker状态统计**：显示在线、离线、无响应节点数量

## 🔄 数据刷新

- 数据每 **10秒** 自动刷新一次
- 时间显示每 **1秒** 更新一次
- 所有数据均从真实区块链节点获取

## 🎯 API接口说明

### 核心指标汇总
```
GET /api/dashboard/summary
```
返回：区块链状态、Worker统计、合约统计、激励数据、系统健康度

### Worker监控
```
GET /api/dashboard/workers/monitor?teeType=all
```
参数：
- `teeType`: `all` | `SGX` | `CSV` | `AMD`

返回：Worker列表和统计信息

### 激励数据汇总
```
GET /api/dashboard/incentives/summary
```
返回：总激励金额、奖励类型分布、最近奖励记录

### 最新区块
```
GET /api/dashboard/blocks/latest?limit=5
```
参数：
- `limit`: 返回的区块数量（默认10）

返回：最新区块列表

### 最新交易
```
GET /api/dashboard/transactions/latest?limit=5
```
参数：
- `limit`: 返回的交易数量（默认10）

返回：最新交易列表

### 密钥轮换统计
```
GET /api/dashboard/key-rotation/stats
```
返回：密钥总数、活跃密钥、轮换中密钥、轮换时间信息

## 🎨 样式说明

数据大屏采用深色主题，主要特点：
- 背景：深蓝到黑色的径向渐变
- 卡片：半透明背景，紫色边框，毛玻璃效果
- 颜色方案：
  - 主色调：`#9f2cff` (紫色)
  - 强调色：`#00e5ff` (青色)
  - 成功色：`#52c41a` (绿色)
  - 警告色：`#faad14` (橙色)
  - 错误色：`#ff4d4f` (红色)

## 📱 响应式设计

数据大屏支持不同屏幕尺寸：
- **1920px+**: 完整布局，左右列各320px
- **1600px**: 左右列各300px
- **1366px**: 左右列各280px，统计行改为垂直布局

## ⚠️ 注意事项

1. **网络连接**：确保区块链节点（`ws://8.147.107.221:19944`）可访问
2. **性能优化**：数据大屏会并行请求多个API，首次加载可能需要几秒钟
3. **浏览器兼容**：建议使用 Chrome、Edge 或 Firefox 最新版本
4. **全屏显示**：数据大屏设计为全屏显示，建议使用 F11 进入全屏模式

## 🐛 故障排除

### 问题1：数据加载失败
**原因**：区块链节点连接失败
**解决**：检查 `src/lib/config.ts` 中的节点配置，确保节点可访问

### 问题2：页面空白
**原因**：API接口返回错误
**解决**：打开浏览器开发者工具（F12），查看Console和Network标签页的错误信息

### 问题3：样式显示异常
**原因**：CSS模块未正确加载
**解决**：重启开发服务器，清除浏览器缓存

### 问题4：图表不显示
**原因**：ECharts或@ant-design/plots未正确加载
**解决**：检查 `package.json` 中的依赖是否已安装

## 📝 开发说明

### 修改数据刷新间隔

在 `src/app/polkadot-wall/page.tsx` 中修改：
```typescript
const interval = setInterval(loadDashboardData, 10000); // 改为你想要的毫秒数
```

### 添加新的数据模块

1. 在 `src/app/api/dashboard/` 下创建新的API接口
2. 在 `page.tsx` 中添加数据获取逻辑
3. 在页面中添加对应的UI组件

### 自定义样式

修改 `src/app/polkadot-wall/dashboard.module.css` 文件，所有样式都使用CSS模块，不会影响其他页面。

## 🔗 相关链接

- 项目主README: `README.md`
- 部署指南: `DEPLOYMENT_GUIDE.md`
- 配置说明: `CONFIG.md`

## 📞 技术支持

如遇到问题，请检查：
1. 区块链节点连接状态
2. API接口响应状态
3. 浏览器控制台错误信息
4. 网络连接状态

---

*最后更新：2025-01-XX*
*版本：v1.0*

