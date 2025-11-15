# 合约管理脚本

这个文件夹包含了用于合约管理的各种脚本。

## 脚本说明

### 1. deploy_single_contract.js
- **用途**: 部署单个合约
- **参数**: 合约文件路径, 合约名称
- **用法**: `node deploy_single_contract.js <合约文件路径> <合约名称>`

### 2. call_tokenomic_simple.js
- **用途**: 简化方式调用tokenomic合约的version方法
- **功能**: 测试合约是否支持version方法调用

### 3. call_tokenomic_version.js
- **用途**: 调用tokenomic合约的version方法
- **功能**: 查询合约版本信息

### 4. call_new_tokenomic.js
- **用途**: 调用新部署的tokenomic合约
- **功能**: 测试新部署合约的方法调用

### 5. test_token_deployment.js
- **用途**: 测试token合约部署
- **功能**: 验证合约部署流程

### 6. test_tokenomic_api.js
- **用途**: 测试tokenomic API调用
- **功能**: 验证API接口功能

## 环境变量

这些脚本需要以下环境变量：
- `NODE_URL`: 区块链节点URL (默认: ws://localhost:19944)
- `PRUNTIME_URL`: pRuntime URL (默认: http://localhost:18000)

## 使用方法

```bash
# 设置环境变量
export NODE_URL=ws://localhost:19944
export PRUNTIME_URL=http://localhost:18000

# 运行脚本
node deploy_single_contract.js /path/to/contract.contract "MyContract"
node call_tokenomic_simple.js
node call_tokenomic_version.js
```

## 注意事项

1. 确保区块链节点正在运行
2. 确保pRuntime服务正在运行
3. 确保pherry服务正在运行
4. 脚本需要适当的权限和依赖
