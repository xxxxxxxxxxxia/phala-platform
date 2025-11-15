require('dotenv').config();

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { options, OnChainRegistry, signCertificate, PinkContractPromise } = require('@phala/sdk');
const fs = require('fs');
const path = require('path');

const NODE_URL = process.env.NODE_URL || 'ws://127.0.0.1:19944';
const CONTRACT_ID = '0xd62eac577584da5e0776e63e3bd9c0c8db8b411dc459d3eec903ff80e3b8eebf';

async function callTokenomicVersionSimple() {
  console.log(`📞 简化方式调用tokenomic-contract的version方法...`);
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
    const contractPath = '/home/user1/Desktop/tmp/phala-blockchain/my-phala-platform/public/sample_contracts/tokenomic.contract';
    let metadata = null;
    
    try {
      metadata = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      console.log('✅ 加载合约metadata成功');
    } catch (error) {
      console.log('⚠️ 无法加载metadata，使用简化方式');
    }

    // 5. 创建合约实例 - 使用更简单的方式
    let contract;
    if (metadata) {
      contract = new PinkContractPromise(api, phatRegistry, metadata, CONTRACT_ID);
    } else {
      // 尝试不使用metadata
      contract = new PinkContractPromise(api, phatRegistry, CONTRACT_ID);
    }
    console.log(`✅ 创建合约实例，合约ID: ${CONTRACT_ID}`);

    // 6. 尝试不同的调用方式
    console.log('📞 尝试调用version方法...');
    
    const methods = ['version', 'getVersion', 'info', 'getInfo'];
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
      
      // 尝试直接查询合约状态
      console.log('🔍 尝试查询合约状态...');
      try {
        const contractInfo = await api.query.phalaPhatContracts.contracts(CONTRACT_ID);
        console.log('合约信息:', contractInfo.toHuman());
      } catch (e) {
        console.log('查询合约状态也失败:', e.message);
      }
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
  callTokenomicVersionSimple()
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

module.exports = { callTokenomicVersionSimple };
