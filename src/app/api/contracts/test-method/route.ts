import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getNodeUrl, getPruntimeUrl } from '@/lib/config';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { contractAddress } = await request.json();

    if (!contractAddress) {
      return NextResponse.json({
        success: false,
        error: '缺少合约地址'
      }, { status: 400 });
    }

    console.log(`测试合约方法支持: ${contractAddress}`);

    // 使用脚本测试合约是否支持version方法
    const nodeUrl = getNodeUrl();
    const pruntimeUrl = getPruntimeUrl();
    const testCommand = `cd /app/phala-blockchain-setup && NODE_URL=${nodeUrl} PRUNTIME_URL=${pruntimeUrl} node -e "
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { options, OnChainRegistry, signCertificate, PinkContractPromise } = require('@phala/sdk');
const fs = require('fs');

const NODE_URL = '${nodeUrl}';
const PRUNTIME_URL = '${pruntimeUrl}';
const CONTRACT_ID = '${contractAddress}';

async function testContractMethod() {
  let api;
  try {
    api = await ApiPromise.create(options({
      provider: new WsProvider(NODE_URL),
      noInitWarn: true,
    }));
    await api.isReady;
    
    const phatRegistry = await OnChainRegistry.create(api);
    const keyring = new Keyring({ type: 'sr25519' });
    const alice = keyring.addFromUri('//Alice');
    const certAlice = await signCertificate({ pair: alice });
    
    const contractPath = './res/tokenomic.contract';
    const metadata = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const contract = new PinkContractPromise(api, phatRegistry, metadata, CONTRACT_ID);
    
    // 尝试调用version方法
    try {
      const { output } = await contract.query.version(alice.address, { cert: certAlice });
      const result = output.asOk.toPrimitive();
      console.log('TEST_RESULT: SUCCESS');
    } catch (error) {
      console.log('TEST_RESULT: FAILED');
    }
  } catch (error) {
    console.log('TEST_RESULT: ERROR');
  } finally {
    if (api && api.isConnected) {
      await api.disconnect();
    }
  }
}

testContractMethod();
"`;

    const { stdout, stderr } = await execAsync(testCommand, {
      timeout: 10000, // 10秒超时
      cwd: '/app/phala-blockchain-setup'
    });

    console.log('测试输出:', stdout);
    if (stderr) {
      console.error('测试错误:', stderr);
    }

    // 解析测试结果
    const isSupported = stdout.includes('TEST_RESULT: SUCCESS');

    return NextResponse.json({
      success: true,
      data: {
        contractAddress,
        supportsVersion: isSupported,
        testOutput: stdout
      }
    });

  } catch (error) {
    console.error('合约方法测试失败:', error);
    return NextResponse.json({
      success: false,
      error: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
