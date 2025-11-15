// 测试Token合约部署脚本
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { options, OnChainRegistry, signCertificate, PinkCodePromise, signAndSend } = require('@phala/sdk');
const fs = require('fs');
const path = require('path');

const NODE_URL = process.env.NODE_URL || 'ws://127.0.0.1:19944';
const PRUNTIME_URL = process.env.PRUNTIME_URL || 'http://127.0.0.1:18000';

async function deployTokenContract() {
  console.log('🚀 开始部署Token合约...');
  let api;

  try {
    // 1. 连接到Phala节点
    console.log('📡 连接到Phala节点...');
    api = await ApiPromise.create(options({
      provider: new WsProvider(NODE_URL),
      noInitWarn: true,
    }));
    await api.isReady;
    console.log('✅ 已连接到Phala节点');

    // 2. 创建链上注册表
    console.log('📋 创建链上注册表...');
    const phatRegistry = await OnChainRegistry.create(api, { pruntimeURL: PRUNTIME_URL });
    console.log('✅ 链上注册表创建成功');

    // 3. 准备账户
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    const certAlice = await signCertificate({ pair: alice });
    console.log(`✅ 使用账户: ${alice.address}`);

    // 4. 加载token合约
    const contractPath = path.resolve(__dirname, '../phala-blockchain-setup/res/tokenomic.contract');
    
    if (!fs.existsSync(contractPath)) {
      console.log('❌ tokenomic.contract 文件不存在');
      return;
    }

    const metadata = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const wasm = metadata.source.wasm;
    console.log(`✅ 加载合约: ${metadata.contract.name}`);

    // 5. 部署合约
    console.log('📤 上传合约代码...');
    const codePromise = new PinkCodePromise(api, phatRegistry, metadata, wasm);
    const uploadResult = await signAndSend(
      codePromise.tx.default({ gasLimit: "10000000000000" }),
      alice
    );
    await uploadResult.waitFinalized(alice, certAlice);
    console.log('✅ 合约代码上传成功');

    // 6. 实例化合约
    console.log('📦 实例化合约...');
    const { blueprint } = uploadResult;
    const { gasRequired, storageDeposit, salt: saltRand } = await blueprint.query.default(alice.address, { cert: certAlice });
    const salt = saltRand;
    
    const instantiateResult = await signAndSend(
      blueprint.tx.default({ 
        gasLimit: gasRequired.refTime * 10, 
        storageDepositLimit: storageDeposit.isCharge ? storageDeposit.asCharge : null, 
        salt 
      }),
      alice
    );
    await instantiateResult.waitFinalized();
    
    const { contractId } = instantiateResult;
    console.log(`✅ 合约部署成功！`);
    console.log(`   合约ID: ${contractId}`);

    // 7. 调用合约方法（如果有version方法）
    console.log('\n📞 尝试调用合约方法...');
    try {
      const contract = instantiateResult.contract;
      
      // 尝试调用version方法
      if (contract.query.version) {
        const { output } = await contract.query.version(alice.address, { cert: certAlice });
        console.log(`✅ 合约版本: ${output.toHuman()}`);
      } else {
        console.log('ℹ️  合约没有version方法');
      }
      
      // 打印可用的方法
      console.log('\n📋 合约可用方法:');
      const methods = Object.keys(contract.query);
      methods.forEach((method, index) => {
        console.log(`   ${index + 1}. ${method}`);
      });
    } catch (error) {
      console.log('⚠️  调用合约方法时出错:', error.message);
    }

  } catch (error) {
    console.error('❌ 部署失败:', error);
    console.error('详细错误:', error.stack);
  } finally {
    if (api && api.isConnected) {
      await api.disconnect();
    }
  }
}

deployTokenContract().catch(console.error);

