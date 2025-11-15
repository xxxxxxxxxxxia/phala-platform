require('dotenv').config();

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { options, OnChainRegistry, signCertificate, PinkContractPromise } = require('@phala/sdk');
const fs = require('fs');

const NODE_URL = process.env.NODE_URL || 'ws://127.0.0.1:19944';
const PRUNTIME_URL = process.env.PRUNTIME_URL || 'http://127.0.0.1:18000';

// 新部署的合约ID
const CONTRACT_ID = '0x489467e323fb990ec3238e12a80a6bfe29c83e37cd259f626ae291183042990e';

async function callNewTokenomicVersion() {
  console.log(`📞 调用新部署的tokenomic-contract的version方法...`);
  let api;

  try {
    // 1. 连接到Phala节点
    api = await ApiPromise.create(options({
      provider: new WsProvider(NODE_URL),
      noInitWarn: true,
    }));
    await api.isReady;
    console.log('✅ 已连接到Phala节点');

    // 2. 创建链上注册表
    const phatRegistry = await OnChainRegistry.create(api);
    console.log('✅ 链上注册表创建成功');

    // 3. 准备账户
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    const certAlice = await signCertificate({ pair: alice });
    console.log(`✅ 使用账户: ${alice.address}`);

    // 4. 加载合约metadata
    const contractPath = './res/tokenomic.contract';
    const metadata = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    console.log(`✅ 加载合约metadata: ${metadata.contract.name}`);

    // 5. 创建合约实例
    const contract = new PinkContractPromise(api, phatRegistry, metadata, CONTRACT_ID);
    console.log(`✅ 创建合约实例，合约ID: ${CONTRACT_ID}`);

    // 6. 尝试调用不同的方法
    console.log('📞 尝试调用合约方法...');
    
    const methods = ['version', 'getVersion', 'info', 'getInfo', 'name', 'getName'];
    let success = false;
    let result = null;
    
    for (const method of methods) {
      try {
        console.log(`尝试方法: ${method}`);
        const queryResult = await contract.query[method](alice.address, { cert: certAlice });
        
        if (queryResult.output && queryResult.output.isOk) {
          result = queryResult.output.asOk.toPrimitive();
          console.log(`✅ 方法 ${method} 调用成功！`);
          console.log(`📋 返回结果: ${JSON.stringify(result, null, 2)}`);
          
          if (Array.isArray(result)) {
            console.log(`📊 版本信息: ${result.join('.')}`);
            console.log(`📋 详细结果: [${result.join(', ')}]`);
          }
          
          success = true;
          break;
        } else if (queryResult.output && queryResult.output.isErr) {
          console.log(`❌ 方法 ${method} 返回错误: ${queryResult.output.asErr.toPrimitive()}`);
        }
      } catch (error) {
        console.log(`❌ 方法 ${method} 调用失败: ${error.message}`);
      }
    }
    
    if (!success) {
      console.log('❌ 所有方法都调用失败');
      
      // 显示合约的所有可用方法
      console.log('📋 合约可用方法:');
      const availableMethods = Object.keys(contract.query);
      availableMethods.forEach((method, index) => {
        console.log(`   ${index + 1}. ${method}`);
      });
    }

    return {
      success,
      result,
      contractId: CONTRACT_ID
    };

  } catch (error) {
    console.error('❌ 调用失败:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (api && api.isConnected) {
      await api.disconnect();
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  callNewTokenomicVersion()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 调用完成！');
        console.log(`合约ID: ${result.contractId}`);
        console.log(`结果: ${JSON.stringify(result.result, null, 2)}`);
      } else {
        console.log('\n❌ 调用失败:', result.error);
        process.exit(1);
      }
    })
    .catch(console.error);
}

module.exports = { callNewTokenomicVersion };


