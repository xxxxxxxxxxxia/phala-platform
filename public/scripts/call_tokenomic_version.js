require('dotenv').config();

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { options, OnChainRegistry, signCertificate, PinkContractPromise } = require('@phala/sdk');
const fs = require('fs');
const path = require('path');

const NODE_URL = process.env.NODE_URL || 'ws://127.0.0.1:19944';
const PRUNTIME_URL = process.env.PRUNTIME_URL || 'http://127.0.0.1:18000';

// 合约ID从部署结果中获取
const CONTRACT_ID = '0xd62eac577584da5e0776e63e3bd9c0c8db8b411dc459d3eec903ff80e3b8eebf';

async function callTokenomicVersion() {
  console.log(`📞 调用tokenomic-contract的version方法...`);
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
    const metadata = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    console.log(`✅ 加载合约metadata: ${metadata.contract.name}`);

    // 5. 创建合约实例
    const contract = new PinkContractPromise(api, phatRegistry, metadata, CONTRACT_ID);
    console.log(`✅ 创建合约实例，合约ID: ${CONTRACT_ID}`);

    // 6. 调用version方法
    console.log('📞 调用version方法...');
    try {
      const { output: versionOutput } = await contract.query.version(alice.address, { cert: certAlice });
      
      if (versionOutput.isOk) {
        const result = versionOutput.asOk.toPrimitive();
        console.log('✅ version方法调用成功！');
        console.log(`📋 返回结果: ${JSON.stringify(result, null, 2)}`);
        
        // 如果结果是数组，显示每个元素
        if (Array.isArray(result)) {
          console.log('📊 版本信息:');
          result.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item}`);
          });
        } else {
          console.log(`📊 版本: ${result}`);
        }
      } else {
        console.log('❌ version方法调用失败:', versionOutput.asErr.toPrimitive());
      }
    } catch (error) {
      console.log('❌ 调用version方法时出错:', error.message);
      
      // 尝试其他可能的方法名
      console.log('🔍 尝试其他可能的方法...');
      
      try {
        const { output: getVersionOutput } = await contract.query.getVersion(alice.address, { cert: certAlice });
        console.log('✅ getVersion方法调用成功！');
        console.log(`📋 返回结果: ${JSON.stringify(getVersionOutput.asOk.toPrimitive(), null, 2)}`);
      } catch (e) {
        console.log('❌ getVersion方法也不存在');
      }
      
      try {
        const { output: infoOutput } = await contract.query.getInfo(alice.address, { cert: certAlice });
        console.log('✅ getInfo方法调用成功！');
        console.log(`📋 返回结果: ${JSON.stringify(infoOutput.asOk.toPrimitive(), null, 2)}`);
      } catch (e) {
        console.log('❌ getInfo方法也不存在');
      }
    }

    return {
      success: true,
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
  callTokenomicVersion()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 调用完成！');
        console.log(`合约ID: ${result.contractId}`);
      } else {
        console.log('\n❌ 调用失败:', result.error);
        process.exit(1);
      }
    })
    .catch(console.error);
}

module.exports = { callTokenomicVersion };
