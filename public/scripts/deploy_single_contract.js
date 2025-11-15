require('dotenv').config();

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { blake2AsHex } = require('@polkadot/util-crypto');
const { options, OnChainRegistry, signCertificate, PinkContractPromise, signAndSend, PinkCodePromise } = require('@phala/sdk');
const fs = require('fs');
const path = require('path');

const NODE_URL = process.env.NODE_URL || 'ws://127.0.0.1:19944';
const PRUNTIME_URL = process.env.PRUNTIME_URL || 'http://127.0.0.1:18000';

async function deploySingleContract(contractFile, contractName) {
  console.log(`🚀 开始部署合约: ${contractName}`);
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

    // 4. 加载合约文件
    const contractPath = path.resolve(contractFile);
    let metadata, wasm;
    
    if (contractFile.endsWith('.contract')) {
      // 处理.contract文件
      metadata = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
      wasm = metadata.source.wasm;
      console.log(`✅ 加载合约: ${metadata.contract.name}`);
    } else if (contractFile.endsWith('.js')) {
      // 处理JavaScript文件 - 创建模拟的合约数据
      const jsContent = fs.readFileSync(contractPath, 'utf8');
      metadata = {
        contract: {
          name: contractName,
          version: '1.0.0',
          authors: ['User'],
          description: 'JavaScript合约',
          homepage: '',
          repository: '',
          license: 'MIT'
        },
        source: {
          hash: '0x' + '0'.repeat(64), // 32字节的hash
          language: 'JavaScript',
          compiler: 'Custom',
          wasm: Buffer.from(jsContent, 'utf8').toString('base64')
        },
        VERSION: '4',
        metadata: {
          source: {
            hash: '0x' + Math.random().toString(16).substring(2, 66),
            language: 'JavaScript',
            compiler: 'Custom'
          },
          contract: {
            name: contractName,
            version: '1.0.0'
          }
        }
      };
      wasm = Buffer.from(jsContent, 'utf8');
      console.log(`✅ 加载JavaScript合约: ${contractName}`);
    } else {
      throw new Error('不支持的合约文件格式，请上传.contract或.js文件');
    }

    // 5. 部署合约
    console.log('📤 上传合约代码...');
    const codePromise = new PinkCodePromise(api, phatRegistry, metadata, wasm);
    const uploadResult = await signAndSend(
      codePromise.tx.default({ gasLimit: "10000000000000" }),
      alice
    );
    await uploadResult.waitFinalized(alice, certAlice, 8 * 3000);
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
    console.log(`   合约地址: ${contractId}`);

    // 7. 调用合约方法（如果有version方法）
    console.log('\n📞 尝试调用合约方法...');
    const contract = new PinkContractPromise(api, phatRegistry, metadata, contractId);
    
    try {
      const { output: versionOutput } = await contract.query.getVersion(alice.address, { cert: certAlice });
      console.log(`   合约版本: ${versionOutput.asOk.toPrimitive()}`);
    } catch (e) {
      console.log('   合约没有getVersion方法');
    }

    try {
      const { output: infoOutput } = await contract.query.getInfo(alice.address, { cert: certAlice });
      console.log(`   合约信息: ${JSON.stringify(infoOutput.asOk.toPrimitive(), null, 2)}`);
    } catch (e) {
      console.log('   合约没有getInfo方法');
    }

    return {
      success: true,
      contractId,
      address: contractId,
      name: contractName
    };

  } catch (error) {
    console.error('❌ 部署失败:', error);
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
  const contractFile = process.argv[2] || './res/tokenomic.contract';
  const contractName = process.argv[3] || 'TokenomicContract';
  
  deploySingleContract(contractFile, contractName)
    .then(result => {
      if (result.success) {
        console.log('\n🎉 部署完成！');
        console.log(`合约ID: ${result.contractId}`);
        console.log(`合约地址: ${result.address}`);
      } else {
        console.log('\n❌ 部署失败:', result.error);
        process.exit(1);
      }
    })
    .catch(console.error);
}

module.exports = { deploySingleContract };
